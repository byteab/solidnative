import { getOwner, onCleanup } from 'solid-js';

/** Pending native answers belong to both the service scope and the initiating owner. */
export function createRequests() {
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
      start: (
        resolve: (value: T) => void,
        reject: (error: unknown) => void,
        active: () => boolean,
      ) => void | (() => void),
    ): Promise<T> {
      if (!active) return Promise.resolve(fallback);
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        let cleanup: (() => void) | undefined;
        const finish = (complete: () => void) => {
          if (settled) return;
          settled = true;
          pending.delete(cancel);
          cancelFromOwner = undefined;
          cleanup?.();
          complete();
        };
        const cancel = () => finish(() => resolve(fallback));
        let cancelFromOwner: (() => void) | undefined = cancel;
        pending.add(cancel);
        if (getOwner()) onCleanup(() => cancelFromOwner?.());
        try {
          const release = start(
            (value) => finish(() => resolve(value)),
            (error) => finish(() => reject(error)),
            () => active && !settled,
          );
          if (release) {
            if (settled) release();
            else cleanup = release;
          }
        } catch (error) {
          finish(() => reject(error));
        }
      });
    },
  };
}
