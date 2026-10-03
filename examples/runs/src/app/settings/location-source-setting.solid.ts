import { createServiceToken, useService } from '@solidnative/device/solid';
import { Storage, type StoredSignal } from '@solidnative/expo/solid/store';

declare const __DEV__: boolean | undefined;

/**
 * Whether a run uses the simulated route instead of the device's GPS.
 *
 * Defaults on everywhere except a release build: a development build or the simulator has no
 * GPS worth trusting, and the app's own tests have no GPS at all, so the simulated route is what
 * makes the app - and its screenshots - move without a real run. `Settings` lets a person flip it
 * either way, and the choice is remembered.
 */
export interface LocationSourceSetting {
  readonly simulate: StoredSignal<boolean>;
}
export const LocationSourceSetting = createServiceToken<LocationSourceSetting>(
  'runs.locationSourceSetting',
  () => ({
    simulate: useService(Storage).signal('runs.simulateLocation', defaultsToSimulated()),
  }),
);

export function defaultsToSimulated(): boolean {
  return typeof __DEV__ === 'undefined' || __DEV__;
}
