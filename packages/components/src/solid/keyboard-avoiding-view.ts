import { createMemo, createRenderEffect, createSignal, untrack } from 'solid-js';
import type { HostNode } from '@solid-native/fabric';
import {
  Keyboard,
  LayoutAnimation,
  useService,
  type LayoutEasing,
} from '@solid-native/device/solid';
import { insertHostChildren, spreadHostProps } from '@solid-native/platform/solid';
import type { Rect, LayoutEvent } from '../events.ts';
import { hostProps, primitiveNode, View } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import type { NativeStyle, ViewProps } from './types.ts';

export type KeyboardAvoidingBehavior = 'padding' | 'height' | 'position';
export interface KeyboardAvoidingViewProps extends ViewProps {
  behavior?: KeyboardAvoidingBehavior;
  contentContainerStyle?: NativeStyle;
  enabled?: boolean;
  keyboardVerticalOffset?: number;
}
const EASINGS = new Set(['linear', 'easeInEaseOut', 'easeIn', 'easeOut', 'spring', 'keyboard']);
export function KeyboardAvoidingView(props: KeyboardAvoidingViewProps): HostNode {
  const node = primitiveNode('view');
  const ref = createNativeRef(node);
  const keyboard = useService(Keyboard).metrics;
  const animation = useService(LayoutAnimation);
  const [frame, setFrame] = createSignal<Rect>();
  const [naturalHeight, setNaturalHeight] = createSignal<number>();
  const behavior = () => props.behavior ?? 'padding';
  const overlap = createMemo(() => {
    const { height, screenY } = keyboard();
    if (props.enabled === false || !height) return 0;
    const box = frame(),
      offset = props.keyboardVerticalOffset ?? 0;
    if (!box) return Math.max(0, height - offset);
    const extent = behavior() === 'height' ? (naturalHeight() ?? box.height) : box.height;
    return Math.min(
      extent,
      Math.max(0, screenY === undefined ? height - offset : box.y + extent - (screenY - offset)),
    );
  });
  createRenderEffect(() => {
    const { duration, easing } = keyboard();
    if (props.enabled === false || !duration) return;
    // Configure before the reactive style binding writes the new layout.
    void animation
      .animate(() => {}, {
        duration,
        easing: easing && EASINGS.has(easing) ? (easing as LayoutEasing) : undefined,
        appear: 'none',
        leave: 'none',
      })
      .catch((error: unknown) => console.error(error));
  });
  let layoutRevision = 0;
  const layout = (event: LayoutEvent) => {
    const box = event.nativeEvent.layout;
    const revision = ++layoutRevision;
    const natural = overlap() === 0;
    setFrame(box);
    if (natural) setNaturalHeight(box.height);
    ref.measure((measured) => {
      if (revision === layoutRevision) setFrame({ ...box, y: measured.y });
    });
    props.onLayout?.(event);
  };
  spreadHostProps(
    node,
    () => {
      const amount = overlap(),
        base = naturalHeight() ?? frame()?.height;
      return {
        ...hostProps(props, {}, [
          'behavior',
          'contentContainerStyle',
          'enabled',
          'keyboardVerticalOffset',
        ]),
        onLayout: layout,
        style: [
          props.style,
          amount && behavior() !== 'position'
            ? behavior() === 'height'
              ? base === undefined
                ? undefined
                : { height: base - amount, flex: 0 }
              : { paddingBottom: amount }
            : undefined,
        ],
      };
    },
    true,
  );
  insertHostChildren(node, () =>
    behavior() === 'position'
      ? untrack(() =>
          View({
            get style() {
              return [props.contentContainerStyle, { bottom: overlap() }];
            },
            get children() {
              return props.children;
            },
          }),
        )
      : props.children,
  );
  props.ref?.(ref);
  return node;
}
