import { createMemo, createRenderEffect, createSignal, onCleanup } from 'solid-js';
import type { HostNode } from '@solidnative/fabric';
import {
  insertHostChildren,
  onHostCleanup,
  spreadHostProps,
  useHostEngine,
} from '@solidnative/platform/solid';
import { createNativeRef } from './ref.ts';
import { hostProps, primitiveNode } from './host-props.ts';
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
/** Responder arbitration, not a synthetic topPress listener. */
const always = () => true;
export function installPressBehavior(
  node: HostNode,
  props: PressBehaviorProps & Pick<ViewProps, 'hitSlop'> & { android_ripple?: AndroidRipple },
  enabled: () => boolean = always,
) {
  const engine = useHostEngine();
  const isEnabled = enabled === always ? always : createMemo(enabled);
  const [pressed, setPressed] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);
  let origin: { x: number; y: number } | undefined;
  let size: { width: number; height: number } | undefined;
  let cancelled = false;
  let longPressed = false;
  let pressedAt = 0;
  let lastEvent: TouchEvent | undefined;
  let pressIn: ReturnType<typeof setTimeout> | undefined;
  let pressOut: ReturnType<typeof setTimeout> | undefined;
  let longPress: ReturnType<typeof setTimeout> | undefined;
  const clearTimers = () => {
    clearTimeout(pressIn);
    clearTimeout(pressOut);
    clearTimeout(longPress);
    pressIn = pressOut = longPress = undefined;
  };
  const activate = (event: TouchEvent) => {
    pressIn = undefined;
    if (props.disabled || cancelled) return;
    pressedAt = Date.now();
    setPressed(true);
    props.onPressIn?.(event);
    if (props.onLongPress)
      longPress = setTimeout(
        () => {
          longPress = undefined;
          if (props.disabled || cancelled) return;
          longPressed = true;
          props.onLongPress?.(event);
        },
        Math.max(0, props.delayLongPress ?? 500),
      );
  };
  const deactivate = (event: TouchEvent, immediate = false) => {
    clearTimeout(pressIn);
    clearTimeout(longPress);
    clearTimeout(pressOut);
    pressIn = longPress = undefined;
    if (!pressed()) return;
    const out = () => {
      pressOut = undefined;
      setPressed(false);
      props.onPressOut?.(event);
    };
    const delay = immediate
      ? 0
      : Math.max(
          props.delayPressOut ?? 0,
          (props.minPressDuration ?? 130) - (Date.now() - pressedAt),
        );
    if (delay > 0) pressOut = setTimeout(out, delay);
    else out();
  };
  const inside = (event: TouchEvent) => {
    if (!origin) return false;
    const current = point(event),
      dx = current.x - origin.x,
      dy = current.y - origin.y;
    if (!size) return Math.hypot(dx, dy) <= 15;
    const slop = insets(props.hitSlop, { top: 0, left: 0, right: 0, bottom: 0 });
    const keep = insets(props.pressRetentionOffset, RETAIN);
    return (
      Math.abs(dx) <= size.width + (dx < 0 ? slop.left + keep.left : slop.right + keep.right) &&
      Math.abs(dy) <= size.height + (dy < 0 ? slop.top + keep.top : slop.bottom + keep.bottom)
    );
  };
  const ripplePressed = (value: boolean) => {
    if (props.android_ripple) engine.dispatchCommand(node, 'setPressed', [value]);
  };
  const terminate = (event: TouchEvent) => {
    cancelled = true;
    origin = undefined;
    deactivate(event);
  };
  let stopListeners = () => {};
  // Hover is listened for once something reads it: most pressables never do, and each listener
  // has native track the pointer over the view.
  let stopHover = () => {};
  let hoverWatched = false;
  const watchHover = () => {
    if (hoverWatched || !isEnabled()) return;
    hoverWatched = true;
    const enter = engine.setEventListener(node, 'topPointerEnter', () => {
      if (isEnabled()) setHovered(true);
    });
    const leave = engine.setEventListener(node, 'topPointerLeave', () => setHovered(false));
    stopHover = () => {
      hoverWatched = false;
      stopHover = () => {};
      enter();
      leave();
    };
  };
  createRenderEffect(() => {
    if (!isEnabled()) return;
    const stops = [
      engine.setResponder(node, {
        onStartShouldSetResponder: () => isEnabled() && !props.disabled,
        onResponderGrant: (event) => {
          clearTimers();
          lastEvent = event;
          origin = point(event);
          // Measured when a press starts, as React Native's Pressability does, rather than kept
          // current with a layout listener that has native report every layout of every button.
          size = undefined;
          engine.measure(node, (frame) => {
            size = { width: frame.width, height: frame.height };
          });
          cancelled = false;
          longPressed = false;
          if (props.android_ripple) {
            engine.dispatchCommand(node, 'hotspotUpdate', [origin.x, origin.y]);
            ripplePressed(true);
          }
          if ((props.delayPressIn ?? 0) > 0)
            pressIn = setTimeout(() => activate(event), props.delayPressIn);
          else activate(event);
        },
        onResponderMove: (event) => {
          lastEvent = event;
          if (!cancelled && !inside(event)) terminate(event);
        },
        onResponderRelease: (event) => {
          lastEvent = event;
          origin = undefined;
          ripplePressed(false);
          if (cancelled || props.disabled) {
            deactivate(event);
            return;
          }
          if (pressIn) {
            clearTimeout(pressIn);
            activate(event);
          }
          const suppress = longPressed;
          deactivate(event);
          if (!suppress) props.onPress?.(event);
        },
        onResponderTerminate: (event) => {
          ripplePressed(false);
          terminate(event);
        },
        onResponderTerminationRequest: () => props.cancelable ?? true,
      }),
    ];
    let active = true;
    stopListeners = () => {
      if (!active) return;
      active = false;
      for (const stop of stops) stop();
      stopHover();
      clearTimers();
      setPressed(false);
      setHovered(false);
    };
    onCleanup(stopListeners);
  });
  createRenderEffect(() => {
    if ((!isEnabled() || props.disabled) && lastEvent) {
      cancelled = true;
      deactivate(lastEvent, true);
    }
  });
  // Unregistered with the owner, so a Text that gains and drops onPress does not pile these up.
  onCleanup(
    onHostCleanup(node, () => {
      clearTimers();
      stopListeners();
    }),
  );
  return (): PressableState => ({
    pressed: pressed(),
    get hovered() {
      watchHover();
      return hovered();
    },
  });
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
      const style = props.style;
      return {
        ...hostProps(
          props,
          { accessible: true, focusable: true, disabled: props.disabled },
          PRESSABLE_OMIT,
        ),
        nativeBackgroundAndroid: props.android_ripple?.foreground ? undefined : ripple(),
        nativeForegroundAndroid: props.android_ripple?.foreground ? ripple() : undefined,
        style: typeof style === 'function' ? style(state()) : style,
      };
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
