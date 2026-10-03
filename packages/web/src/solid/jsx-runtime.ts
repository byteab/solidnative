import type { HostNode } from '@solid-native/fabric';
import type { HostChild } from './context.ts';
export namespace JSX {
  export type Element = HostChild;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface HostProps {
    children?: HostChild;
    ref?: HostNode | ((node: HostNode) => void);
    class?: string;
    classList?: Record<string, boolean | undefined>;
    style?: Record<string, unknown> | readonly unknown[] | null;
    nativeID?: string;
    testID?: string;
    onLayout?: (event: unknown) => void;
  }
  export interface IntrinsicElements {
    view: HostProps;
    text: HostProps;
  }
}
