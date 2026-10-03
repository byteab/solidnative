import type { HostNode } from '@solid-native/fabric';
import { insertHostChildren, spreadHostProps } from '@solid-native/platform/solid';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { ViewProps } from './types.ts';

export interface InputAccessoryViewProps extends ViewProps {
  backgroundColor?: string;
}
export function InputAccessoryView(props: InputAccessoryViewProps): HostNode {
  const node = primitiveNode('input-accessory-view');
  spreadHostProps(
    node,
    () => ({ ...hostProps(props), style: [props.style, { position: 'absolute' }] }),
    true,
  );
  insertHostChildren(node, () => props.children);
  props.ref?.(createNativeRef(node));
  return node;
}
