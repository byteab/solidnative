/**
 * The maths behind a run: distance from a route of coordinates, pace from distance and time, and
 * per-kilometre (or per-mile) splits. Pure functions, so a test needs no location source at all.
 */

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface TimedPoint extends GeoPoint {
  /** Milliseconds since the epoch. */
  readonly timestamp: number;
}

export type DistanceUnit = 'km' | 'mi';

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_MILE = 1_609.34;

/** The great-circle distance between two coordinates, in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const chord =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(chord));
}

/** The length of a route, in metres: the sum of the distance between each consecutive point. */
export function totalDistanceMeters(route: readonly GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += haversineMeters(route[i - 1]!, route[i]!);
  return total;
}

/** Seconds per kilometre. Zero without any distance covered, rather than infinity. */
export function paceSecondsPerKm(distanceMeters: number, elapsedSeconds: number): number {
  if (distanceMeters <= 0) return 0;
  return elapsedSeconds / (distanceMeters / 1_000);
}

/** A distance in metres, in the unit the person chose. */
export function convertDistance(meters: number, unit: DistanceUnit): number {
  return unit === 'mi' ? meters / METERS_PER_MILE : meters / 1_000;
}

/** A pace in seconds per kilometre, converted to seconds per mile where the unit asks for one. */
export function convertPace(secondsPerKm: number, unit: DistanceUnit): number {
  return unit === 'mi' ? secondsPerKm * (METERS_PER_MILE / 1_000) : secondsPerKm;
}

/** `12:04` (or `1:02:04` past an hour), for a running clock or a finished run's duration. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  const ss = String(secs).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** `5:03`, or `--:--` with nothing to divide by yet. */
export function formatPace(secondsPerUnit: number): string {
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) return '--:--';
  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `3.10`, to two decimal places, as a run's headline distance is shown. */
export function formatDistance(distance: number): string {
  return distance.toFixed(2);
}

export interface Split {
  /** 1 for the first kilometre (or mile), 2 for the second, and so on. */
  readonly index: number;
  readonly durationSeconds: number;
  readonly paceSecondsPerUnit: number;
}

/**
 * One entry per whole unit (1000m by default) the route crosses, oldest first. The crossing point
 * within a segment is interpolated linearly between its two fixes, both in distance and in time,
 * which is accurate enough for a phone's GPS without needing every fix to land exactly on a
 * boundary.
 */
export function splits(route: readonly TimedPoint[], unitMeters = 1_000): readonly Split[] {
  if (route.length < 2) return [];

  const result: Split[] = [];
  let cumulative = 0;
  let nextBoundary = unitMeters;
  let splitStartTime = route[0]!.timestamp;

  for (let i = 1; i < route.length; i++) {
    const previous = route[i - 1]!;
    const current = route[i]!;
    const segment = haversineMeters(previous, current);
    cumulative += segment;

    // A `while`, not an `if`: a single long jump (a lost GPS fix regained further on) can cross
    // more than one boundary at once.
    while (cumulative >= nextBoundary && segment > 0) {
      const overshoot = cumulative - nextBoundary;
      const fraction = 1 - overshoot / segment;
      const crossingTime = previous.timestamp + (current.timestamp - previous.timestamp) * fraction;
      const durationSeconds = (crossingTime - splitStartTime) / 1_000;
      result.push({
        index: result.length + 1,
        durationSeconds,
        paceSecondsPerUnit: paceSecondsPerKm(unitMeters, durationSeconds),
      });
      splitStartTime = crossingTime;
      nextBoundary += unitMeters;
    }
  }

  return result;
}
