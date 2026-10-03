import { getOwner, onCleanup } from 'solid-js';
import { reactNative, type ReactNative } from '../react-native.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface HardwareBackSource {
  subscribe(listener: () => boolean): () => void;
}

export function hardwareBackSource(
  native: Pick<ReactNative, 'BackHandler'> | null = reactNative(),
): HardwareBackSource {
  if (!native) return { subscribe: () => () => {} };
  return {
    subscribe(listener) {
      const subscription = native.BackHandler.addEventListener('hardwareBackPress', listener);
      return () => subscription.remove();
    },
  };
}

export interface HardwareBack {
  /** Most recently registered handlers run first, just as with the RN source. */
  handle(handler: () => boolean): () => void;
}

function reportCleanupError(error: unknown): void {
  try {
    console.error('[native-solid] hardware back cleanup', error);
  } catch {
    // Cleanup also survives an application replacing console.error with a reporter.
  }
}

const SOURCE = createServiceToken('native.hardwareBackSource', hardwareBackSource);
export const HardwareBack = Object.freeze({
  ...createServiceToken<HardwareBack>('native.hardwareBack', () => {
    const source = useService(SOURCE);
    const subscriptions = new Set<() => void>();
    let active = true;
    onCleanup(() => {
      active = false;
      for (const stop of subscriptions) stop();
      subscriptions.clear();
    });
    return {
      handle(handler) {
        if (!active) return () => {};
        let listening = true;
        let unsubscribe: (() => void) | undefined;
        const stop = () => {
          if (!listening) return;
          listening = false;
          subscriptions.delete(stop);
          try {
            unsubscribe?.();
          } catch (error) {
            // This disposer also belongs to a screen owner. Solid must finish its siblings.
            reportCleanupError(error);
          }
        };
        subscriptions.add(stop);
        if (getOwner()) onCleanup(stop);
        try {
          unsubscribe = source.subscribe(() => active && listening && handler());
          if (!listening) {
            try {
              unsubscribe();
            } catch (error) {
              reportCleanupError(error);
            }
          }
        } catch (error) {
          stop();
          throw error;
        }
        return stop;
      },
    };
  }),
  SOURCE,
});

/** Familiar platform spelling; both names identify the same scoped service. */
export const BackHandler = HardwareBack;
export type BackHandler = HardwareBack;
