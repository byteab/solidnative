import type { ViewProps } from '@solidnative/components/solid';
import type { HostNode } from '@solidnative/fabric';
import { registerExpoViews } from '../register-expo-view.ts';
import { optional } from '../native.ts';
import { nativeView } from './view.ts';
export type GlassStyle = 'regular' | 'clear' | 'none';

/** A style, and whether a change to it animates. */
export interface GlassEffectStyleConfig {
  readonly style: GlassStyle;
  readonly animate?: boolean;
  /** Seconds. */
  readonly animationDuration?: number;
}

export interface ExpoGlassProps extends ViewProps {
  glassEffectStyle?: GlassStyle | GlassEffectStyleConfig;
  tintColor?: string;
  isInteractive?: boolean;
  colorScheme?: 'auto' | 'light' | 'dark';
}
export interface ExpoGlassContainerProps extends ViewProps {
  spacing?: number;
}
export function ExpoGlass(props: ExpoGlassProps): HostNode {
  registerExpoViews('expo-glass');
  return nativeView('expo-glass', props);
}
export function ExpoGlassContainer(props: ExpoGlassContainerProps): HostNode {
  registerExpoViews('expo-glass-container');
  return nativeView('expo-glass-container', props);
}
type GlassModule = { isLiquidGlassAvailable?: unknown };
export function liquidGlassAvailable(): boolean {
  const modules = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules;
  // `globalThis.expo` only exists once expo-modules-core has installed it, which nothing may have
  // done yet when the first screen renders; asking expo-modules-core installs it.
  const glass = (modules?.['ExpoGlassEffect'] ??
    optional(() =>
      (
        require('expo-modules-core') as typeof import('expo-modules-core')
      ).requireOptionalNativeModule('ExpoGlassEffect'),
    )) as GlassModule | null | undefined;
  return glass?.isLiquidGlassAvailable === true;
}
