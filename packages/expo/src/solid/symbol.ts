import type { ViewProps } from '@solidnative/components/solid';
import type { HostNode } from '@solidnative/fabric';
import { registerExpoViews } from '../register-expo-view.ts';
import { nativeView, viewProps } from './view.ts';
export type SymbolType = 'monochrome' | 'hierarchical' | 'palette' | 'multicolor';
export type SymbolScale = 'default' | 'unspecified' | 'small' | 'medium' | 'large';
export type SymbolWeight =
  | 'unspecified'
  | 'ultraLight'
  | 'thin'
  | 'light'
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'heavy'
  | 'black';
export type SymbolResizeMode =
  | 'scaleToFill'
  | 'scaleAspectFit'
  | 'scaleAspectFill'
  | 'redraw'
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight';

/** How a symbol animates, as `expo-symbols` describes it. */
export interface SymbolAnimationSpec {
  readonly effect?: {
    readonly type: 'bounce' | 'pulse' | 'scale';
    readonly wholeSymbol?: boolean;
    readonly direction?: 'up' | 'down';
  };
  readonly repeating?: boolean;
  readonly repeatCount?: number;
  readonly speed?: number;
  readonly variableAnimationSpec?: Readonly<Record<string, boolean>>;
}

export interface ExpoSymbolProps extends Omit<ViewProps, 'children'> {
  name: string;
  type?: SymbolType;
  scale?: SymbolScale;
  weight?: SymbolWeight;
  tintColor?: string;
  colors?: string | readonly string[];
  resizeMode?: SymbolResizeMode;
  animationSpec?: SymbolAnimationSpec;
  size?: number;
}
export function ExpoSymbol(props: ExpoSymbolProps): HostNode {
  registerExpoViews('expo-symbol');
  return nativeView('expo-symbol', props, () => ({
    ...viewProps(props, ['size']),
    type: props.type ?? 'monochrome',
    colors: typeof props.colors === 'string' ? [props.colors] : props.colors,
    animated: props.animationSpec !== undefined,
    style: [props.style, { width: props.size ?? 24, height: props.size ?? 24 }],
  }));
}
