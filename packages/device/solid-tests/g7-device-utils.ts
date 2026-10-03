import { createRoot } from 'solid-js';
import {
  provideService,
  useService,
  withServiceScope,
  type ServiceToken,
} from '@solidnative/device/solid';

export function scope<T>(render: () => T) {
  let dispose!: () => void;
  const value = createRoot((cleanup) => {
    dispose = cleanup;
    return render();
  });
  return { value, dispose };
}

export function service<T, S>(token: ServiceToken<T> & { SOURCE: ServiceToken<S> }, source: S) {
  return scope(() =>
    withServiceScope([provideService(token.SOURCE, () => source)], () => useService(token)),
  );
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
