import { createMemo, type Accessor } from 'solid-js';
import { reactNative, type ReactNative } from '../react-native.ts';
import { createObserved } from './observed.ts';
import { createServiceToken, useService } from './service-scope.ts';

export type AppStatus = 'active' | 'background' | 'inactive';

export interface AppStateSource {
  current(): AppStatus | PromiseLike<AppStatus>;
  subscribe(listener: (state: AppStatus) => void): () => void;
}

const known = (state: string | null): AppStatus =>
  state === 'background' || state === 'inactive' ? state : 'active';

export function appStateSource(
  native: Pick<ReactNative, 'AppState'> | null = reactNative(),
): AppStateSource {
  if (!native) return { current: () => 'active', subscribe: () => () => {} };
  return {
    current: () => known(native.AppState.currentState),
    subscribe(listener) {
      const subscription = native.AppState.addEventListener('change', (state) =>
        listener(known(state)),
      );
      return () => subscription.remove();
    },
  };
}

export interface AppState {
  readonly current: Accessor<AppStatus>;
  /** True only while the app is in front and taking input. */
  readonly active: Accessor<boolean>;
}

const SOURCE = createServiceToken('native.appStateSource', appStateSource);
export const AppState = Object.freeze({
  ...createServiceToken<AppState>('native.appState', () => {
    const current = createObserved(useService(SOURCE), 'active');
    return { current, active: createMemo(() => current() === 'active') };
  }),
  SOURCE,
});
