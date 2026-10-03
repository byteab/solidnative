import { claimHost, type HostNode } from '@solidnative/fabric';
import {
  createHostElement,
  insertHostChildren,
  spreadHostProps,
} from '@solidnative/platform/solid';
import { createNativeRef, hostProps, type ViewProps } from '@solidnative/components/solid';

export function viewProps(props: ViewProps, omit: readonly string[] = []): Record<string, unknown> {
  return hostProps(props, {}, omit);
}
export function nativeView(
  name: string,
  props: ViewProps,
  mapped: () => Record<string, unknown> = () => viewProps(props),
): HostNode {
  const node = createHostElement(name);
  claimHost(node);
  spreadHostProps(node, mapped, true);
  insertHostChildren(node, () => props.children);
  props.ref?.(createNativeRef(node));
  return node;
}
