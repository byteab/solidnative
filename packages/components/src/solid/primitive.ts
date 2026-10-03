import { $PROXY, createMemo } from 'solid-js';
import { nativePlatform, type HostNode } from '@solidnative/fabric';
import { insertHostChildren, spreadHostProps, useHostEngine } from '@solidnative/platform/solid';
import { createNativeRef } from './ref.ts';
import { definedHostProps, forwardsAsIs, primitiveNode } from './host-props.ts';
import { installPressBehavior, PRESS_KEYS } from './pressable.ts';
import type { TextProps, ViewProps } from './types.ts';

export { hostProps, primitiveNode } from './host-props.ts';

export function View(props: ViewProps): HostNode {
  const node = primitiveNode('view');
  spreadHostProps(
    node,
    forwardsAsIs(props) ? (props as Record<string, unknown>) : () => definedHostProps(props),
    true,
  );
  insertHostChildren(node, () => props.children);
  props.ref?.(createNativeRef(node));
  return node;
}
const TEXT_OMIT = [...PRESS_KEYS, 'suppressHighlighting'];
const PRESS_CALLBACKS = ['onPress', 'onLongPress', 'onPressIn', 'onPressOut'];
const NEVER = () => false;
function hasPressCallback(props: TextProps): boolean {
  for (let i = 0; i < PRESS_CALLBACKS.length; i++) if (PRESS_CALLBACKS[i]! in props) return true;
  return false;
}
const NONE = () => undefined;
/** Text's host defaults, one shared object per combination rather than one per pass. */
const TEXT_DEFAULTS = [true, false].map((accessible) =>
  [undefined, true, false].map((disabled) => Object.freeze({ accessible, disabled })),
);
function textDefaults(accessible: boolean, disabled: boolean | undefined) {
  if (disabled !== undefined && typeof disabled !== 'boolean') return { accessible, disabled };
  return TEXT_DEFAULTS[accessible ? 0 : 1]![disabled === undefined ? 0 : disabled ? 1 : 2]!;
}

/**
 * Whether a Text's host props are its own props plus the `accessible` default: nothing pressable,
 * nothing it maps or computes from, and keys that cannot change (`forwardsAsIs`).
 */
function plainLabel(props: TextProps): boolean {
  if (!forwardsAsIs(props) || 'accessible' in props) return false;
  for (let i = 0; i < TEXT_OMIT.length; i++) if (TEXT_OMIT[i]! in props) return false;
  return true;
}

export function Text(props: TextProps): HostNode {
  const node = primitiveNode('text');
  if (plainLabel(props)) {
    // Its props spread as they are, as a plain View's do, and the default is written once.
    spreadHostProps(node, props as Record<string, unknown>, true);
    useHostEngine().setProp(node, 'accessible', nativePlatform() !== 'android');
    insertHostChildren(node, () => props.children);
    return node;
  }
  // Props that are not a proxy have a fixed set of keys (Solid's own test, as in mergeProps), so
  // a label written with no press callback can never gain one: it needs neither memo below.
  const neverPressable = !($PROXY in props) && !hasPressCallback(props);
  const pressable = neverPressable
    ? NEVER
    : createMemo(
        () => !!(props.onPress || props.onLongPress || props.onPressIn || props.onPressOut),
      );
  // A plain label never pays for responder arbitration: the press machinery lives under this memo
  // and exists only while a press callback does, so dropping the last one disposes it.
  const state = neverPressable
    ? NONE
    : createMemo(() => (pressable() ? installPressBehavior(node, props) : undefined));
  spreadHostProps(
    node,
    () => {
      // Written onto the fresh object: the same keys in the same order as spreading it.
      const host = definedHostProps(
        props,
        textDefaults(nativePlatform() === 'android' ? pressable() : true, props.disabled),
        TEXT_OMIT,
      );
      if (pressable()) host['isPressable'] = true;
      if (state()?.().pressed && !props.suppressHighlighting) host['isHighlighted'] = true;
      return host;
    },
    true,
  );
  insertHostChildren(node, () => props.children);
  props.ref?.(createNativeRef(node));
  return node;
}
