import { getOwner, onCleanup } from 'solid-js';
import { reactNative, type ReactNative } from '../react-native.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface DeepLinkSource {
  launchUrl(): Promise<string | null>;
  subscribe(listener: (url: string) => void): () => void;
  open(url: string): void;
}

export function deepLinkSource(
  native: Pick<ReactNative, 'Linking'> | null = reactNative(),
): DeepLinkSource {
  if (!native)
    return { launchUrl: () => Promise.resolve(null), subscribe: () => () => {}, open: () => {} };
  return {
    launchUrl: () => native.Linking.getInitialURL(),
    subscribe(listener) {
      const subscription = native.Linking.addEventListener('url', ({ url }) => listener(url));
      return () => subscription.remove();
    },
    open: (url) => void native.Linking.openURL(url).catch(() => {}),
  };
}

const HAS_HOST = new Set(['http', 'https', 'exp', 'exps']);

/** Strip native/web prefixes without mistaking a custom-scheme path for a host. */
export function pathOf(url: string | null): string | null {
  if (!url) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(url);
  const rest = scheme ? url.slice(scheme[0].length) : url;
  const expoGo = rest.indexOf('/--/');
  if (expoGo !== -1) return rest.slice(expoGo + 3);
  if (rest.split(/[/?#]/, 1)[0] === 'expo-development-client') return null;
  if (HAS_HOST.has(scheme?.[1]?.toLowerCase() ?? '')) {
    const end = rest.search(/[/?#]/);
    if (end === -1) return '/';
    return rest[end] === '/' ? rest.slice(end) : `/${rest.slice(end)}`;
  }
  return rest.startsWith('/') ? rest : `/${rest}`;
}

export interface DeepLinks {
  /** Settles even when the initial native URL read fails. */
  readonly ready: Promise<void>;
  /** A launch/link path received before the router subscribed, if any. */
  initialUrl(): string | null;
  /** Future paths only. Read initialUrl during startup to avoid replaying a consumed path. */
  subscribe(listener: (path: string) => void): () => void;
  open(url: string): void;
}

const SOURCE = createServiceToken('native.deepLinkSource', deepLinkSource);
export const DeepLinks = Object.freeze({
  ...createServiceToken<DeepLinks>('native.deepLinks', () => {
    const source = useService(SOURCE);
    const listeners = new Set<(path: string) => void>();
    let active = true;
    let heard = false;
    let initial: string | null = null;
    let unsubscribe: (() => void) | undefined;
    onCleanup(() => {
      active = false;
      listeners.clear();
      unsubscribe?.();
    });
    const emit = (path: string) => {
      if (!active) return;
      if (!listeners.size) initial = path;
      for (const listener of [...listeners]) {
        if (!active || !listeners.has(listener)) continue;
        try {
          listener(path);
        } catch (error) {
          try {
            console.error('[native-solid] deep link listener', error);
          } catch {
            // A failed consumer/reporter cannot strand another root's link subscription.
          }
        }
      }
    };
    // Subscribe before requesting startup state: a live URL wins over its older result.
    unsubscribe = source.subscribe((url) => {
      const path = pathOf(url);
      if (!active || !path) return;
      heard = true;
      emit(path);
    });
    if (!active) unsubscribe();
    let ready: Promise<void>;
    try {
      ready = Promise.resolve(source.launchUrl()).then(
        (url) => {
          if (!active || heard) return;
          const path = pathOf(url);
          if (path && path !== '/') emit(path);
        },
        () => {},
      );
    } catch {
      ready = Promise.resolve();
    }
    return {
      ready,
      initialUrl: () => initial,
      subscribe(listener) {
        if (!active) return () => {};
        // Each registration is independent, including two registrations of one callback.
        const bound = (path: string) => listener(path);
        listeners.add(bound);
        const stop = () => {
          listeners.delete(bound);
        };
        if (getOwner()) onCleanup(stop);
        return stop;
      },
      open: (url) => {
        if (active) source.open(url);
      },
    };
  }),
  SOURCE,
});

export const Linking = DeepLinks;
export type Linking = DeepLinks;
