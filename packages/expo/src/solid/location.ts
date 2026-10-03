import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { callerCleanup, ownedRequests, silence, sourcedService } from './owned.ts';
import { Permission, type PermissionResponse } from './permissions.ts';

export type LocationAccuracy = 'lowest' | 'low' | 'balanced' | 'high' | 'highest' | 'navigation';
const ACCURACY: Record<LocationAccuracy, number> = {
  lowest: 1,
  low: 2,
  balanced: 3,
  high: 4,
  highest: 5,
  navigation: 6,
};
export interface Position {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude: number | null;
  readonly accuracy: number | null;
  readonly heading: number | null;
  readonly speed: number | null;
  readonly timestamp: number;
}
export interface WatchOptions {
  readonly accuracy?: LocationAccuracy;
  readonly distance?: number;
  readonly interval?: number;
}
export interface LocationFix {
  coords: Omit<Position, 'timestamp'>;
  timestamp: number;
}
export interface LocationOptions {
  accuracy?: number;
  distanceInterval?: number;
  timeInterval?: number;
}
export interface NativeLocation {
  getForegroundPermissionsAsync(): Promise<PermissionResponse>;
  requestForegroundPermissionsAsync(): Promise<PermissionResponse>;
  getCurrentPositionAsync(options?: LocationOptions): Promise<LocationFix>;
  watchPositionAsync(
    options: LocationOptions,
    callback: (fix: LocationFix) => void,
  ): Promise<{ remove(): void }>;
}
export interface Location {
  readonly permission: Permission;
  readonly position: Accessor<Position | null>;
  current(accuracy?: LocationAccuracy): Promise<Position | null>;
  start(options?: WatchOptions): Promise<() => void>;
}
const UNAVAILABLE: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
export const Location = sourcedService<Location, NativeLocation | null>(
  'expo.location',
  () => expoModule('expo-location', () => require('expo-location') as NativeLocation),
  (native) => {
    const requests = ownedRequests();
    const [position, setPosition] = createSignal<Position | null>(null);
    let revision = 0;
    const watches = new Set<() => void>();
    onCleanup(() => {
      for (const stop of [...watches]) stop();
    });
    const permission = Permission.of(
      () => native?.getForegroundPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
      () => native?.requestForegroundPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
    );
    return {
      permission,
      position,
      current: (accuracy = 'balanced') => {
        const request = ++revision;
        return requests.run<Position | null>(null, async (active) => {
          if (!native || !(await permission.ensure()) || !active()) return null;
          const value = positionOf(
            await native.getCurrentPositionAsync({ accuracy: ACCURACY[accuracy] }),
          );
          if (active() && revision === request) setPosition(value);
          return value;
        });
      },
      start: (options = {}) => {
        if (!requests.active()) return Promise.resolve(() => {});
        let live = requests.active();
        let subscription: { remove(): void } | undefined;
        const stop = () => {
          if (!live) return;
          live = false;
          watches.delete(stop);
          silence(() => subscription?.remove());
        };
        watches.add(stop);
        callerCleanup(stop);
        const expo: LocationOptions = { accuracy: ACCURACY[options.accuracy ?? 'balanced'] };
        if (options.distance !== undefined) expo.distanceInterval = options.distance;
        if (options.interval !== undefined) expo.timeInterval = options.interval;
        return requests.run<() => void>(stop, async (active) => {
          try {
            if (!native || !(await permission.ensure()) || !active() || !live) {
              stop();
              return stop;
            }
            const acquired = await native.watchPositionAsync(expo, (fix) => {
              if (!live || !requests.active()) return;
              revision++;
              setPosition(positionOf(fix));
            });
            subscription = acquired;
            if (!live || !active()) {
              live = false;
              watches.delete(stop);
              silence(() => acquired.remove());
            }
            return stop;
          } catch (error) {
            stop();
            throw error;
          }
        });
      },
    };
  },
);
function positionOf({ coords, timestamp }: LocationFix): Position {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitude: coords.altitude,
    accuracy: coords.accuracy,
    heading: coords.heading,
    speed: coords.speed,
    timestamp,
  };
}
