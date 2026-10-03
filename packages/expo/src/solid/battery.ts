import { createMemo, type Accessor } from 'solid-js';
import { createObserved, type ObservedSource } from '@solidnative/device/solid';
import { expoModule } from '../native.ts';
import { observedFrom } from './observed.ts';
import { sourcedService } from './owned.ts';
export type BatteryState = 'unknown' | 'unplugged' | 'charging' | 'full';

export interface BatterySources {
  level: ObservedSource<number> | null;
  state: ObservedSource<BatteryState> | null;
  saving: ObservedSource<boolean> | null;
}

const NOTHING: BatterySources = { level: null, state: null, saving: null };

export interface Battery {
  readonly level: Accessor<number>;
  readonly known: Accessor<boolean>;
  readonly state: Accessor<BatteryState>;
  readonly saving: Accessor<boolean>;
  readonly charging: Accessor<boolean>;
  readonly low: Accessor<boolean>;
}
export const Battery = sourcedService<Battery, BatterySources>(
  'expo.battery',
  () => {
    const expo = expoModule(
      'expo-battery',
      () => require('expo-battery') as typeof import('expo-battery'),
    );
    if (!expo) return NOTHING;

    /**
     * Expo's states are numbers, and one of them is Android-only.
     *
     * `NOT_CHARGING` means plugged in and holding, which for every purpose an app has is
     * charging: the battery is not going down.
     */
    const STATES: Record<number, BatteryState> = {
      [expo.BatteryState.UNKNOWN]: 'unknown',
      [expo.BatteryState.UNPLUGGED]: 'unplugged',
      [expo.BatteryState.CHARGING]: 'charging',
      [expo.BatteryState.FULL]: 'full',
      [expo.BatteryState.NOT_CHARGING]: 'full',
    };

    return {
      level: observedFrom(
        () => expo.getBatteryLevelAsync(),
        (listener) => expo.addBatteryLevelListener(({ batteryLevel }) => listener(batteryLevel)),
      ),
      state: observedFrom(
        async () => STATES[await expo.getBatteryStateAsync()] ?? 'unknown',
        (listener) =>
          expo.addBatteryStateListener(({ batteryState }) =>
            listener(STATES[batteryState] ?? 'unknown'),
          ),
      ),
      saving: observedFrom(
        () => expo.isLowPowerModeEnabledAsync(),
        (listener) => expo.addLowPowerModeListener(({ lowPowerMode }) => listener(lowPowerMode)),
      ),
    };
  },
  (sources) => {
    const reported = createObserved(sources.level, 1);
    const level = createMemo(() => (reported() < 0 ? 1 : reported()));
    const known = createMemo(() => reported() >= 0);
    const state = createObserved(sources.state, 'unknown');
    const saving = createObserved(sources.saving, false);
    const charging = createMemo(() => state() === 'charging' || state() === 'full');
    return {
      level,
      known,
      state,
      saving,
      charging,
      low: createMemo(() => known() && level() <= 0.2 && !charging()),
    };
  },
);
