import { createSignal, getOwner, onCleanup } from 'solid-js';
import { createServiceToken, useService } from '@solid-native/device/solid';

export function sourcedService<T, S>(name: string, source: () => S, create: (source: S) => T) {
  const SOURCE = createServiceToken(`${name}.source`, source);
  return Object.freeze({
    ...createServiceToken<T>(name, () => create(useService(SOURCE))),
    SOURCE,
  });
}

/** Native promises cannot be aborted universally; cancel the owned JS answer instead. */
export function ownedRequests() {
  if (!getOwner()) throw new Error('Expo services require an active Solid owner.');
  let active = true;
  const pending = new Set<() => void>();
  onCleanup(() => {
    active = false;
    for (const cancel of [...pending]) cancel();
  });
  return {
    active: () => active,
    run<T>(
      fallback: T,
      start: (active: () => boolean) => T | PromiseLike<T>,
      accept?: (value: T) => void,
    ): Promise<T> {
      if (!active) return Promise.resolve(fallback);
      return new Promise<T>((resolve, reject) => {
        let alive = true;
        const finish = (complete: () => void) => {
          if (!alive) return;
          alive = false;
          pending.delete(cancel);
          ownerCancel = undefined;
          complete();
        };
        const cancel = () => finish(() => resolve(fallback));
        let ownerCancel: (() => void) | undefined = cancel;
        pending.add(cancel);
        if (getOwner()) onCleanup(() => ownerCancel?.());
        try {
          const answer = start(() => active && alive);
          void Promise.resolve(answer).then(
            (value) => {
              if (!alive) return;
              try {
                accept?.(value);
                // Publication may synchronously dispose the caller or service.
                finish(() => resolve(value));
              } catch (error) {
                finish(() => reject(error));
              }
            },
            (error: unknown) => finish(() => reject(error)),
          );
        } catch (error) {
          finish(() => reject(error));
        }
      });
    },
  };
}

export function silence(action: () => unknown): void {
  try {
    void Promise.resolve(action()).catch(() => {});
  } catch {
    // Haptic feedback and native cleanup must not prevent sibling cleanup.
  }
}

/** Serialize native mutations, including compensating release after asynchronous acquisition. */
export function mutationQueue(active: () => boolean = () => true) {
  const [error, setError] = createSignal<Error | null>(null);
  let tail = Promise.resolve();
  return {
    error,
    run(action: () => unknown) {
      tail = tail.then(action).then(
        () => undefined,
        (cause: unknown) => {
          if (active()) setError(cause instanceof Error ? cause : new Error(String(cause)));
        },
      );
      return tail;
    },
  };
}

/** Register before publishing/acquiring so synchronous disposal cannot strand a claim. */
export function callerCleanup(release: () => void): void {
  if (getOwner()) onCleanup(release);
}
