import { createRenderEffect, untrack } from 'solid-js';
import { nativePlatform, type HostNode } from '@solid-native/fabric';
import { spreadHostProps, useHostEngine } from '@solid-native/platform/solid';
import { primitiveNode, hostProps } from './primitive.ts';
import { commitTask, createNativeRef } from './ref.ts';
import type { ViewProps } from './types.ts';

/** Controlled native refresh indicator. Supply it through ScrollView.refreshControl. */
export interface RefreshControlProps extends Omit<ViewProps, 'children'> {
  refreshing?: boolean;
  onRefresh?: () => void;
  progressViewOffset?: number;
  tintColor?: string;
  title?: string;
  titleColor?: string;
  colors?: readonly string[];
  enabled?: boolean;
  progressBackgroundColor?: string;
  size?: 'default' | 'large';
}

export function RefreshControl(props: RefreshControlProps): HostNode {
  const node = primitiveNode('refresh-control');
  const ref = createNativeRef(node);
  const settle = commitTask(node);
  const engine = useHostEngine();
  let native = untrack(() => props.refreshing ?? false);
  let committed = native;
  const synchronize = () =>
    settle(() => {
      const desired = props.refreshing ?? false;
      // Only a committed prop change proves native received it. Transient true -> false writes
      // in one task coalesce, so an unchanged false still needs the imperative native correction.
      if (desired !== committed) native = desired;
      else if (native !== desired) engine.dispatchCommand(node, 'setNativeRefreshing', [desired]);
      committed = desired;
      native = desired;
    });
  const onRefresh = () => {
    native = true;
    try {
      props.onRefresh?.();
    } finally {
      // A declined refresh must stop even when the prop stayed false or the handler threw.
      synchronize();
    }
  };
  createRenderEffect(() => {
    props.refreshing;
    synchronize();
  });
  spreadHostProps(
    node,
    () => ({
      ...hostProps(props, {}, [
        'onRefresh',
        ...(nativePlatform() === 'android'
          ? ['tintColor', 'title', 'titleColor']
          : ['colors', 'enabled', 'progressBackgroundColor', 'size']),
      ]),
      refreshing: props.refreshing ?? false,
      onRefresh,
    }),
    true,
  );
  props.ref?.(ref);
  return node;
}

const OUTER = new Set([
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginBottom',
  'marginTop',
  'marginLeft',
  'marginRight',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'height',
  'minHeight',
  'maxHeight',
  'width',
  'minWidth',
  'maxWidth',
  'position',
  'left',
  'right',
  'bottom',
  'top',
  'transform',
  'transformOrigin',
  'rowGap',
  'columnGap',
  'gap',
]);

/** RN's splitLayoutProps over immutable, potentially nested style arrays. */
export function splitRefreshStyle(style: unknown): {
  outer: Record<string, unknown>;
  inner: Record<string, unknown>;
} {
  const flat: Record<string, unknown> = {};
  const add = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (value && typeof value === 'object') Object.assign(flat, value);
  };
  add(style);
  const outer: Record<string, unknown> = {},
    inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) (OUTER.has(key) ? outer : inner)[key] = value;
  return { outer, inner };
}
