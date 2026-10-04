import { createMemo, createRenderEffect, createSignal, onCleanup, type Signal } from 'solid-js';
import type { HostNode, ResponderHandlers } from '@solidnative/fabric';
import { insertHostChildren, spreadHostProps, useHostEngine } from '@solidnative/platform/solid';
import { createNativeRef } from './ref.ts';
import { definedHostProps, primitiveNode } from './host-props.ts';
import type { Insets, TouchEvent } from '../events.ts';
import type {
  AndroidRipple,
  PressBehaviorProps,
  PressableProps,
  PressableState,
  ViewProps,
} from './types.ts';

export const PRESS_KEYS = [
  'disabled',
  'cancelable',
  'pressRetentionOffset',
  'delayPressIn',
  'delayPressOut',
  'delayLongPress',
  'minPressDuration',
  'onPress',
  'onPressIn',
  'onPressOut',
  'onLongPress',
];
const RETAIN = { top: 20, right: 20, bottom: 30, left: 20 };
function insets(value: Insets | number | undefined, fallback: Required<Insets>): Required<Insets> {
  if (value === undefined) return fallback;
  if (typeof value === 'number') return { top: value, right: value, bottom: value, left: value };
  return {
    top: value.top ?? 0,
    right: value.right ?? 0,
    bottom: value.bottom ?? 0,
    left: value.left ?? 0,
  };
}
function point(event: TouchEvent) {
  const native = event.nativeEvent;
  const touch = native.touches?.[0];
  return { x: native.pageX ?? touch?.pageX ?? 0, y: native.pageY ?? touch?.pageY ?? 0 };
}
type PressProps = PressBehaviorProps &
  Pick<ViewProps, 'hitSlop'> & { android_ripple?: AndroidRipple };
type Engine = ReturnType<typeof useHostEngine>;
const always = () => true;

/**
 * One pressable's gesture state, and the responder handlers that drive it as its methods: the
 * engine calls them on this object, so a button holds one object rather than a closure apiece.
 * `pressed` and `hovered` become signals only once something reads them (`state`); a button that
 * styles itself the same way pressed or not keeps them as plain fields.
 */
class PressBehavior {
  origin: { x: number; y: number } | undefined;
  size: { width: number; height: number } | undefined;
  cancelled = false;
  longPressed = false;
  pressedAt = 0;
  lastEvent: TouchEvent | undefined;
  pressIn: ReturnType<typeof setTimeout> | undefined;
  pressOut: ReturnType<typeof setTimeout> | undefined;
  longPress: ReturnType<typeof setTimeout> | undefined;
  /** Removes the responder, while one is registered. */
  stopResponder: (() => void) | null = null;
  /** Removes the hover listeners, once something has read `hovered`. */
  stopHover: (() => void) | null = null;
  pressedValue = false;
  hoveredValue = false;
  pressedSignal: Signal<boolean> | null = null;
  hoveredSignal: Signal<boolean> | null = null;
  readonly node: HostNode;
  readonly props: PressProps;
  readonly engine: Engine;
  readonly isEnabled: () => boolean;

  constructor(node: HostNode, props: PressProps, engine: Engine, isEnabled: () => boolean) {
    this.node = node;
    this.props = props;
    this.engine = engine;
    this.isEnabled = isEnabled;
  }

  setPressed(value: boolean): void {
    this.pressedValue = value;
    this.pressedSignal?.[1](value);
  }

  setHovered(value: boolean): void {
    this.hoveredValue = value;
    this.hoveredSignal?.[1](value);
  }

  state(): PressableState {
    const pressed = (this.pressedSignal ??= createSignal(this.pressedValue))[0]();
    const behavior = this;
    return {
      pressed,
      get hovered() {
        behavior.watchHover();
        return (behavior.hoveredSignal ??= createSignal(behavior.hoveredValue))[0]();
      },
    };
  }

  watchHover(): void {
    if (this.stopHover || !this.isEnabled()) return;
    const enter = this.engine.setEventListener(this.node, 'topPointerEnter', () => {
      if (this.isEnabled()) this.setHovered(true);
    });
    const leave = this.engine.setEventListener(this.node, 'topPointerLeave', () =>
      this.setHovered(false),
    );
    this.stopHover = () => {
      enter();
      leave();
    };
  }

  /** Everything a registration holds: the responder, hover, timers and the pressed state. */
  release(): void {
    const stopResponder = this.stopResponder,
      stopHover = this.stopHover;
    this.stopResponder = this.stopHover = null;
    stopResponder?.();
    stopHover?.();
    this.clearTimers();
    this.setPressed(false);
    this.setHovered(false);
  }

  clearTimers(): void {
    clearTimeout(this.pressIn);
    clearTimeout(this.pressOut);
    clearTimeout(this.longPress);
    this.pressIn = this.pressOut = this.longPress = undefined;
  }

  activate(event: TouchEvent): void {
    this.pressIn = undefined;
    const props = this.props;
    if (props.disabled || this.cancelled) return;
    this.pressedAt = Date.now();
    this.setPressed(true);
    props.onPressIn?.(event);
    if (props.onLongPress)
      this.longPress = setTimeout(
        () => {
          this.longPress = undefined;
          if (props.disabled || this.cancelled) return;
          this.longPressed = true;
          props.onLongPress?.(event);
        },
        Math.max(0, props.delayLongPress ?? 500),
      );
  }

  deactivate(event: TouchEvent, immediate = false): void {
    clearTimeout(this.pressIn);
    clearTimeout(this.longPress);
    clearTimeout(this.pressOut);
    this.pressIn = this.longPress = undefined;
    if (!this.pressedValue) return;
    const props = this.props;
    const out = () => {
      this.pressOut = undefined;
      this.setPressed(false);
      props.onPressOut?.(event);
    };
    const delay = immediate
      ? 0
      : Math.max(
          props.delayPressOut ?? 0,
          (props.minPressDuration ?? 130) - (Date.now() - this.pressedAt),
        );
    if (delay > 0) this.pressOut = setTimeout(out, delay);
    else out();
  }

  inside(event: TouchEvent): boolean {
    const origin = this.origin;
    if (!origin) return false;
    const current = point(event),
      dx = current.x - origin.x,
      dy = current.y - origin.y;
    const size = this.size;
    if (!size) return Math.hypot(dx, dy) <= 15;
    const slop = insets(this.props.hitSlop, { top: 0, left: 0, right: 0, bottom: 0 });
    const keep = insets(this.props.pressRetentionOffset, RETAIN);
    return (
      Math.abs(dx) <= size.width + (dx < 0 ? slop.left + keep.left : slop.right + keep.right) &&
      Math.abs(dy) <= size.height + (dy < 0 ? slop.top + keep.top : slop.bottom + keep.bottom)
    );
  }

  ripplePressed(value: boolean): void {
    if (this.props.android_ripple) this.engine.dispatchCommand(this.node, 'setPressed', [value]);
  }

  terminate(event: TouchEvent): void {
    this.cancelled = true;
    this.origin = undefined;
    this.deactivate(event);
  }

  onStartShouldSetResponder(): boolean {
    return this.isEnabled() && !this.props.disabled;
  }

  onResponderGrant(event: TouchEvent): void {
    this.clearTimers();
    this.lastEvent = event;
    const origin = (this.origin = point(event));
    // Measured when a press starts, as React Native's Pressability does, rather than kept current
    // with a layout listener that has native report every layout of every button.
    this.size = undefined;
    this.engine.measure(this.node, (frame) => {
      this.size = { width: frame.width, height: frame.height };
    });
    this.cancelled = false;
    this.longPressed = false;
    const props = this.props;
    if (props.android_ripple) {
      this.engine.dispatchCommand(this.node, 'hotspotUpdate', [origin.x, origin.y]);
      this.ripplePressed(true);
    }
    if ((props.delayPressIn ?? 0) > 0)
      this.pressIn = setTimeout(() => this.activate(event), props.delayPressIn);
    else this.activate(event);
  }

  onResponderMove(event: TouchEvent): void {
    this.lastEvent = event;
    if (!this.cancelled && !this.inside(event)) this.terminate(event);
  }

  onResponderRelease(event: TouchEvent): void {
    this.lastEvent = event;
    this.origin = undefined;
    this.ripplePressed(false);
    const props = this.props;
    if (this.cancelled || props.disabled) {
      this.deactivate(event);
      return;
    }
    if (this.pressIn) {
      clearTimeout(this.pressIn);
      this.activate(event);
    }
    const suppress = this.longPressed;
    this.deactivate(event);
    if (!suppress) props.onPress?.(event);
  }

  onResponderTerminate(event: TouchEvent): void {
    this.ripplePressed(false);
    this.terminate(event);
  }

  onResponderTerminationRequest(): boolean {
    return this.props.cancelable ?? true;
  }
}

/** Responder arbitration, not a synthetic topPress listener. */
export function installPressBehavior(
  node: HostNode,
  props: PressProps,
  enabled: () => boolean = always,
): () => PressableState {
  const isEnabled = enabled === always ? always : createMemo(enabled);
  const behavior = new PressBehavior(node, props, useHostEngine(), isEnabled);
  const release = () => behavior.release();
  createRenderEffect(() => {
    if (!isEnabled()) return;
    behavior.stopResponder = behavior.engine.setResponder(
      node,
      behavior as unknown as ResponderHandlers,
    );
    onCleanup(release);
  });
  createRenderEffect(() => {
    if ((!isEnabled() || props.disabled) && behavior.lastEvent) {
      behavior.cancelled = true;
      behavior.deactivate(behavior.lastEvent, true);
    }
  });
  // The node lives exactly as long as this owner (a component's, or a Text's press memo), so the
  // owner's cleanup is the node's: no native-lifetime registration per button.
  onCleanup(release);
  return () => behavior.state();
}
/**
 * The `RippleAndroid` drawable Android's `ReactDrawableHelper` reads. `color` goes through the
 * engine like every colour prop: the helper takes only a number or a platform-colour map, and a
 * plain `'#ff0000'` would silently draw in the theme's highlight instead.
 */
function rippleDrawable(engine: ReturnType<typeof useHostEngine>, ripple: AndroidRipple) {
  return {
    type: 'RippleAndroid' as const,
    color: engine.color(ripple.color),
    borderless: ripple.borderless ?? false,
    rippleRadius: ripple.radius,
  };
}
/** What Pressable handles itself; `style` is read below, once, rather than copied and replaced. */
const PRESSABLE_OMIT = [...PRESS_KEYS, 'android_ripple', 'style'];
export function Pressable(props: PressableProps): HostNode {
  const node = primitiveNode('pressable');
  const engine = useHostEngine();
  const state = installPressBehavior(node, props);
  // The drawable for the ripple as written, kept while the same ripple object is passed.
  let lastRipple: AndroidRipple | undefined;
  let drawable: ReturnType<typeof rippleDrawable> | undefined;
  const ripple = () => {
    const value = props.android_ripple;
    if (value !== lastRipple) {
      lastRipple = value;
      drawable = value && rippleDrawable(engine, value);
    }
    return drawable;
  };
  spreadHostProps(
    node,
    () => {
      // Only what is set: the spread removes what goes away, and would otherwise visit every
      // mapped key a button leaves undefined on every pass.
      const host = definedHostProps(
        props,
        { accessible: true, focusable: true, disabled: props.disabled },
        PRESSABLE_OMIT,
      );
      const drawn = ripple();
      if (drawn)
        host[
          props.android_ripple!.foreground ? 'nativeForegroundAndroid' : 'nativeBackgroundAndroid'
        ] = drawn;
      const style = props.style;
      host['style'] = typeof style === 'function' ? style(state()) : style;
      return host;
    },
    true,
  );
  insertHostChildren(node, () => {
    // Read once: compiled children are a getter that builds them on every read.
    const children = props.children;
    return typeof children === 'function' ? children(state()) : children;
  });
  props.ref?.(createNativeRef(node));
  return node;
}
