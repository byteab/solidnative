import { createSignal } from 'solid-js';
import { createServiceToken } from '@solidnative/device/solid';
import { splits, totalDistanceMeters, type Split, type TimedPoint } from '../tracking/geo.ts';
import { SIMULATED_ROUTE } from '../tracking/simulated-route.ts';

/** One finished run: its route, and the distance, duration and splits worked out from it. */
export interface Run {
  readonly id: string;
  /** ISO 8601, local to the device. */
  readonly startedAt: string;
  readonly durationSeconds: number;
  readonly distanceMeters: number;
  readonly route: readonly TimedPoint[];
  readonly splits: readonly Split[];
}

/**
 * Every finished run, newest first.
 *
 * A real app would sync this over HTTP or a database, the way [Habits](/examples/habits) keeps
 * its history in SQLite; this example keeps it in memory, seeded with a few runs so History and
 * a run's detail screen have something to show from the first launch.
 */
export function createRuns() {
  const [runs, setRuns] = createSignal<readonly Run[]>(seedRuns());
  return {
    runs,
    find: (id: string): Run | undefined => runs().find((run) => run.id === id),
    /**
     * Records a finished run. `durationSeconds` is the time actually spent recording - tracking
     * works it out by excluding any paused stretch, which a plain first-to-last timestamp on the
     * route would not.
     */
    record(route: readonly TimedPoint[], durationSeconds: number): Run {
      const run: Run = {
        id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1_000).toString(36)}`,
        startedAt: new Date(route[0]?.timestamp ?? Date.now()).toISOString(),
        durationSeconds,
        distanceMeters: totalDistanceMeters(route),
        route,
        splits: splits(route),
      };
      setRuns((all) => [run, ...all]);
      return run;
    },
    remove: (id: string) => setRuns((all) => all.filter((run) => run.id !== id)),
  };
}
export type Runs = ReturnType<typeof createRuns>;
export const Runs = createServiceToken<Runs>('runs.runs', createRuns);

/** A run over part of the simulated route, at a steady pace, ending `daysAgo` days ago. */
function seedRun(
  id: string,
  daysAgo: number,
  hour: number,
  points: number,
  paceSecondsPerKm: number,
): Run {
  const route = SIMULATED_ROUTE.slice(0, points);
  const metersPerPoint = totalDistanceMeters(route) / Math.max(1, points - 1);
  const secondsPerPoint = (metersPerPoint / 1_000) * paceSecondsPerKm;

  const end = new Date();
  end.setDate(end.getDate() - daysAgo);
  end.setHours(hour, 0, 0, 0);
  const startedAt = new Date(end.getTime() - secondsPerPoint * (points - 1) * 1_000);

  const timed: TimedPoint[] = route.map((point, index) => ({
    ...point,
    timestamp: startedAt.getTime() + index * secondsPerPoint * 1_000,
  }));

  return {
    id,
    startedAt: startedAt.toISOString(),
    durationSeconds: secondsPerPoint * (points - 1),
    distanceMeters: totalDistanceMeters(timed),
    route: timed,
    splits: splits(timed),
  };
}

/** A handful of runs over the last couple of weeks, so History is not empty on first launch. */
function seedRuns(): Run[] {
  return [
    seedRun('seed-1', 0, 7, 480, 300),
    seedRun('seed-2', 2, 18, 660, 315),
    seedRun('seed-3', 5, 7, 330, 290),
    seedRun('seed-4', 9, 8, 990, 330),
    seedRun('seed-5', 13, 7, 420, 305),
  ];
}
