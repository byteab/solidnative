import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { provideService, useService, withServiceScope } from '@solid-native/device/solid';
import { Runs } from '../src/app/data/runs.solid.ts';
import { LocationSourceSetting } from '../src/app/settings/location-source-setting.solid.ts';
import type { LocationFix, LocationSource } from '../src/app/tracking/location-source.ts';
import { SimulatedLocationSource } from '../src/app/tracking/simulated-location-source.solid.ts';
import { RealLocationSource } from '../src/app/tracking/real-location-source.solid.ts';
import { Tracking } from '../src/app/tracking/tracking.solid.ts';

/** A source under the test's own control: fixes are sent by calling `emit`, not on a timer. */
class FakeLocationSource implements LocationSource {
  private onFix: ((fix: LocationFix) => void) | null = null;
  stopped = false;
  start(onFix: (fix: LocationFix) => void): () => void {
    this.onFix = onFix;
    return () => {
      this.stopped = true;
      this.onFix = null;
    };
  }
  emit(fix: LocationFix): void {
    this.onFix?.(fix);
  }
}

/** A service scope of its own per test, disposed with it. */
function scoped<T>(t: { after(fn: () => void): void }, read: () => T) {
  return createRoot((dispose) => {
    t.after(dispose);
    return withServiceScope([], read);
  });
}

// A point on the equator, `metersEast` metres further along it than the last - close enough to
// exact at these distances that the arithmetic below can use it directly.
function pointAt(metersEast: number, timestamp: number): LocationFix {
  const METERS_PER_DEGREE = 111_194.93;
  return { latitude: 0, longitude: metersEast / METERS_PER_DEGREE, altitude: null, timestamp };
}
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.5, `${actual} is not close to ${expected}`);

function startTracking(t: { after(fn: () => void): void }) {
  const source = new FakeLocationSource();
  const real = new FakeLocationSource();
  const tracking = createRoot((dispose) => {
    t.after(dispose);
    return withServiceScope(
      [
        provideService(SimulatedLocationSource, () => source),
        provideService(RealLocationSource, () => real),
        provideService(LocationSourceSetting, () => ({
          simulate: Object.assign(() => true, { set() {}, update() {} }),
        })),
      ],
      () => useService(Tracking),
    );
  });
  tracking.start();
  return { source, real, tracking };
}

test('a fresh launch has seeded runs, newest first', (t) => {
  const runs = scoped(t, () => useService(Runs));
  const all = runs.runs();
  assert.ok(all.length > 0);
  const startedTimes = all.map((run) => new Date(run.startedAt).getTime());
  assert.deepEqual(
    startedTimes,
    [...startedTimes].sort((a, b) => b - a),
  );
});

test('recording a run adds it to the top of the list, with distance and splits worked out', (t) => {
  const runs = scoped(t, () => useService(Runs));
  const before = runs.runs().length;
  const run = runs.record(
    [
      { latitude: 51.53, longitude: -0.15, timestamp: 0 },
      { latitude: 51.531, longitude: -0.151, timestamp: 60_000 },
    ],
    60,
  );
  assert.equal(runs.runs().length, before + 1);
  assert.equal(runs.runs()[0]!.id, run.id);
  assert.equal(run.durationSeconds, 60);
  assert.ok(run.distanceMeters > 0);
});

test('find looks a run up by id, and returns undefined for one that does not exist', (t) => {
  const runs = scoped(t, () => useService(Runs));
  const [first] = runs.runs();
  assert.equal(runs.find(first!.id), first);
  assert.equal(runs.find('not-a-real-id'), undefined);
});

test('removing a run takes it out of the list', (t) => {
  const runs = scoped(t, () => useService(Runs));
  const [first] = runs.runs();
  runs.remove(first!.id);
  assert.equal(runs.find(first!.id), undefined);
});

test('recording accumulates distance and elapsed time from the fixes received', (t) => {
  const { source, real, tracking } = startTracking(t);
  source.emit(pointAt(0, 0));
  source.emit(pointAt(100, 10_000));
  source.emit(pointAt(250, 25_000));
  close(tracking.distanceMeters(), 250);
  close(tracking.elapsedSeconds(), 25);
  close(tracking.paceSecondsPerKm(), 100);
  assert.equal(tracking.status(), 'recording');
  // The simulated setting picked the simulated source; the GPS was never started.
  real.emit(pointAt(9_000, 30_000));
  close(tracking.distanceMeters(), 250);
});

test('pausing stops distance and time from accumulating, and resuming picks back up', (t) => {
  const { source, tracking } = startTracking(t);
  source.emit(pointAt(0, 0));
  source.emit(pointAt(100, 10_000));
  tracking.pause();
  source.emit(pointAt(500, 400_000)); // Ignored: recorded while paused.
  close(tracking.distanceMeters(), 100);
  close(tracking.elapsedSeconds(), 10);
  tracking.resume();
  source.emit(pointAt(150, 415_000));
  // The 50m from 100 to 150 is counted; the gap while paused is not, in either distance or time.
  close(tracking.distanceMeters(), 150);
  close(tracking.elapsedSeconds(), 10);
});

test('finishing saves the run and returns tracking to idle', (t) => {
  const { source, tracking } = startTracking(t);
  source.emit(pointAt(0, 0));
  source.emit(pointAt(300, 60_000));
  const run = tracking.finish();
  assert.ok(run);
  close(run.distanceMeters, 300);
  assert.equal(source.stopped, true);
  assert.equal(tracking.status(), 'idle');
  assert.deepEqual(tracking.route(), []);
});

test('finishing with fewer than two fixes saves nothing', (t) => {
  const { source, tracking } = startTracking(t);
  source.emit(pointAt(0, 0));
  assert.equal(tracking.finish(), null);
  assert.equal(tracking.finish(), null);
});

test('discarding a run stops the source without saving anything', (t) => {
  const { source, tracking } = startTracking(t);
  source.emit(pointAt(0, 0));
  source.emit(pointAt(300, 60_000));
  tracking.discard();
  assert.equal(source.stopped, true);
  assert.equal(tracking.status(), 'idle');
});

test('starting twice does nothing the second time', (t) => {
  const { source, tracking } = startTracking(t);
  source.emit(pointAt(0, 0));
  tracking.start();
  source.emit(pointAt(300, 60_000));
  // A second `start()` would have reset the route; it did not.
  close(tracking.distanceMeters(), 300);
});
