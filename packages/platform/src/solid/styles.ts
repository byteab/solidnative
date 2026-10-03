import { createComponent, createContext, useContext } from 'solid-js';
import { $RAW } from 'solid-js/store';
import {
  markComponentHost,
  type Engine,
  type EngineNode,
  type StyleSheet,
} from '@solidnative/fabric';
import { lifetimeOf, NodeLifetime, rootOf } from './context.ts';

const styles = createContext<StyleSheet | null>(null);

/** The provider owner survives the call, so later conditional branches inherit the sheet. */
export function withNativeStyles<T>(sheet: StyleSheet | null, render: () => T): T {
  let result!: T;
  createComponent(styles.Provider, {
    value: sheet,
    get children() {
      result = render();
      return undefined;
    },
  });
  return result;
}

export function currentStyleSheet(): StyleSheet | null {
  return useContext(styles);
}

/** Explicit component host: only this sheet's :host rules apply to this element. */
export function setNativeStyleHost(node: EngineNode, sheet: StyleSheet | null): void {
  if (node.hostSheet === sheet && node.componentHost) return;
  node.hostSheet = sheet;
  markComponentHost(node);
  // Public full-cascade invalidation; styleChanged alone only marks inline styling dirty.
  rootOf(node).engine.setClasses(node, [...(node.classes ?? [])].join(' '));
}

/** Replaced, never mutated, so unclassed nodes can share one. */
const NO_CLASSES: ReadonlySet<string> = new Set();
/** The same for nodes with no style bindings or custom properties: replaced on first write. */
const NONE: Record<string, unknown> = Object.freeze({});

class StyleState {
  baseClass: string;
  classList: ReadonlySet<string> = NO_CLASSES;
  style: Record<string, unknown>;
  bindings: Record<string, unknown> = NONE;
  custom: Record<string, unknown> = NONE;
  constructor(baseClass: string, style: Record<string, unknown>) {
    this.baseClass = baseClass;
    this.style = style;
  }
}

/**
 * A node's styling state. A node styled by its `style` prop alone, nearly every one, has none: its
 * flattened style is the inline style it holds, and the state is made from that once a class or a
 * binding arrives.
 */
function stateOf(node: EngineNode): StyleState {
  const lifetime = lifetimeOf(node);
  if (lifetime.style instanceof StyleState) return lifetime.style;
  const style = (node.props['style'] as Record<string, unknown> | undefined) ?? NONE;
  const state = new StyleState(node.classes ? [...node.classes].join(' ') : '', style);
  lifetime.style = state;
  return state;
}

/** Whether a node has styling state beyond its plain style, without making it a lifetime. */
function hasStyleState(node: EngineNode): boolean {
  const data = node.hostData;
  return data instanceof NodeLifetime && data.style instanceof StyleState;
}

const classNames = (value: string): string[] => value.split(/\s+/).filter(Boolean);
const styleKey = (name: string): string =>
  name.indexOf('-') < 0 ? name : name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const NUMERIC_STYLE = /^-?(?:\d*\.)?\d+(?:px)?$/;

/**
 * Copy an object's own entries. A store's raw target is read rather than its proxy, untracked:
 * the binding that handed the style over has already tracked the style itself, which is what a
 * replaced style object changes. Reading each key through the proxy would also subscribe to every
 * key of every style (a store signal per key per row), which is what View and Text's spread has
 * never done, and an intrinsic now does the same.
 */
function copyEntries(value: object, into: Record<string, unknown>, asStyle: boolean): void {
  const source = ((value as { [$RAW]?: object })[$RAW] ?? value) as Record<string, unknown>;
  // A flag rather than a callback: no closure per style object. `for...in`, as React Native's own
  // flattenStyle reads a style, rather than a key array per object.
  for (const name in source) {
    if (asStyle) writeStyle(into, name, source[name]);
    else into[name] = copyValue(source[name]);
  }
}

/** Whether a string can match NUMERIC_STYLE at all: skips the trim and regex for colours, words. */
function maybeNumeric(value: string): boolean {
  const code = value.charCodeAt(value.length - 1);
  // The last non-blank character of a match is a digit or the `x` of `px`; blanks fall through.
  return (code >= 48 && code <= 57) || code === 120 || code <= 32;
}

function copyValue(value: unknown): unknown {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map(copyValue);
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    copyEntries(value, copy, false);
    return copy;
  }
  if (typeof value === 'string' && maybeNumeric(value) && NUMERIC_STYLE.test(value.trim()))
    return parseFloat(value);
  return value;
}

function flattenStyle(value: unknown, into: Record<string, unknown> = {}): Record<string, unknown> {
  if (!value) return into;
  if (Array.isArray(value)) {
    for (const entry of value) flattenStyle(entry, into);
  } else if (typeof value === 'string') {
    for (const declaration of value.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      const name = declaration.slice(0, colon).trim();
      if (name) writeStyle(into, name, declaration.slice(colon + 1).trim());
    }
  } else if (typeof value === 'object') {
    copyEntries(value, into, true);
  } else {
    throw new TypeError('Native style must be an object, array, CSS declaration string, or null.');
  }
  return into;
}

/**
 * What the writes since the last `flattenStyle` from `setStyleProperty` were: how many, and
 * whether any was a null or a custom property. Counted as they happen, so the style needs no second
 * and third pass to ask (`setStyle`).
 */
let written = 0;
let irregular = false;

function writeStyle(into: Record<string, unknown>, name: string, value: unknown): void {
  const custom = name.charCodeAt(0) === 45 && name.charCodeAt(1) === 45;
  written++;
  if (custom || value == null) irregular = true;
  into[custom ? name : styleKey(name)] = custom ? value : copyValue(value);
}

function equalValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(
    (key) =>
      Object.hasOwn(right, key) &&
      equalValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  );
}

function applyClasses(engine: Engine, node: EngineNode, state: StyleState): void {
  const next = new Set([...classNames(state.baseClass), ...state.classList]);
  const current = node.classes;
  if (next.size === (current?.size ?? 0) && [...next].every((name) => current?.has(name))) return;
  engine.setClasses(node, [...next].join(' '));
}

/** No bindings or custom properties, past or present, and no null or custom-property entries. */
function plainStyle(state: StyleState): boolean {
  for (const _ in state.bindings) return false;
  for (const _ in state.custom) return false;
  return plainEntries(state.style);
}

function isEmpty(style: Record<string, unknown>): boolean {
  for (const _ in style) return false;
  return true;
}

function plainEntries(style: Record<string, unknown>): boolean {
  for (const name in style) if (style[name] == null || name.startsWith('--')) return false;
  return true;
}

/**
 * Nothing to merge, drop or route to custom properties: the flattened copy, which the state owns
 * and replaces rather than mutates, is already the inline style.
 */
function applyPlainStyle(
  engine: Engine,
  node: EngineNode,
  style: Record<string, unknown>,
  empty: boolean,
): void {
  const current = node.props['style'];
  if (current === undefined ? !empty : !equalValue(current, style))
    engine.setProp(node, 'style', empty ? null : style);
}

function applyCustom(
  engine: Engine,
  node: EngineNode,
  state: StyleState,
  custom: Record<string, unknown>,
): void {
  for (const name in state.custom) {
    if (!equalValue(state.custom[name], custom[name]))
      engine.setCustomProperty(node, name, custom[name]);
  }
  for (const name in custom) {
    if (!Object.hasOwn(state.custom, name)) engine.setCustomProperty(node, name, custom[name]);
  }
  state.custom = custom;
}

function applyStyle(engine: Engine, node: EngineNode, state: StyleState): void {
  if (plainStyle(state)) applyPlainStyle(engine, node, state.style, isEmpty(state.style));
  else applyMergedStyle(engine, node, state);
}

/** Apart from applyStyle, whose plain path would otherwise allocate `take`'s scope every call. */
function applyMergedStyle(engine: Engine, node: EngineNode, state: StyleState): void {
  const { style, bindings } = state;
  // Same result as splitting { ...style, ...bindings } without building the merged copy.
  const inline: Record<string, unknown> = {};
  const custom: Record<string, unknown> = {};
  let inlineCount = 0;
  const take = (name: string, value: unknown) => {
    if (value == null) return;
    if (name.startsWith('--')) custom[name] = value;
    else {
      inline[name] = value;
      inlineCount++;
    }
  };
  for (const name in style)
    take(name, Object.hasOwn(bindings, name) ? bindings[name] : style[name]);
  for (const name in bindings) if (!Object.hasOwn(style, name)) take(name, bindings[name]);
  applyCustom(engine, node, state, custom);
  const current = node.props['style'] ?? {};
  if (!equalValue(current, inline)) engine.setProp(node, 'style', inlineCount ? inline : null);
}

function setStyle(engine: Engine, node: EngineNode, value: unknown): void {
  written = 0;
  irregular = false;
  const style = flattenStyle(value);
  if (!irregular && !hasStyleState(node)) {
    applyPlainStyle(engine, node, style, written === 0);
    return;
  }
  const state = stateOf(node);
  state.style = style;
  applyStyle(engine, node, state);
}

/** Consume styling props before they can become unknown native view properties. */
export function setStyleProperty(
  engine: Engine,
  node: EngineNode,
  name: string,
  value: unknown,
): boolean {
  if (name === 'class' || name === 'className') {
    const state = stateOf(node);
    state.baseClass = value == null ? '' : String(value);
    applyClasses(engine, node, state);
  } else if (name === 'classList') {
    const state = stateOf(node);
    state.classList = new Set(
      Object.entries(value ?? {}).flatMap(([key, enabled]) => (enabled ? classNames(key) : [])),
    );
    applyClasses(engine, node, state);
  } else if (name === 'style') {
    setStyle(engine, node, value);
  } else if (name.startsWith('style:') || name.startsWith('--')) {
    const state = stateOf(node);
    const key = name.startsWith('style:') ? name.slice(6) : name;
    if (state.bindings === NONE) state.bindings = {};
    writeStyle(state.bindings, key, value);
    applyStyle(engine, node, state);
  } else return false;
  return true;
}
