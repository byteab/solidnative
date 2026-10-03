import { createServiceToken, useService } from '@solid-native/device/solid';
import { Storage } from '@solid-native/expo/solid/store';
import type { DistanceUnit } from '../tracking/geo.ts';

/** Kilometres or miles, persisted so the choice survives a restart. */
export function createUnits() {
  const unit = useService(Storage).signal<DistanceUnit>('runs.unit', 'km');
  return {
    unit,
    toggle: () => unit.set(unit() === 'km' ? 'mi' : 'km'),
  };
}
export type Units = ReturnType<typeof createUnits>;
export const Units = createServiceToken<Units>('runs.units', createUnits);
