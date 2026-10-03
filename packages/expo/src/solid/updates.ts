import { createSignal, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';

export interface NativeUpdates {
  readonly enabled: boolean;
  check(): Promise<{ isAvailable: boolean }>;
  fetch(): Promise<{ isNew: boolean }>;
  reload(): Promise<void>;
}
export type UpdateState = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
export interface Updates {
  readonly state: Accessor<UpdateState>;
  readonly error: Accessor<unknown>;
  readonly ready: Accessor<boolean>;
  readonly enabled: boolean;
  check(): Promise<boolean>;
  apply(): Promise<void>;
}
export const Updates = sourcedService<Updates, NativeUpdates | null>(
  'expo.updates',
  () => {
    const expo = expoModule(
      'expo-updates',
      () => require('expo-updates') as typeof import('expo-updates'),
    );
    if (!expo) return null;
    return {
      enabled: expo.isEnabled,
      check: async () => ({ isAvailable: (await expo.checkForUpdateAsync()).isAvailable }),
      fetch: async () => ({ isNew: (await expo.fetchUpdateAsync()).isNew }),
      reload: () => expo.reloadAsync(),
    };
  },
  (native) => {
    const requests = ownedRequests();
    const [snapshot, publish] = createSignal<{ state: UpdateState; error: unknown }>({
      state: 'idle',
      error: null,
    });
    let revision = 0;
    let applying = false;
    return {
      state: () => snapshot().state,
      error: () => snapshot().error,
      ready: () => snapshot().state === 'ready',
      get enabled() {
        return native?.enabled ?? false;
      },
      check: () => {
        const request = ++revision;
        if (!native) return Promise.resolve(false);
        return requests
          .run(false, async (alive) => {
            const current = () => alive() && revision === request;
            if (!native.enabled || !current()) return false;
            try {
              publish({ state: 'checking', error: null });
              if (!current()) return false;
              const { isAvailable } = await native.check();
              if (!current()) return false;
              if (!isAvailable) {
                publish({ state: 'idle', error: null });
                return false;
              }
              publish({ state: 'downloading', error: null });
              if (!current()) return false;
              const { isNew } = await native.fetch();
              if (!current()) return false;
              publish({ state: isNew ? 'ready' : 'idle', error: null });
              return current() && isNew;
            } catch (error) {
              if (current()) publish({ state: 'error', error });
              return false;
            }
          })
          .then((ready) => {
            // A caller computation can end while the app-scoped service remains alive.
            if (
              requests.active() &&
              revision === request &&
              !ready &&
              ['checking', 'downloading'].includes(snapshot().state)
            ) {
              publish({ state: 'idle', error: null });
            }
            return ready && requests.active() && revision === request;
          });
      },
      apply: () =>
        requests.run(undefined, async (alive) => {
          if (applying || snapshot().state !== 'ready' || !alive()) return;
          const enabled = native?.enabled;
          if (!enabled || !alive() || snapshot().state !== 'ready') return;
          applying = true;
          try {
            await native.reload();
          } finally {
            applying = false;
          }
        }),
    };
  },
);
