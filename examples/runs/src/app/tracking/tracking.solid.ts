import { batch, createMemo, createSignal, onCleanup } from 'solid-js';
import { createServiceToken, useService } from '@solidnative/device/solid';
import { Runs, type Run } from '../data/runs.solid.ts';
import { LocationSourceSetting } from '../settings/location-source-setting.solid.ts';
import { paceSecondsPerKm, totalDistanceMeters, type TimedPoint } from './geo.ts';
import type { LocationFix } from './location-source.ts';
import { RealLocationSource } from './real-location-source.solid.ts';
import { SimulatedLocationSource } from './simulated-location-source.solid.ts';

export type TrackingStatus = 'idle' | 'recording' | 'paused';

/**
 * A run in progress: the route recorded so far, and the distance, elapsed time and pace worked
 * out from it. Reads fixes from whichever location source settings picks.
 *
 * Time only moves while `status` is `'recording'`: a fix that arrives while paused is dropped
 * rather than counted, so `elapsedSeconds` excludes a pause without needing a wall clock or a
 * separate timer - it is entirely a function of the fixes actually recorded.
 */
export function createTracking() {
  const real = useService(RealLocationSource);
  const simulated = useService(SimulatedLocationSource);
  const locationSetting = useService(LocationSourceSetting);
  const runsService = useService(Runs);

  const [status, setStatus] = createSignal<TrackingStatus>('idle');
  const [route, setRoute] = createSignal<readonly TimedPoint[]>([]);
  const [movingMs, setMovingMs] = createSignal(0);
  let lastFixAt: number | null = null;
  let stopSource: () => void = () => {};

  const distanceMeters = createMemo(() => totalDistanceMeters(route()));
  const elapsedSeconds = createMemo(() => movingMs() / 1_000);
  const pace = createMemo(() => paceSecondsPerKm(distanceMeters(), elapsedSeconds()));

  const recordFix = (fix: LocationFix) => {
    if (status() !== 'recording') return;
    const previous = lastFixAt;
    lastFixAt = fix.timestamp;
    batch(() => {
      setRoute((route) => [
        ...route,
        { latitude: fix.latitude, longitude: fix.longitude, timestamp: fix.timestamp },
      ]);
      if (previous !== null) setMovingMs((ms) => ms + (fix.timestamp - previous));
    });
  };

  const reset = () => {
    stopSource();
    stopSource = () => {};
    lastFixAt = null;
    batch(() => {
      setStatus('idle');
      setRoute([]);
      setMovingMs(0);
    });
  };
  onCleanup(reset);

  return {
    status,
    route,
    distanceMeters,
    elapsedSeconds,
    paceSecondsPerKm: pace,
    start(): void {
      if (status() !== 'idle') return;
      lastFixAt = null;
      batch(() => {
        setRoute([]);
        setMovingMs(0);
        setStatus('recording');
      });
      const source = locationSetting.simulate() ? simulated : real;
      stopSource = source.start(recordFix);
    },
    pause(): void {
      if (status() !== 'recording') return;
      setStatus('paused');
      // Cleared so the fix after resume does not count the pause itself as moving time.
      lastFixAt = null;
    },
    resume(): void {
      if (status() !== 'paused') return;
      setStatus('recording');
    },
    /** Ends the run and saves it, if anything worth keeping was recorded. */
    finish(): Run | null {
      if (status() === 'idle') return null;
      const recorded = route();
      const durationSeconds = elapsedSeconds();
      reset();
      return recorded.length >= 2 ? runsService.record(recorded, durationSeconds) : null;
    },
    /** Ends the run without saving it. */
    discard: reset,
  };
}
export type Tracking = ReturnType<typeof createTracking>;
export const Tracking = createServiceToken<Tracking>('runs.tracking', createTracking);
