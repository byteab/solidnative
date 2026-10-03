import { untrack } from 'solid-js';
import type { HostNode } from '@solid-native/fabric';
import { insertHostChildren, spreadHostProps } from '@solid-native/platform/solid';
import { Image, type ImageProps } from './image.ts';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { NativeStyle, ViewProps } from './types.ts';

export interface ImageBackgroundProps
  extends
    ViewProps,
    Pick<
      ImageProps,
      'source' | 'defaultSource' | 'resizeMode' | 'blurRadius' | 'tintColor' | 'alt'
    > {
  imageStyle?: NativeStyle;
}
export function flattenStyle(style: NativeStyle | undefined): Record<string, unknown> {
  if (Array.isArray(style))
    return Object.assign({}, ...style.map((value) => flattenStyle(value as NativeStyle)));
  return style && typeof style === 'object' ? (style as Record<string, unknown>) : {};
}
export function ImageBackground(props: ImageBackgroundProps): HostNode {
  const node = primitiveNode('view');
  spreadHostProps(
    node,
    () =>
      hostProps(props, {}, [
        'source',
        'defaultSource',
        'resizeMode',
        'blurRadius',
        'tintColor',
        'alt',
        'imageStyle',
      ]),
    true,
  );
  const image = untrack(() =>
    Image({
      get source() {
        return props.source;
      },
      get defaultSource() {
        return props.defaultSource;
      },
      get resizeMode() {
        return props.resizeMode ?? 'cover';
      },
      get blurRadius() {
        return props.blurRadius;
      },
      get tintColor() {
        return props.tintColor;
      },
      get alt() {
        return props.alt;
      },
      accessibilityIgnoresInvertColors: true,
      get style() {
        const outer = flattenStyle(props.style);
        return [
          {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            width: outer['width'] ?? '100%',
            height: outer['height'] ?? '100%',
          },
          props.imageStyle,
        ];
      },
    }),
  );
  insertHostChildren(node, () => [image, props.children]);
  props.ref?.(createNativeRef(node));
  return node;
}
