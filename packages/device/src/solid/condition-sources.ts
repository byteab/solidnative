import { reactNative, type ReactNative } from '../react-native.ts';
import { colorSchemeSource, type ColorSchemeSource } from './color-scheme.ts';

export interface Size {
  readonly width: number;
  readonly height: number;
}
export interface Sizes {
  readonly window: Size;
  readonly screen: Size;
}
export interface ScreenSource {
  current(): Sizes;
  subscribe(listener: (sizes: Sizes) => void): () => void;
}
export interface ConditionSettings {
  readonly reduceMotion: boolean;
  readonly fontScale: number;
}
export interface ConditionSettingsSource {
  current(): ConditionSettings | PromiseLike<ConditionSettings>;
  subscribe(listener: (change: Partial<ConditionSettings>) => void): () => void;
}
export interface ConditionSources {
  readonly screen: ScreenSource;
  readonly colors: ColorSchemeSource;
  readonly settings: ConditionSettingsSource;
  readonly fontScale: () => number;
}

export function screenSource(
  native: Pick<ReactNative, 'Dimensions'> | null = reactNative(),
): ScreenSource {
  return {
    current: () => ({
      window: native?.Dimensions.get('window') ?? { width: 0, height: 0 },
      screen: native?.Dimensions.get('screen') ?? { width: 0, height: 0 },
    }),
    subscribe(listener) {
      const subscription = native?.Dimensions.addEventListener('change', listener);
      return () => subscription?.remove();
    },
  };
}

/** Only the two accessibility settings consumed by CSS, without importing a React wrapper. */
export function conditionSettingsSource(
  native: Pick<ReactNative, 'AccessibilityInfo' | 'AppState' | 'PixelRatio'> | null = reactNative(),
): ConditionSettingsSource {
  return {
    current: async () => ({
      reduceMotion: (await native?.AccessibilityInfo.isReduceMotionEnabled()) ?? false,
      fontScale: native?.PixelRatio.getFontScale() ?? 1,
    }),
    subscribe(listener) {
      const motion = native?.AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (reduceMotion) => listener({ reduceMotion }),
      );
      let foreground: { remove(): void } | undefined;
      try {
        foreground = native?.AppState.addEventListener('change', (state) => {
          if (state === 'active') listener({ fontScale: native.PixelRatio.getFontScale() });
        });
      } catch (error) {
        try {
          motion?.remove();
        } catch {
          /* Preserve the setup failure. */
        }
        throw error;
      }
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const errors: unknown[] = [];
        for (const subscription of [motion, foreground]) {
          try {
            subscription?.remove();
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length) throw new AggregateError(errors, 'Condition settings cleanup failed.');
      };
    },
  };
}

export function conditionSources(): ConditionSources {
  return {
    screen: screenSource(),
    colors: colorSchemeSource(),
    settings: conditionSettingsSource(),
    fontScale: () => reactNative()?.PixelRatio.getFontScale() ?? 1,
  };
}
