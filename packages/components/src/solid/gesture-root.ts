import type { HostNode } from '@solidnative/fabric';
import { nativePlatform, registerViewName } from '@solidnative/fabric';
import { insertHostChildren, spreadHostProps } from '@solidnative/platform/solid';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { ViewProps } from './types.ts';

export function GestureRoot(props: ViewProps): HostNode {
  registerViewName(
    'gesture-root',
    nativePlatform() === 'android' ? 'RNGestureHandlerRootView' : 'RCTView',
    { flex: 1 },
  );
  const node = primitiveNode('gesture-root');
  spreadHostProps(node, () => hostProps(props), true);
  insertHostChildren(node, () => props.children);
  props.ref?.(createNativeRef(node));
  return node;
}
