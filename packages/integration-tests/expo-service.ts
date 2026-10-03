/**
 * Building an Expo service outside an app: the service's platform source replaced by a fake, under
 * a Solid owner the test can dispose. Every root made here is disposed by `disposeServices`, which
 * the test files call from `afterEach`.
 */
import { createRoot } from 'solid-js';
import {
  provideService,
  useService,
  withServiceScope,
  type ServiceBinding,
  type ServiceToken,
} from '@solidnative/device/solid';

const disposers: (() => void)[] = [];

/** Disposes every owner `serviceWith`/`servicesWith`/`owned` made, newest first. */
export function disposeServices(): void {
  for (const stop of disposers.splice(0).reverse()) stop();
}

/** Runs `make` under a fresh owner; returns its value and that owner's disposer. */
export function owned<T>(make: () => T): { value: T; stop: () => void } {
  let stop!: () => void;
  const value = createRoot((dispose) => {
    stop = dispose;
    disposers.push(dispose);
    return make();
  });
  return { value, stop };
}

/** A service, built with its platform source replaced. */
export function serviceWith<T, S>(
  token: ServiceToken<T> & { SOURCE: ServiceToken<S> },
  source: NoInfer<S>,
): T {
  return servicesWith([provideService(token.SOURCE, () => source)], () => useService(token));
}

/** The same, for a service that reaches the platform through more than one token. */
export function servicesWith<T>(bindings: readonly ServiceBinding[], make: () => T): T {
  return owned(() => withServiceScope([...bindings], make)).value;
}

/** `serviceWith`, plus the disposer of the owner the service lives under. */
export function ownedService<T, S>(
  token: ServiceToken<T> & { SOURCE: ServiceToken<S> },
  source: NoInfer<S>,
): { value: T; stop: () => void } {
  return owned(() =>
    withServiceScope([provideService(token.SOURCE, () => source)], () => useService(token)),
  );
}
