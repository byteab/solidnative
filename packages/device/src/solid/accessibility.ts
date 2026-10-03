import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js';
import { reactNative, type ReactNative } from '../react-native.ts';
import { nativeSubscriptions } from './native-subscriptions.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface AccessibilitySettings {
  readonly screenReader: boolean;
  readonly reduceMotion: boolean;
  readonly boldText: boolean;
  readonly fontScale: number;
}

export interface AccessibilitySource {
  current(): AccessibilitySettings | PromiseLike<AccessibilitySettings>;
  subscribe(listener: (settings: Partial<AccessibilitySettings>) => void): () => void;
  announce(message: string): void;
}

const DEFAULTS: AccessibilitySettings = {
  screenReader: false,
  reduceMotion: false,
  boldText: false,
  fontScale: 1,
};

export function accessibilitySource(
  native: Pick<ReactNative, 'AccessibilityInfo' | 'AppState' | 'PixelRatio'> | null = reactNative(),
): AccessibilitySource {
  if (!native) return { current: () => DEFAULTS, subscribe: () => () => {}, announce: () => {} };
  const info = native.AccessibilityInfo;
  return {
    current: async () => {
      const [screenReader, reduceMotion, boldText] = await Promise.all([
        info.isScreenReaderEnabled(),
        info.isReduceMotionEnabled(),
        info.isBoldTextEnabled(),
      ]);
      return { screenReader, reduceMotion, boldText, fontScale: native.PixelRatio.getFontScale() };
    },
    subscribe(listener) {
      return nativeSubscriptions([
        () =>
          info.addEventListener('screenReaderChanged', (screenReader) =>
            listener({ screenReader }),
          ),
        () =>
          info.addEventListener('reduceMotionChanged', (reduceMotion) =>
            listener({ reduceMotion }),
          ),
        () => info.addEventListener('boldTextChanged', (boldText) => listener({ boldText })),
        () =>
          native.AppState.addEventListener('change', (state) => {
            if (state === 'active') listener({ fontScale: native.PixelRatio.getFontScale() });
          }),
      ]);
    },
    announce: (message) => info.announceForAccessibility(message),
  };
}

export interface Accessibility {
  readonly screenReader: Accessor<boolean>;
  readonly reduceMotion: Accessor<boolean>;
  readonly boldText: Accessor<boolean>;
  readonly fontScale: Accessor<number>;
  announce(message: string): void;
}

const SOURCE = createServiceToken('native.accessibilitySource', accessibilitySource);
export const Accessibility = Object.freeze({
  ...createServiceToken<Accessibility>('native.accessibility', () => {
    const source = useService(SOURCE);
    const [settings, setSettings] = createSignal(DEFAULTS);
    const changed = new Set<keyof AccessibilitySettings>();
    let active = true;
    let unsubscribe: (() => void) | undefined;
    onCleanup(() => {
      active = false;
      unsubscribe?.();
    });
    unsubscribe = source.subscribe((change) => {
      if (!active) return;
      for (const key of Object.keys(change) as (keyof AccessibilitySettings)[]) changed.add(key);
      setSettings((current) => ({ ...current, ...change }));
    });
    if (!active) unsubscribe();
    const accept = (snapshot: AccessibilitySettings) => {
      if (!active) return;
      setSettings((current) => ({
        screenReader: changed.has('screenReader') ? current.screenReader : snapshot.screenReader,
        reduceMotion: changed.has('reduceMotion') ? current.reduceMotion : snapshot.reduceMotion,
        boldText: changed.has('boldText') ? current.boldText : snapshot.boldText,
        fontScale: changed.has('fontScale') ? current.fontScale : snapshot.fontScale,
      }));
    };
    try {
      const first = source.current();
      if ('then' in first) void Promise.resolve(first).then(accept, () => {});
      else accept(first);
    } catch {
      // Native startup failures retain defaults and live event updates.
    }
    return {
      screenReader: createMemo(() => settings().screenReader),
      reduceMotion: createMemo(() => settings().reduceMotion),
      boldText: createMemo(() => settings().boldText),
      fontScale: createMemo(() => settings().fontScale),
      announce: (message) => {
        if (active) source.announce(message);
      },
    };
  }),
  SOURCE,
});
