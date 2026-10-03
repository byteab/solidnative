import { createComponent, createContext, useContext, type Accessor } from 'solid-js';
import { ColorScheme, useService, type Scheme } from '@solidnative/device/solid';
import type { HostChild } from '@solidnative/platform/solid';
import type { NativeHeaderProps } from './native-header.ts';
import type { TabAppearance } from './tab-appearance.ts';

export type SchemeDefaults<T> = T | ((scheme: Scheme) => T);
export type HeaderDefaults = Omit<NativeHeaderProps, 'children' | 'testID' | 'title'>;
export interface TabDefaults {
  readonly tintColor?: string | number;
  readonly backgroundColor?: string | number;
  readonly colorScheme?: 'inherit' | 'light' | 'dark';
  readonly standardAppearance?: TabAppearance;
  readonly scrollEdgeAppearance?: TabAppearance;
}
export interface NativeBarDefaultsProps {
  readonly header?: SchemeDefaults<HeaderDefaults>;
  readonly tabs?: SchemeDefaults<TabDefaults>;
  readonly children?: HostChild;
}
interface BarDefaults {
  readonly header: Accessor<HeaderDefaults>;
  readonly tabs: Accessor<TabDefaults>;
}
const Context = createContext<BarDefaults>();
export const DEFAULT_HEADER_PALETTE = Object.freeze({
  light: Object.freeze({ background: 'rgb(255, 255, 255)', foreground: 'rgb(10, 10, 10)' }),
  dark: Object.freeze({ background: 'rgb(10, 10, 10)', foreground: 'rgb(250, 250, 250)' }),
});
const resolve = <T>(value: SchemeDefaults<T> | undefined, scheme: Scheme): T | undefined =>
  typeof value === 'function' ? (value as (scheme: Scheme) => T)(scheme) : value;

export function useNativeBarDefaults(): BarDefaults {
  const context = useContext(Context);
  if (context) return context;
  const scheme = useService(ColorScheme);
  return {
    header: () => {
      const colors = DEFAULT_HEADER_PALETTE[scheme.current()];
      return {
        backgroundColor: colors.background,
        titleColor: colors.foreground,
        largeTitleColor: colors.foreground,
        color: colors.foreground,
      };
    },
    tabs: () => ({}),
  };
}

/** Reactive app defaults; explicitly set call-site props take precedence. */
export function NativeBarDefaults(props: NativeBarDefaultsProps): HostChild {
  const inherited = useNativeBarDefaults();
  const scheme = useService(ColorScheme);
  const value: BarDefaults = {
    header: () => ({ ...inherited.header(), ...resolve(props.header, scheme.current()) }),
    tabs: () => ({ ...inherited.tabs(), ...resolve(props.tabs, scheme.current()) }),
  };
  const Provider = Context.Provider as (props: {
    value: BarDefaults;
    children: HostChild;
  }) => HostChild;
  const createHostComponent = createComponent as <P>(
    component: (props: P) => HostChild,
    props: P,
  ) => HostChild;
  return createHostComponent(Provider, {
    value,
    get children() {
      return props.children;
    },
  });
}
