import { createMemo, onCleanup, type Accessor } from 'solid-js';
import { createObserved, type ObservedSource } from '@solid-native/device/solid';
import { expoModule } from '../native.ts';
import { observedFrom } from './observed.ts';
import { callerCleanup, mutationQueue, sourcedService } from './owned.ts';
export type Orientation =
  'unknown' | 'portrait' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right';

/** What a screen may rotate to. `default` is portrait plus, on a phone, nothing else. */
export type OrientationLock = 'default' | 'all' | 'portrait' | 'landscape';

export interface OrientationSource {
  readonly reported: ObservedSource<Orientation> | null;
  lock(lock: OrientationLock): Promise<void>;
  unlock(): Promise<void>;
}

const NOTHING: OrientationSource = {
  reported: null,
  lock: () => Promise.resolve(),
  unlock: () => Promise.resolve(),
};

export interface DeviceOrientation {
  readonly orientation: Accessor<Orientation>;
  readonly landscape: Accessor<boolean>;
  readonly error: Accessor<Error | null>;
  lock(lock: OrientationLock): () => void;
}
export const DeviceOrientation = sourcedService<DeviceOrientation, OrientationSource>(
  'expo.orientation',
  () => {
    const expo = expoModule(
      'expo-screen-orientation',
      () => require('expo-screen-orientation') as typeof import('expo-screen-orientation'),
    );
    if (!expo) return NOTHING;

    const ORIENTATIONS: Record<number, Orientation> = {
      [expo.Orientation.UNKNOWN]: 'unknown',
      [expo.Orientation.PORTRAIT_UP]: 'portrait',
      [expo.Orientation.PORTRAIT_DOWN]: 'portrait-upside-down',
      [expo.Orientation.LANDSCAPE_LEFT]: 'landscape-left',
      [expo.Orientation.LANDSCAPE_RIGHT]: 'landscape-right',
    };
    const LOCKS: Record<OrientationLock, import('expo-screen-orientation').OrientationLock> = {
      default: expo.OrientationLock.DEFAULT,
      all: expo.OrientationLock.ALL,
      portrait: expo.OrientationLock.PORTRAIT,
      landscape: expo.OrientationLock.LANDSCAPE,
    };

    return {
      reported: observedFrom(
        async () => ORIENTATIONS[await expo.getOrientationAsync()] ?? 'unknown',
        (listener) =>
          expo.addOrientationChangeListener(({ orientationInfo }) =>
            listener(ORIENTATIONS[orientationInfo.orientation] ?? 'unknown'),
          ),
      ),
      lock: (lock) => expo.lockAsync(LOCKS[lock]),
      unlock: () => expo.unlockAsync(),
    };
  },
  (source) => {
    let active = true;
    let revision = 0;
    const queue = mutationQueue(() => active);
    const locks: { lock: OrientationLock }[] = [];
    onCleanup(() => {
      active = false;
      ++revision;
      if (locks.length) {
        locks.length = 0;
        void queue.run(() => source.unlock());
      }
    });
    const orientation = createObserved(source.reported, 'unknown');
    const apply = () => {
      const request = ++revision;
      const current = locks.at(-1);
      void queue.run(() => {
        if (request !== revision) return;
        return current && active ? source.lock(current.lock) : source.unlock();
      });
    };
    return {
      orientation,
      landscape: createMemo(() => orientation().startsWith('landscape')),
      error: queue.error,
      lock(lock) {
        if (!active) return () => {};
        const entry = { lock };
        const release = () => {
          const index = locks.indexOf(entry);
          if (index < 0) return;
          locks.splice(index, 1);
          if (index === locks.length) apply();
        };
        locks.push(entry);
        callerCleanup(release);
        apply();
        return release;
      },
    };
  },
);
