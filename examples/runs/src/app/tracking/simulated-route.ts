import type { GeoPoint } from './geo.ts';

/**
 * A loop around Regent's Park, London, close enough to the real paths to look right on a map.
 * Built from a handful of waypoints rather than one per metre - `SimulatedLocationSource`
 * interpolates between them - so the route reads as deliberate turns, not a wobbling circle.
 */
const WAYPOINTS: readonly GeoPoint[] = [
  { latitude: 51.5313, longitude: -0.1568 },
  { latitude: 51.5327, longitude: -0.1591 },
  { latitude: 51.5346, longitude: -0.1608 },
  { latitude: 51.5367, longitude: -0.1602 },
  { latitude: 51.5381, longitude: -0.1571 },
  { latitude: 51.5385, longitude: -0.1526 },
  { latitude: 51.5375, longitude: -0.1489 },
  { latitude: 51.5354, longitude: -0.1471 },
  { latitude: 51.5333, longitude: -0.1479 },
  { latitude: 51.5317, longitude: -0.1505 },
  { latitude: 51.5309, longitude: -0.1538 },
  { latitude: 51.5313, longitude: -0.1568 },
];

/** Evenly spaced points between each pair of waypoints, so a device-style route has one fix every
 * few metres rather than one every few hundred. */
function densify(waypoints: readonly GeoPoint[], perSegment: number): GeoPoint[] {
  const points: GeoPoint[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i]!;
    const to = waypoints[i + 1]!;
    for (let step = 0; step < perSegment; step++) {
      const t = step / perSegment;
      points.push({
        latitude: from.latitude + (to.latitude - from.latitude) * t,
        longitude: from.longitude + (to.longitude - from.longitude) * t,
      });
    }
  }
  points.push(waypoints[waypoints.length - 1]!);
  return points;
}

/**
 * About 1,450 points, roughly 4.5km around the park, spaced for a comfortable ~5:30/km pace at
 * one fix per second - close enough to a real run to make the live stats worth watching.
 */
export const SIMULATED_ROUTE: readonly GeoPoint[] = densify(WAYPOINTS, 132);
