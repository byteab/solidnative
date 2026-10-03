import type { ViewProps } from '@solidnative/components/solid';
import type { NativeSyntheticEvent, HostNode } from '@solidnative/fabric';
import { registerExpoViews } from '../register-expo-view.ts';
import { nativeView, viewProps } from './view.ts';
export interface ExpoImageSource {
  readonly uri?: string;
  readonly width?: number;
  readonly height?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly cacheKey?: string;
}

export type ExpoImageContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

export interface ExpoImageProps extends Omit<ViewProps, 'children'> {
  source?: readonly ExpoImageSource[] | ExpoImageSource | number;
  placeholder?: readonly ExpoImageSource[] | ExpoImageSource | number;
  contentFit?: ExpoImageContentFit;
  contentPosition?: string | Readonly<Record<string, number | string>>;
  transition?: number | { readonly duration?: number; readonly effect?: string };
  blurRadius?: number;
  tintColor?: string;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  priority?: 'low' | 'normal' | 'high';
  recyclingKey?: string;
  onLoad?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void;
  onError?: (event: NativeSyntheticEvent<{ readonly error: string }>) => void;
}
export function ExpoImage(props: ExpoImageProps): HostNode {
  registerExpoViews('expo-image');
  return nativeView('expo-image', props, () => ({
    ...viewProps(props),
    source:
      typeof props.source === 'object' && !Array.isArray(props.source)
        ? [props.source]
        : props.source,
    placeholder:
      typeof props.placeholder === 'object' && !Array.isArray(props.placeholder)
        ? [props.placeholder]
        : props.placeholder,
  }));
}
