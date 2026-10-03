import { $PROXY } from 'solid-js';
import { claimHost, type HostNode } from '@solid-native/fabric';
import { createHostElement } from '@solid-native/platform/solid';
import type { AccessibilityState, ViewProps } from './types.ts';

type Defaults = {
  accessible?: boolean;
  focusable?: boolean;
  role?: string;
  disabled?: boolean;
  checked?: boolean;
};
const ALIASES = new Set(['id', 'role', 'tabIndex', 'ref', 'children']);
const STATE_KEYS = ['busy', 'checked', 'disabled', 'expanded', 'selected'] as const;
const VALUE_KEYS = ['min', 'max', 'now', 'text'] as const;
/** The prop each reads, spelled once rather than built per key on every pass. */
const ARIA_STATE = STATE_KEYS.map((key) => [key, `aria-${key}`] as const);
const ARIA_VALUE = VALUE_KEYS.map((key) => [key, `aria-value${key}`] as const);

type HostSourceProps = Omit<ViewProps, 'children' | 'ref' | 'style'>;

// Each builder allocates only when there is something to carry: every View and Text runs these
// on creation and on each prop change, and almost none has state, values or an aria alias.
function stateProps(
  props: HostSourceProps,
  defaults: Defaults,
  aria: boolean,
): AccessibilityState | undefined {
  let state: Record<string, unknown> | undefined;
  if (props.accessibilityState) state = { ...props.accessibilityState };
  if (defaults.disabled) (state ??= {})['disabled'] = true;
  if (defaults.checked !== undefined) (state ??= {})['checked'] = defaults.checked;
  if (aria)
    for (const [key, prop] of ARIA_STATE) {
      const value = props[prop];
      if (value !== undefined) (state ??= {})[key] = value;
    }
  return state && Object.keys(state).length ? state : undefined;
}
function valueProps(props: HostSourceProps, aria: boolean) {
  let value: Record<string, unknown> | undefined;
  if (props.accessibilityValue) value = { ...props.accessibilityValue };
  if (aria)
    for (const [key, prop] of ARIA_VALUE) {
      const next = props[prop];
      if (next !== undefined) (value ??= {})[key] = next;
    }
  return value && Object.keys(value).length ? value : undefined;
}
function focusable(props: Pick<ViewProps, 'focusable' | 'tabIndex'>, defaults: Defaults) {
  return (
    props.focusable ?? (props.tabIndex === undefined ? defaults.focusable : props.tabIndex === 0)
  );
}
/**
 * What hostProps maps to, beside the props it forwards as they are. A type rather than an
 * interface, so it stays assignable to a props record as the inferred literal it replaced was.
 */
type MappedHostProps = {
  nativeID: string | undefined;
  accessible: boolean | undefined;
  accessibilityLabel: string | undefined;
  accessibilityLabelledBy: string | readonly string[] | undefined;
  accessibilityRole: string | undefined;
  accessibilityState: AccessibilityState | undefined;
  accessibilityValue: Record<string, unknown> | undefined;
  focusable: boolean | undefined;
  accessibilityLiveRegion: 'none' | 'polite' | 'assertive' | undefined;
  accessibilityElementsHidden: boolean | undefined;
  importantForAccessibility: 'auto' | 'yes' | 'no' | 'no-hide-descendants' | undefined;
  accessibilityViewIsModal: boolean | undefined;
};

function put(into: Record<string, unknown>, key: string, value: unknown, all: boolean): void {
  if (all || value !== undefined) into[key] = value;
}

/**
 * One object, in the key order spreading the forwarded props and then the mapped ones gave.
 * `all` false leaves out what is undefined.
 */
function buildHostProps(
  props: HostSourceProps,
  defaults: Defaults,
  omit: readonly string[],
  all: boolean,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Whether any aria-* prop is present: the key list is the props' own (and tracked through a
  // merged-props proxy), so with none of them the per-key aria reads below can only be undefined.
  let aria = false;
  // `for...in` lists the same own keys of a props object (or a merged-props proxy, through its
  // traps) without an array per pass.
  for (const key in props) {
    if (key.startsWith('aria-')) aria = true;
    else if (!ALIASES.has(key) && !omit.includes(key))
      put(result, key, props[key as keyof typeof props], all);
  }
  putMapped(result, props, defaults, aria, all);
  return result;
}

function putMapped(
  result: Record<string, unknown>,
  props: HostSourceProps,
  defaults: Defaults,
  aria: boolean,
  all: boolean,
): void {
  put(result, 'nativeID', props.nativeID ?? props.id, all);
  put(result, 'accessible', props.accessible ?? defaults.accessible, all);
  put(result, 'accessibilityLabel', props.accessibilityLabel ?? props['aria-label'], all);
  put(
    result,
    'accessibilityLabelledBy',
    props.accessibilityLabelledBy ?? props['aria-labelledby'],
    all,
  );
  put(result, 'accessibilityRole', props.accessibilityRole ?? props.role ?? defaults.role, all);
  put(result, 'accessibilityState', stateProps(props, defaults, aria), all);
  put(result, 'accessibilityValue', valueProps(props, aria), all);
  put(result, 'focusable', focusable(props, defaults), all);
  putVisibility(result, props, all);
}

function putVisibility(result: Record<string, unknown>, props: HostSourceProps, all: boolean) {
  const live = props['aria-live'] === 'off' ? 'none' : props['aria-live'];
  put(result, 'accessibilityLiveRegion', props.accessibilityLiveRegion ?? live, all);
  put(
    result,
    'accessibilityElementsHidden',
    props.accessibilityElementsHidden ?? props['aria-hidden'],
    all,
  );
  put(
    result,
    'importantForAccessibility',
    props.importantForAccessibility ?? (props['aria-hidden'] ? 'no-hide-descendants' : undefined),
    all,
  );
  put(
    result,
    'accessibilityViewIsModal',
    props.accessibilityViewIsModal ?? props['aria-modal'],
    all,
  );
}

/** Common RN/ARIA mapping; alias keys and component callbacks never reach Fabric. */
export function hostProps(
  props: HostSourceProps,
  defaults: Defaults = {},
  omit: readonly string[] = [],
): MappedHostProps {
  return buildHostProps(props, defaults, omit, true) as unknown as MappedHostProps;
}

/**
 * hostProps without its undefined entries, for the primitives' own spread, where an absent key
 * and an undefined one apply alike (a key that goes away is removed). Most of the mapped keys are
 * undefined on most elements, and the spread would otherwise visit each of them on every pass.
 */
export function definedHostProps(
  props: HostSourceProps,
  defaults: Defaults = {},
  omit: readonly string[] = [],
): Record<string, unknown> {
  return buildHostProps(props, defaults, omit, false);
}
/** Keys hostProps rewrites rather than forwards as they are. */
const REWRITTEN = new Set([...ALIASES, 'accessibilityState', 'accessibilityValue']);

/**
 * Whether hostProps with no defaults would hand back these props unchanged: a plain props object
 * (whose keys are fixed, as Solid's mergeProps also assumes) with nothing to alias or map, and no
 * ref, which the spread would bind to the raw node. Such a View spreads its props directly,
 * without a host object built on every pass.
 */
export function forwardsAsIs(props: object): boolean {
  if ($PROXY in props) return false;
  for (const key in props) {
    if (key === 'children') continue;
    if (REWRITTEN.has(key) || key.startsWith('aria-')) return false;
  }
  return true;
}

export function primitiveNode(name: string): HostNode {
  const node = createHostElement(name);
  claimHost(node);
  return node;
}
