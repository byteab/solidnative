import { onCleanup } from 'solid-js';
import { reactNative } from '../react-native.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface NativeVibration {
  vibrate(pattern?: number | number[], repeat?: boolean): void;
  cancel(): void;
}

export interface Vibration {
  /** iOS uses its fixed native duration; Android uses this duration. */
  buzz(durationMs?: number): void;
  pattern(millis: readonly number[], options?: { repeat?: boolean }): void;
  stop(): void;
}

const SOURCE = createServiceToken<NativeVibration | null>(
  'native.vibrationSource',
  () => reactNative()?.Vibration ?? null,
);
export const Vibration = Object.freeze({
  ...createServiceToken<Vibration>('native.vibration', () => {
    const native = useService(SOURCE);
    let active = true;
    let started = false;
    let acquiring = false;
    const stop = () => {
      started = false;
      native?.cancel();
    };
    onCleanup(() => {
      active = false;
      if (started && !acquiring) stop();
    });
    const vibrate = (pattern: number | number[], repeat = false) => {
      if (!active || !native) return;
      started = true;
      acquiring = true;
      try {
        native.vibrate(pattern, repeat);
      } finally {
        acquiring = false;
        // A source can synchronously dispose its owner during acquisition.
        if (!active && started) stop();
      }
    };
    return {
      buzz: (duration = 400) => vibrate(duration),
      pattern: (millis, options = {}) => vibrate([...millis], options.repeat ?? false),
      stop: () => {
        if (active) stop();
      },
    };
  }),
  SOURCE,
});
