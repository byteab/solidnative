import {
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
} from 'solid-js';
import {
  nativePlatform,
  registerViewName,
  type HostNode,
  type ScrollDrive,
  type ScrollRange,
} from '@solidnative/fabric';
import { Keyboard, SafeArea, SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { insertHostChildren, spreadHostProps, useHostAdapter } from '@solidnative/platform/solid';
import { KEYBOARD_CONTROLLER } from './keyboard-controller.ts';
import { hostProps, primitiveNode, View } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import { flattenStyle } from './image-background.ts';
import type { RefBinding } from './animation-bindings.ts';
import type { NativeRef, NativeStyle, ViewProps } from './types.ts';

export interface KeyboardDockRef extends NativeRef {
  readonly covered: Accessor<number>;
  readonly liftRange: Accessor<ScrollRange>;
  /** Native movement is enabled only while this dock owns the foreground. */
  readonly lifts: Accessor<boolean>;
  /** Caller owns the returned drive. Acquire only after its view has committed. */
  lift(view: HostNode, shift?: number | null): ScrollDrive | null;
}
export interface KeyboardDockProps extends Omit<ViewProps, 'ref'> {
  backgroundColor?: string;
  /** Match the composer's TextInput.nativeID to enable interactive keyboard dismissal. */
  inputNativeID?: string;
  ref?: (ref: KeyboardDockRef) => void;
}
const FEED = {
  events: ['onKeyboardMove', 'onKeyboardMoveInteractive', 'onKeyboardMoveEnd'],
  path: ['height'],
};
const OUT_OF_FLOW = { position: 'absolute', width: 0, height: 0 };
const FAR = 10_000;

function bindDrive(
  target: Accessor<NativeRef | undefined>,
  dock: Accessor<KeyboardDockRef | null | undefined>,
  shift: boolean,
) {
  const adapter = useHostAdapter();
  createRenderEffect(() => {
    const view = target(),
      source = dock();
    if (!view || !source?.lifts()) return;
    const range = source.liftRange(),
      covered = shift ? source.covered() : null;
    let live = true,
      drive: ScrollDrive | null = null;
    const stop = () => {
      live = false;
      const acquired = drive;
      drive = null;
      acquired?.stop();
    };
    onCleanup(stop);
    onCleanup(adapter.onCleanup(view.node, stop));
    onCleanup(adapter.onCleanup(source.node, stop));
    const cancel = adapter.afterCommit(() => {
      if (!live || !view.isAttached() || !source.isAttached() || !source.lifts()) return;
      const acquired = source.lift(view.node, covered);
      if (!live || !view.isAttached() || !source.lifts()) {
        acquired?.stop();
        return;
      }
      drive = acquired;
      try {
        drive?.update(range);
      } catch (error) {
        stop();
        throw error;
      }
    });
    onCleanup(cancel);
  });
}

/** The native controller remains an explicit opt-in; no optional native module is imported. */
export function KeyboardDock(props: KeyboardDockProps): HostNode {
  const adapter = useHostAdapter(),
    keyboard = useService(Keyboard),
    safe = useService(SafeArea);
  const front = useService(SCREEN_IN_FRONT);
  const native = nativePlatform() === 'ios' && useService(KEYBOARD_CONTROLLER);
  const node = primitiveNode('view'),
    base = createNativeRef(node);
  const [edge, setEdge] = createSignal<number>();
  const [height, setHeight] = createSignal(0),
    [barHeight, setBarHeight] = createSignal(0);
  let active = true,
    source: HostNode | undefined;
  onCleanup(() => {
    active = false;
  });
  const inset = () => safe.insets().bottom;
  const lifts = () => active && native && front();
  const covered = createMemo(() => (native ? Math.max(0, height() - inset()) : 0));
  const liftRange = createMemo<ScrollRange>(() => ({
    input: [inset(), inset() + FAR],
    output: [0, -FAR],
  }));
  const padding = createMemo(() => {
    if (native) return inset();
    const metrics = keyboard.metrics();
    if (!metrics.height) return inset();
    const bottom = edge();
    return bottom === undefined || metrics.screenY === undefined
      ? metrics.height
      : Math.max(0, bottom - metrics.screenY);
  });
  const ref: KeyboardDockRef = {
    ...base,
    covered,
    liftRange,
    lifts,
    lift(view, shift = null) {
      if (!lifts() || !source || !base.isAttached() || !adapter.isAttached(view)) return null;
      return adapter.engine.driveByEvent(view, source, FEED, 'translateY', liftRange(), [], shift);
    },
  };
  createRenderEffect(() => {
    const visible = front();
    untrack(() => {
      if (!visible && keyboard.height() > 0) keyboard.dismiss();
    });
  });
  let measurement = 0;
  spreadHostProps(
    node,
    () => ({
      ...hostProps(props, {}, ['backgroundColor', 'inputNativeID']),
      style: [props.style, { paddingBottom: padding(), backgroundColor: props.backgroundColor }],
      onLayout: (event: Parameters<NonNullable<ViewProps['onLayout']>>[0]) => {
        const token = ++measurement;
        if (!native)
          base.measure((frame) => {
            if (token === measurement) setEdge(frame.y + frame.height);
          });
        props.onLayout?.(event);
      },
    }),
    true,
  );
  if (native) {
    registerViewName('keyboard-controller-view', 'KeyboardControllerView');
    registerViewName('keyboard-gesture-area', 'KeyboardGestureArea');
    source = primitiveNode('keyboard-controller-view');
    const move = (event: { nativeEvent?: { height?: number } }) => {
      if (lifts() && event.nativeEvent?.height !== undefined) setHeight(event.nativeEvent.height);
    };
    spreadHostProps(
      source,
      () => ({
        enabled: front(),
        style: OUT_OF_FLOW,
        onKeyboardMoveStart: move,
        onKeyboardMoveEnd: move,
      }),
      true,
    );
    const gesture = primitiveNode('keyboard-gesture-area');
    spreadHostProps(
      gesture,
      () => ({ style: OUT_OF_FLOW, offset: barHeight(), textInputNativeID: props.inputNativeID }),
      true,
    );
    let barRef: NativeRef | undefined;
    const bar = View({
      collapsable: false,
      get style() {
        return { backgroundColor: props.backgroundColor };
      },
      onLayout: (event) => setBarHeight(event.nativeEvent.layout.height),
      ref: (value) => {
        barRef = value;
      },
      get children() {
        return props.children;
      },
    });
    insertHostChildren(node, [source, gesture, bar]);
    bindDrive(
      () => barRef,
      () => ref,
      false,
    );
  } else insertHostChildren(node, () => props.children);
  props.ref?.(ref);
  return node;
}

/** Create under a Solid owner, then pass the returned binding to the transcript View's ref. */
export function KeyboardLift(dock: Accessor<KeyboardDockRef | null | undefined>): RefBinding {
  const adapter = useHostAdapter();
  const [target, setTarget] = createSignal<NativeRef>();
  let active = true;
  onCleanup(() => {
    active = false;
  });
  bindDrive(target, dock, true);
  createRenderEffect(() => {
    const view = target(),
      source = dock();
    if (!view || !source?.lifts()) return;
    const covered = source.covered();
    if (!covered) return;
    const current = flattenStyle(view.node.props['style'] as NativeStyle);
    const before = current['paddingBottom'];
    adapter.engine.setProp(view.node, 'style', { ...current, paddingBottom: covered });
    onCleanup(() => {
      const next = flattenStyle(view.node.props['style'] as NativeStyle);
      if (next['paddingBottom'] === covered)
        adapter.engine.setProp(view.node, 'style', { ...next, paddingBottom: before });
    });
  });
  return (ref) => {
    if (active) setTarget(ref);
  };
}
