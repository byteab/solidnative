import { onCleanup, type Accessor } from 'solid-js';
import { reactNative, type ReactNative } from '../react-native.ts';
import { createObserved } from './observed.ts';
import { createServiceToken, useService } from './service-scope.ts';

export type Scheme = 'light' | 'dark';

export interface ColorSchemeSource {
  current(): Scheme;
  subscribe(listener: (scheme: Scheme) => void): () => void;
  set?(scheme: Scheme | null): void;
}

/** Loading this entry does not load React Native. Only the default source factory does. */
export function colorSchemeSource(
  native: Pick<ReactNative, 'Appearance'> | null = reactNative(),
): ColorSchemeSource {
  if (!native) return { current: () => 'light', subscribe: () => () => {} };
  const read = (): Scheme => (native.Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
  return {
    current: read,
    subscribe(listener) {
      const subscription = native.Appearance.addChangeListener(() => listener(read()));
      return () => subscription.remove();
    },
    set: (scheme) => native.Appearance.setColorScheme?.(scheme ?? 'unspecified'),
  };
}

export interface ColorScheme {
  readonly current: Accessor<Scheme>;
  set(scheme: Scheme | null): void;
}

const SOURCE = createServiceToken('native.colorSchemeSource', colorSchemeSource);
export const ColorScheme = Object.freeze({
  ...createServiceToken<ColorScheme>('native.colorScheme', () => {
    const source = useService(SOURCE);
    const current = createObserved(source, 'light');
    let active = true;
    onCleanup(() => {
      active = false;
    });
    return {
      current,
      set: (scheme) => {
        if (active) source.set?.(scheme);
      },
    };
  }),
  SOURCE,
});
