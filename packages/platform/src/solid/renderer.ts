import { createRenderEffect, untrack } from 'solid-js';
import { createRenderer } from 'solid-js/universal';
import { claimHost, type EngineNode } from '@solidnative/fabric';
import {
  currentRoot,
  DROPPED,
  isLive,
  NodeLifetime,
  ownNode,
  rootOf,
  type RootContext,
} from './context.ts';
import { currentStyleSheet } from './styles.ts';
import { setProperty } from './properties.ts';

/**
 * An element owned by `root`, which the caller has already looked up from the Solid owner.
 * `statics` are its props compiled ahead of time (`solid-lower.cjs`), set before anything else.
 */
export function createElementIn(
  root: RootContext,
  name: string,
  statics?: Readonly<Record<string, unknown>>,
): EngineNode {
  const node = root.engine.createElement(name, currentStyleSheet(), statics);
  // These raw JSX intrinsics are implemented by this adapter; they need no component to claim
  // them. Leave other names unclaimed so the engine keeps reporting missing/unknown primitives.
  if (name === 'view' || name === 'text') claimHost(node);
  return ownNode(node, root);
}

export const renderer = createRenderer<EngineNode>({
  // The compiler hands lowered elements their static props as a second argument.
  createElement: (name: string, statics?: Readonly<Record<string, unknown>>) =>
    createElementIn(currentRoot(), name, statics),
  // Universal's array normalizer passes numbers despite its string-only callback type.
  createTextNode(value) {
    const root = currentRoot(true);
    return ownNode(root.engine.createText(String(value)), root);
  },
  replaceText(node, value) {
    const text = String(value);
    if (isLive(node) && node.text !== text) rootOf(node).engine.setText(node, text);
  },
  isTextNode: (node) => node.kind === 'text',
  setProperty,
  insertNode(parent, node, anchor) {
    if (!isLive(node)) return;
    const root = rootOf(node);
    if (parent.host !== root.engine)
      throw new Error('Cannot insert a node into another native root.');
    if (node === anchor) return;
    if (node.parent === parent && root.engine.nextSibling(node) === (anchor ?? null)) return;
    root.engine.insertBefore(parent, node, anchor ?? null);
  },
  removeNode(parent, node) {
    // Universal clears children until getFirstChild is empty, including during retained-owner
    // teardown. Removal must still progress after root disposal starts; insertion stays blocked
    // and the disposed root's scheduler is already stopped. Destruction remains root-owned.
    rootOf(node).engine.removeChild(parent, node);
    const data = node.hostData;
    if (data instanceof NodeLifetime) {
      if (data.released) data.root.release(data);
    } else if (data === DROPPED) rootOf(node).drop(node);
  },
  getParentNode: (node) => node.parent ?? undefined,
  getFirstChild: (node) => node.children[0],
  getNextSibling: (node) => rootOf(node).engine.nextSibling(node) ?? undefined,
});

/** Universal spread retains absent keys; materialize removals for native props and listeners. */
export function spread<T>(node: EngineNode, accessor: (() => T) | T, skipChildren?: boolean): void {
  if (!skipChildren) return universalSpread(node, accessor);
  // Universal's prop pass runs in its own effect, and re-running it after a tracked read inside
  // setProperty is a no-op (each value still equals the applied one). Applying untracked gives the
  // same updates without a ref and a prop computation per node per run, or store signals per
  // style key read only to be dropped.
  createRenderEffect(applySpread, {
    node,
    accessor: accessor as SpreadState['accessor'],
    applied: {},
    live: 0,
  });
}

/**
 * One node's spread, carried as its effect's value into one shared function: an object per node,
 * where a closure over these would add a function and its scope.
 */
interface SpreadState {
  readonly node: EngineNode;
  readonly accessor: (() => unknown) | unknown;
  /** What has been applied, by key; undefined once removed. */
  readonly applied: Record<string, unknown>;
  /** How many keys of `applied` hold a value, so a run can tell whether any went missing. */
  live: number;
}

function applySpread(state: SpreadState): SpreadState {
  const { node, accessor } = state;
  const value = (typeof accessor === 'function' ? accessor() : accessor) as Record<
    string,
    unknown
  > | null;
  // The ref is bound before any prop is applied, as universal's spread does.
  const ref = value && 'ref' in value ? value['ref'] : undefined;
  if (ref) createRenderEffect(() => (ref as (node: EngineNode) => void)(node));
  // Each value is read once, tracked, as Object.keys + a read per key always did, and applied
  // untracked as it is read: no copy of the props, no key array and no closure per run.
  let present = 0;
  for (const key in value) {
    if (key !== 'children' && key !== 'ref' && applyKey(state, key, value[key])) present++;
  }
  // Every applied key was seen again: nothing to remove, which is nearly every run.
  if (present !== state.live) removeMissing(state, value);
  return state;
}

/** Apply one key when it changed; whether it now holds a value. */
function applyKey(state: SpreadState, key: string, next: unknown): boolean {
  const previous = state.applied[key];
  if (next !== previous) {
    applyUntracked(state.node, key, next);
    state.applied[key] = next;
    if (previous === undefined) state.live++;
    else if (next === undefined) state.live--;
  }
  return next !== undefined;
}

function removeMissing(state: SpreadState, value: Record<string, unknown> | null): void {
  for (const key in state.applied) {
    if (state.applied[key] === undefined || (value && key in value)) continue;
    applyUntracked(state.node, key, undefined);
    state.applied[key] = undefined;
    state.live--;
  }
}

let pendingNode: EngineNode;
let pendingKey: string;
let pendingValue: unknown;
function applyPending(): void {
  setProperty(pendingNode, pendingKey, pendingValue);
}
/** setProperty outside the spread's tracking, through one shared function rather than a closure. */
function applyUntracked(node: EngineNode, key: string, value: unknown): void {
  pendingNode = node;
  pendingKey = key;
  pendingValue = value;
  untrack(applyPending);
}

function universalSpread<T>(node: EngineNode, accessor: (() => T) | T): void {
  let previous = new Set<string>();
  renderer.spread(node, () => {
    const value = typeof accessor === 'function' ? (accessor as () => T)() : accessor;
    const props = { ...(value as Record<string, unknown> | null) };
    const keys = new Set(Object.keys(props));
    for (const key of previous) if (!keys.has(key)) props[key] = undefined;
    previous = keys;
    return props;
  });
}
