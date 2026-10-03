import { createMemo } from 'solid-js';
import { nativePlatform, type HostNode } from '@solidnative/fabric';
import { spreadHostProps } from '@solidnative/platform/solid';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { ViewProps } from './types.ts';

export interface ActivityIndicatorProps extends Omit<ViewProps, 'children'> {
  /** Named sizes are 20 and 36 points; a number sets both dimensions. */
  size?: 'small' | 'large' | number;
  animating?: boolean;
  color?: string;
  /** iOS: hide the indicator when its animation stops. */
  hidesWhenStopped?: boolean;
}

/** A direct native spinner with an explicit box so it cannot swallow surrounding touches. */
export function ActivityIndicator(props: ActivityIndicatorProps): HostNode {
  const node = primitiveNode('activity-indicator');
  const android = nativePlatform() === 'android';
  const normalizedSize = createMemo(() => props.size ?? 'small');
  spreadHostProps(
    node,
    () => {
      const size = normalizedSize();
      const dimension = typeof size === 'number' ? size : size === 'large' ? 36 : 20;
      return {
        ...hostProps(props, {}, ['size']),
        style: [{ width: dimension, height: dimension }, props.style],
        size: size === 'large' ? 'large' : 'small',
        animating: props.animating ?? true,
        hidesWhenStopped: props.hidesWhenStopped ?? true,
        // Android requires these at the first commit, even when the spinner is stopped.
        styleAttr: android ? 'Normal' : undefined,
        indeterminate: android ? true : undefined,
      };
    },
    true,
  );
  props.ref?.(createNativeRef(node));
  return node;
}
