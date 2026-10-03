import { useHostAdapter, type HostChild } from '@solidnative/platform/solid';
import type { HostNode } from '@solidnative/fabric';

export type HeaderItemType = 'back' | 'left' | 'center' | 'title' | 'right' | 'searchBar';
export interface NativeHeaderItemProps {
  readonly type?: HeaderItemType;
  readonly hidesSharedBackground?: boolean;
  readonly children?: HostChild;
}

/** Native header slots retain normal host children and responder behavior. */
export function NativeHeaderItem(props: NativeHeaderItemProps): HostNode {
  const adapter = useHostAdapter();
  const node = adapter.createElement('native-header-item');
  adapter.spreadProps(
    node,
    () => ({ type: props.type, hidesSharedBackground: props.hidesSharedBackground }),
    true,
  );
  adapter.insertChildren(node, () => props.children);
  return node;
}
