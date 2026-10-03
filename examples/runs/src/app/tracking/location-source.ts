/**
 * Where a run's fixes come from. `RealLocationSource` wraps the device's GPS; `SimulatedLocationSource`
 * replays a recorded route on a timer. `Tracking` talks to whichever one settings picks, through
 * this one interface, so it never knows which it has.
 */
export interface LocationFix {
  readonly latitude: number;
  readonly longitude: number;
  /** Metres above sea level, where it is known. */
  readonly altitude: number | null;
  /** Milliseconds since the epoch. */
  readonly timestamp: number;
}

export interface LocationSource {
  /** Starts producing fixes into `onFix`. Returns the function that stops it. */
  start(onFix: (fix: LocationFix) => void): () => void;
}
