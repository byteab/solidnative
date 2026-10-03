import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  convertDistance,
  convertPace,
  formatDistance,
  formatDuration,
  formatPace,
  haversineMeters,
  paceSecondsPerKm,
  splits,
  totalDistanceMeters,
  type TimedPoint,
} from '../src/app/tracking/geo.ts';

// The earth radius `geo.ts` uses. Kept here too so these expectations do not depend on the
// implementation being tested: on the equator, where the two points share a latitude, the
// haversine formula reduces to `radius * angleInRadians` exactly.
/** Vitest's `toBeCloseTo`: equal to within half a unit of the given decimal place. */
const closeTo = (actual: number, expected: number, digits = 2) =>
  assert.ok(
    Math.abs(actual - expected) < 10 ** -digits / 2,
    `${actual} is not close to ${expected}`,
  );

const EARTH_RADIUS_METERS = 6_371_000;
const equatorMetersPerDegree = (degrees: number) =>
  (EARTH_RADIUS_METERS * (degrees * Math.PI)) / 180;

test('haversine distance between two points on the equator matches the closed-form angle', () => {
  const a = { latitude: 0, longitude: 0 };
  const b = { latitude: 0, longitude: 1 };

  closeTo(haversineMeters(a, b), equatorMetersPerDegree(1), 0);
});

test('haversine distance between the same point is zero', () => {
  const point = { latitude: 51.5308, longitude: -0.1238 };
  assert.equal(haversineMeters(point, point), 0);
});

test('total distance sums each leg of the route', () => {
  const route = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.005 },
    { latitude: 0, longitude: 0.01 },
  ];

  closeTo(totalDistanceMeters(route), equatorMetersPerDegree(0.01), 0);
});

test('a route with fewer than two points has no distance', () => {
  assert.equal(totalDistanceMeters([]), 0);
  assert.equal(totalDistanceMeters([{ latitude: 0, longitude: 0 }]), 0);
});

test('pace is time per kilometre, and zero without any distance', () => {
  assert.equal(paceSecondsPerKm(1_000, 300), 300);
  assert.equal(paceSecondsPerKm(500, 300), 600);
  assert.equal(paceSecondsPerKm(0, 300), 0);
});

test('distance converts to miles', () => {
  closeTo(convertDistance(1_609.34, 'mi'), 1, 5);
  assert.equal(convertDistance(1_000, 'km'), 1);
});

test('pace converts to minutes per mile', () => {
  // 5:00/km is slower per mile, because a mile is longer than a kilometre.
  closeTo(convertPace(300, 'mi'), 482.8, 0);
  assert.equal(convertPace(300, 'km'), 300);
});

test('duration formats as mm:ss, or h:mm:ss past an hour', () => {
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(5), '0:05');
  assert.equal(formatDuration(3_725), '1:02:05');
});

test('pace formats as m:ss, or a placeholder with nothing to show yet', () => {
  assert.equal(formatPace(303), '5:03');
  assert.equal(formatPace(0), '--:--');
  assert.equal(formatPace(Number.NaN), '--:--');
});

test('distance formats to two decimal places', () => {
  assert.equal(formatDistance(3.1), '3.10');
  assert.equal(formatDistance(10), '10.00');
});

test('splits are empty for a route with fewer than two points', () => {
  assert.deepEqual(splits([]), []);
  assert.deepEqual(splits([{ latitude: 0, longitude: 0, timestamp: 0 }]), []);
});

test('a split is recorded each time the route crosses a kilometre, interpolated between fixes', () => {
  // Three points on the equator, each 0.005deg (~556m) apart, a minute apart in time. The route
  // crosses 1km inside the second leg.
  const step = equatorMetersPerDegree(0.005);
  const route: TimedPoint[] = [
    { latitude: 0, longitude: 0, timestamp: 0 },
    { latitude: 0, longitude: 0.005, timestamp: 60_000 },
    { latitude: 0, longitude: 0.01, timestamp: 120_000 },
  ];

  const [first] = splits(route);
  assert.ok(first);
  assert.equal(first!.index, 1);

  // Crossing happens `overshoot` short of the second leg's end: (2 * step - 1000) / step of the
  // way through it, so the elapsed time is a minute plus that fraction of the second minute.
  const overshoot = 2 * step - 1_000;
  const fraction = 1 - overshoot / step;
  const expectedDuration = 60 + 60 * fraction;
  closeTo(first!.durationSeconds, expectedDuration, 1);
  closeTo(first!.paceSecondsPerUnit, expectedDuration, 1);
});

test('a route that never reaches a full kilometre has no splits', () => {
  const route: TimedPoint[] = [
    { latitude: 0, longitude: 0, timestamp: 0 },
    { latitude: 0, longitude: 0.001, timestamp: 10_000 },
  ];

  assert.deepEqual(splits(route), []);
});

test('a long jump between two fixes can cross more than one boundary', () => {
  const route: TimedPoint[] = [
    { latitude: 0, longitude: 0, timestamp: 0 },
    { latitude: 0, longitude: 0.03, timestamp: 300_000 },
  ];

  const result = splits(route, 1_000);
  assert.ok(result.length > 1);
  assert.deepEqual(
    result.map((s) => s.index),
    result.map((_, i) => i + 1),
  );
});
