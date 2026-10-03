import type { ObservedSource } from '@solidnative/device/solid';
export type Observed<T> = ObservedSource<T>;
export function observedFrom<T>(
  current: () => T | PromiseLike<T>,
  subscribe: (listener: (value: T) => void) => { remove(): void },
): ObservedSource<T> {
  return {
    current,
    subscribe: (listener) => {
      const subscription = subscribe(listener);
      return () => subscription.remove();
    },
  };
}
