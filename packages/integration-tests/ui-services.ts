/**
 * Building a device service outside an app: its platform source token overridden in a service
 * scope of its own, inside a Solid root that is never disposed (each test builds a fresh one).
 */
import { createRoot } from 'solid-js';
import { provideService, withServiceScope, type ServiceToken } from '@solid-native/device';

/** A service, built with its platform source replaced. */
export function serviceWith<S, T>(token: ServiceToken<S>, source: NoInfer<S>, make: () => T): T {
  return servicesWith([[token, source]], make);
}

/** The same, for services that reach the platform through more than one token. */
export function servicesWith<T>(
  sources: readonly (readonly [ServiceToken<unknown>, unknown])[],
  make: () => T,
): T {
  return createRoot(() =>
    withServiceScope(
      sources.map(([token, value]) => provideService(token, () => value as never)),
      make,
    ),
  );
}
