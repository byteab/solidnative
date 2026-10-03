import type { EngineNode, ResponderHandlers } from '@solidnative/fabric';
import type { NativeChild } from './root.ts';

/** Initial raw native host types; semantic primitives are migrated separately. */
export namespace JSX {
  export type Element = NativeChild;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface NativeProps {
    children?: NativeChild;
    ref?: EngineNode | ((node: EngineNode) => void);
    class?: string;
    classList?: Record<string, boolean | undefined>;
    style?: Record<string, unknown> | readonly unknown[] | null;
    nativeID?: string;
    testID?: string;
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    pointerEvents?: 'auto' | 'none' | 'box-only' | 'box-none';
    responder?: ResponderHandlers;
    onTouchStart?: (event: unknown) => void;
    onTouchEnd?: (event: unknown) => void;
    onLayout?: (event: unknown) => void;
  }
  export interface IntrinsicElements {
    view: NativeProps;
    text: NativeProps & { numberOfLines?: number; selectable?: boolean };
  }
}
