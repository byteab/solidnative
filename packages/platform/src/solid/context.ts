import {
  createComponent,
  createContext,
  getOwner,
  onCleanup,
  useContext,
  type Owner,
} from 'solid-js';
import type { Engine, EngineNode } from '@solid-native/fabric';

/**
 * What a node needs once something has to be torn down with it: listeners, a native resource, or
 * styling state beyond a plain style. Most nodes never need one. Until then a node's `hostData` is
 * just the owner it was created under, and its root is its engine's (`rootOf`), so a node costs no
 * object and no cleanup of its own (see `lifetimeOf`).
 */
export class NodeLifetime {
  readonly root: RootContext;
  readonly node: EngineNode;
  /** The owner the node was created under, whose disposal releases it. Listeners run under it. */
  readonly owner: Owner | null;
  active = true;
  released = false;
  resources: Set<() => void> | null = null;
  listeners: Map<string, { value: unknown; remove: () => void }> | null = null;
  /** The node's styling state, owned by styles.ts, once a class or a style binding arrives. */
  style: object | null = null;
  /** Waiting in the root's release queue, so a second release does not queue it twice. */
  queued = false;
  /**
   * The root's live lifetimes, as a list threaded through them: a Set would add an entry object
   * per node on Hermes, and the root only ever adds, unlinks and walks them all at disposal.
   */
  prev: NodeLifetime | null = null;
  next: NodeLifetime | null = null;
  constructor(root: RootContext, node: EngineNode, owner: Owner | null) {
    this.root = root;
    this.node = node;
    this.owner = owner;
  }
}

export interface RootContext {
  readonly engine: Engine;
  readonly disposed: boolean;
  /** Link a node's new lifetime into the root. */
  adopt(lifetime: NodeLifetime): void;
  release(lifetime: NodeLifetime): void;
  /** The owner a node was made under is gone: release it, or its native handles once detached. */
  drop(node: EngineNode): void;
  report(error: unknown, source: string): void;
}

const context = createContext<RootContext>();

export function withRoot<T>(root: RootContext, render: () => T): T {
  let result!: T;
  createComponent(context.Provider, {
    value: root,
    get children() {
      result = render();
      return undefined;
    },
  });
  return result;
}

/**
 * The root the running owner renders into. `duringTeardown` also accepts one being disposed, for
 * the empty placeholder universal makes when a list empties, which a root's own disposal can set
 * off: it is never inserted (`insertNode` refuses a disposed root's nodes).
 */
export function currentRoot(duringTeardown = false): RootContext {
  const root = useContext(context);
  if (!root || (root.disposed && !duringTeardown))
    throw new Error('Native elements require an active native root owner.');
  return root;
}

/**
 * What a node without a lifetime holds once the owner it was made under has been disposed. It is
 * still live: universal can reuse a node across a re-run of the effect that made it. It is
 * released once a commit finds it detached, and from then on holds `DEAD`.
 */
export const DROPPED: object = Object.freeze({});
export const DEAD: object = Object.freeze({});

/**
 * Take a node into `root`. All it keeps is the owner it was made under, and a cleanup on that
 * owner: its root is its engine's, and a lifetime is made only when it needs one (`lifetimeOf`).
 */
export function ownNode(node: EngineNode, root: RootContext): EngineNode {
  node.hostData = getOwner();
  onCleanup(() => root.drop(node));
  return node;
}

/** The root a node belongs to, or an error when it belongs to none. */
export function rootOf(node: EngineNode): RootContext {
  if (node.hostData === undefined)
    throw new Error('The node does not belong to a Solid native root.');
  return (node.host as Engine).hostData as RootContext;
}

/** Whether a node may still be changed: its root is live, and its owner has not been disposed. */
export function isLive(node: EngineNode): boolean {
  const data = node.hostData;
  if (data instanceof NodeLifetime) return data.active && !data.root.disposed;
  return data !== DEAD && !rootOf(node).disposed;
}

/** A node's lifetime, made the first time something needs one. */
export function lifetimeOf(node: EngineNode): NodeLifetime {
  const data = node.hostData;
  if (data instanceof NodeLifetime) return data;
  const root = rootOf(node);
  const owner = data === DROPPED || data === DEAD ? null : ((data as Owner | null) ?? null);
  const lifetime = new NodeLifetime(root, node, owner);
  if (data === DEAD) lifetime.active = false;
  else if (data === DROPPED) lifetime.released = true;
  node.hostData = lifetime;
  root.adopt(lifetime);
  return lifetime;
}

/** Register a native subscription/drive teardown before its node's handle is destroyed. */
export function onNativeCleanup(node: EngineNode, cleanup: () => void): () => void {
  const lifetime = lifetimeOf(node);
  let active = true;
  const remove = () => {
    if (!active) return;
    active = false;
    lifetime.resources?.delete(remove);
    cleanup();
  };
  if (lifetime.active && !lifetime.root.disposed) (lifetime.resources ??= new Set()).add(remove);
  else remove();
  return remove;
}
