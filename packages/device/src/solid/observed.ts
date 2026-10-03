import { createSignal, getOwner, onCleanup, type Accessor } from 'solid-js';

/** Direct native/Expo methods, without invoking a React hook. */
export interface ObservedSource<T> {
  current(): T | PromiseLike<T>;
  subscribe(listener: (value: T) => void): () => void;
}

/**
 * A failed or unavailable initial read leaves the supplied fallback in place.
 * Listener updates outrank an earlier asynchronous read; disposal rejects both.
 */
export function createObserved<T>(source: ObservedSource<T> | null, initial: T): Accessor<T> {
  if (!getOwner()) throw new Error('createObserved requires an active Solid owner.');
  const [value, setValue] = createSignal(initial);
  if (!source) return value;
  let active = true;
  let heard = false;
  let unsubscribe: (() => void) | undefined;
  onCleanup(() => {
    active = false;
    unsubscribe?.();
  });
  unsubscribe = source.subscribe((next) => {
    if (!active) return;
    heard = true;
    setValue(() => next);
  });
  // Some sources emit synchronously while subscribing; that emission can dispose the owner.
  if (!active) {
    unsubscribe();
    return value;
  }
  let first: T | PromiseLike<T>;
  try {
    first = source.current();
    const accept = (next: T) => {
      if (active && !heard) setValue(() => next);
    };
    if (
      first !== null &&
      (typeof first === 'object' || typeof first === 'function') &&
      typeof (first as PromiseLike<T>).then === 'function'
    )
      void Promise.resolve(first).then(accept, () => {});
    else accept(first as T);
  } catch {
    // A synchronous unsupported-source error has the same fallback as a rejected read.
  }
  return value;
}
