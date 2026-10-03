import { onCleanup } from 'solid-js';
import { createServiceToken, useService } from '@solidnative/device/solid';
import type { LocationFix, LocationSource } from './location-source.ts';
import { SIMULATED_ROUTE } from './simulated-route.ts';

/**
 * Milliseconds between simulated fixes. A test overrides this to something tiny, so "advancing
 * time" in a run means waiting a handful of real milliseconds rather than faking a clock.
 */
export const SIMULATED_LOCATION_INTERVAL = createServiceToken<number>(
  'runs.simulatedLocationInterval',
  () => 1_000,
);

/**
 * A recorded route replayed on a timer, for development and screenshots: no GPS, no permission,
 * and no waiting for a real device to move. Timestamps are spaced by the interval regardless of
 * how fast the timer actually fires, so distance and pace come out the same on a slow CI runner
 * as on a fast one.
 */
export const SimulatedLocationSource = createServiceToken<LocationSource>(
  'runs.simulatedLocationSource',
  () => {
    const intervalMs = useService(SIMULATED_LOCATION_INTERVAL);
    const running = new Set<() => void>();
    // A timer outliving the app would keep feeding a disposed run.
    onCleanup(() => {
      for (const stop of [...running]) stop();
    });
    return {
      start(onFix) {
        let index = 0;
        const startedAt = Date.now();
        const emit = () => {
          const point = SIMULATED_ROUTE[index]!;
          onFix({
            latitude: point.latitude,
            longitude: point.longitude,
            altitude: null,
            timestamp: startedAt + index * intervalMs,
          } satisfies LocationFix);
          index++;
        };
        emit();
        const handle = setInterval(() => {
          if (index >= SIMULATED_ROUTE.length) {
            clearInterval(handle);
            return;
          }
          emit();
        }, intervalMs);
        const stop = () => {
          clearInterval(handle);
          running.delete(stop);
        };
        running.add(stop);
        return stop;
      },
    };
  },
);
