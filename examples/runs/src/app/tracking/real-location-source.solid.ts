import { createEffect, createRoot, getOwner, runWithOwner } from 'solid-js';
import { createServiceToken, useService } from '@solidnative/device/solid';
import { Location } from '@solidnative/expo/solid/location';
import type { LocationSource } from './location-source.ts';

/**
 * The device's own GPS, through `Location`. `Location.start()` follows the position into a
 * signal rather than a callback, so this bridges the two with an effect, owned by this service
 * rather than by whichever screen happened to press Start.
 */
export const RealLocationSource = createServiceToken<LocationSource>(
  'runs.realLocationSource',
  () => {
    const location = useService(Location);
    const owner = getOwner();
    return {
      start(onFix) {
        let stopWatch = () => {};
        let stopped = false;
        const stopEffect = runWithOwner(owner, () =>
          createRoot((dispose) => {
            createEffect(() => {
              const position = location.position();
              if (position) {
                onFix({
                  latitude: position.latitude,
                  longitude: position.longitude,
                  altitude: position.altitude,
                  timestamp: position.timestamp,
                });
              }
            });
            return dispose;
          }),
        )!;
        void runWithOwner(owner, () => location.start({ accuracy: 'high', distance: 5 }))!.then(
          (stop) => {
            if (stopped) {
              stop();
              return;
            }
            stopWatch = stop;
          },
        );
        return () => {
          stopped = true;
          stopWatch();
          stopEffect();
        };
      },
    };
  },
);
