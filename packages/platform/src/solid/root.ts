import { createRoot, getOwner, onCleanup, runWithOwner, type Owner } from 'solid-js';
import {
  Engine,
  nativePlatform,
  type EngineOptions,
  type EngineNode,
  type FabricUIManager,
} from '@solidnative/fabric';
import { DEAD, DROPPED, NodeLifetime, withRoot, type RootContext } from './context.ts';
import { reserveSurface } from './events.ts';
import { renderer } from './renderer.ts';
import { createNativeScheduler, type NativeClock } from './scheduler.ts';
import { isNativeReloadPending, registerNativeReloadRoot } from './dev-reload.ts';
import { withHostAdapter, type HostChild } from './host-context.ts';
import { createNativeHostAdapter } from './native-host-adapter.ts';
import { calmDevBanner } from '../dev-loading-view.ts';

declare const __DEV__: boolean;

export type NativeChild = HostChild;

export interface NativeRootOptions {
  readonly fabric: FabricUIManager;
  readonly rootTag: number;
  readonly engineOptions?: EngineOptions;
  readonly clock?: NativeClock;
}

export interface NativeRoot {
  readonly engine: Engine;
  readonly disposed: boolean;
  /** Mount once. A new root may use the same surface after dispose(). */
  render(code: () => NativeChild): void;
  flush(): boolean;
  /** One-shot barrier; inspect engine handles only for nodes still attached to this root. */
  afterCommit(callback: () => void): () => void;
  dispose(): void;
}

function collect(node: EngineNode, into: EngineNode[]): void {
  into.push(node);
  for (const child of node.children) collect(child, into);
}

function attached(node: EngineNode, engine: Engine): boolean {
  while (node.parent) node = node.parent;
  return node === engine.root;
}

/** Mount Solid directly onto the retained Fabric engine, without React reconciliation. */
export function createNativeRoot(options: NativeRootOptions): NativeRoot {
  const development = typeof __DEV__ !== 'undefined' && __DEV__;
  if (development && isNativeReloadPending())
    throw new Error('Native Solid is awaiting a clean reload.');
  if (development) calmDevBanner();
  const surface = reserveSurface(options.fabric, options.rootTag);
  let disposed = false;
  let mounted = false;
  let disposeOwner: (() => void) | undefined;
  let solidOwner: Owner | null = null;
  /** Head of the live lifetimes' list (see NodeLifetime.prev). */
  let nodes: NodeLifetime | null = null;
  /** Released lifetimes awaiting the next commit; each queued once (NodeLifetime.queued). */
  const released: NodeLifetime[] = [];
  /** Nodes without a lifetime whose owner was disposed, awaiting the next commit. */
  const dropped: EngineNode[] = [];
  /** Owners whose nodes left the tree, disposed once the commit removing them is out. */
  let retired: (() => void)[] = [];
  function releaseTree(node: EngineNode): void {
    engine.destroyNode(node);
    // Indexed: a for-of over each node's children goes through the iterator protocol.
    const children = node.children;
    for (let i = 0; i < children.length; i++) releaseTree(children[i]!);
  }
  const report = (error: unknown, source: string) => {
    try {
      if (options.engineOptions?.onError) options.engineOptions.onError(error, source);
      else console.error(`[native-solid] ${source}`, error);
    } catch (reporterError) {
      // No exception, including one from application error reporting, may unwind into Fabric.
      try {
        console.error('[native-solid] error reporter failed', reporterError);
      } catch {
        /* contained */
      }
    }
  };
  const engine = new Engine(surface.manager, options.rootTag, {
    ...options.engineOptions,
    onError: report,
  });
  surface.attach(engine, report);
  // What `@solidnative/tailwind`'s `ios:`/`android:` variants match beneath, on the root so they
  // work with nothing for the app to set up.
  engine.addClass(engine.root, `platform-${nativePlatform()}`);

  // Solid's public Owner cleanup lists are fail-fast. Contain each application cleanup
  // before invoking the standard disposer so one callback cannot strand sibling effects.
  function containOwnerCleanup(owner: Owner): void {
    for (const child of owner.owned ?? []) containOwnerCleanup(child);
    if (owner.cleanups)
      owner.cleanups = owner.cleanups.map((cleanup) => () => {
        try {
          cleanup();
        } catch (error) {
          report(error, 'owner cleanup');
        }
      });
  }

  function destroy(lifetime: NodeLifetime): void {
    if (!lifetime.active) return;
    lifetime.active = false;
    if (lifetime.resources)
      for (const cleanup of [...lifetime.resources]) {
        try {
          cleanup();
        } catch (error) {
          report(error, 'native cleanup');
        }
      }
    lifetime.listeners = null;
    engine.destroyNode(lifetime.node);
    if (lifetime.prev) lifetime.prev.next = lifetime.next;
    else nodes = lifetime.next;
    if (lifetime.next) lifetime.next.prev = lifetime.prev;
    lifetime.prev = lifetime.next = null;
  }

  /** Let go of what disposed owners left: detached lifetimes and dropped subtrees. */
  function releaseDetached(): void {
    // Indexed, so a lifetime released by a cleanup that runs here is visited in this pass too.
    for (let i = 0; i < released.length; i++) {
      const lifetime = released[i]!;
      lifetime.queued = false;
      if (!attached(lifetime.node, engine)) destroy(lifetime);
    }
    released.length = 0;
    // A dropped node at the top of a detached subtree takes the subtree's native handles with it;
    // one still in a tree is either in use or under such a top.
    for (let i = 0; i < dropped.length; i++) {
      const node = dropped[i]!;
      if (node.parent !== null || node.hostData !== DROPPED) continue;
      node.hostData = DEAD;
      releaseTree(node);
    }
    dropped.length = 0;
  }

  /** Dispose the retired owners. What they drop is released by the flush, once it is detached. */
  function runRetired(): void {
    while (retired.length) {
      const batch = retired;
      retired = [];
      for (let i = 0; i < batch.length; i++) {
        try {
          batch[i]!();
        } catch (error) {
          report(error, 'owner cleanup');
        }
      }
    }
  }

  /** Dispose the retired owners, then release what they dropped, in the same flush. */
  function disposeRetired(): void {
    runRetired();
    releaseDetached();
  }

  const scheduler = createNativeScheduler(engine, {
    clock: options.clock,
    report,
    beforeCommit: releaseDetached,
    afterCommit() {
      if (retired.length) disposeRetired();
    },
  });
  const context: RootContext = {
    engine,
    get disposed() {
      return disposed;
    },
    adopt(lifetime) {
      lifetime.next = nodes;
      if (nodes) nodes.prev = lifetime;
      nodes = lifetime;
    },
    drop(node) {
      const data = node.hostData;
      if (data instanceof NodeLifetime) return context.release(data);
      if (data === DEAD) return;
      node.hostData = DROPPED;
      dropped.push(node);
      if (!disposed) scheduler.schedule();
    },
    retire(dispose) {
      if (disposed) return dispose();
      // The removal that retired it has already asked for a flush; the first asks again in case.
      if (retired.push(dispose) === 1) scheduler.schedule();
    },
    settleRetired: runRetired,
    release(lifetime) {
      lifetime.released = true;
      if (!lifetime.queued && lifetime.active) {
        lifetime.queued = true;
        released.push(lifetime);
      }
      if (!disposed) scheduler.schedule();
    },
    report,
  };
  const root: NativeRoot = {
    engine,
    get disposed() {
      return disposed;
    },
    render(code) {
      if (disposed || mounted)
        throw new Error('A native root can render only once before disposal.');
      mounted = true;
      try {
        createRoot((dispose) => {
          disposeOwner = dispose;
          solidOwner = getOwner();
          withRoot(context, () =>
            withHostAdapter(hostAdapter, () => {
              try {
                // Every concrete node is validated by the native renderer's insertion hook.
                renderer.insert(engine.root, code() as Parameters<typeof renderer.insert>[1]);
              } catch (error) {
                // Protect callbacks before a failed provider computation starts Solid cleanup.
                if (solidOwner) containOwnerCleanup(solidOwner);
                throw error;
              }
            }),
          );
        }, null);
        scheduler.flush();
      } catch (error) {
        root.dispose();
        throw error;
      }
    },
    flush: () => scheduler.flush(),
    afterCommit(callback) {
      if (disposed) return () => {};
      const owner = getOwner();
      const cancel = scheduler.afterCommit(() => runWithOwner(owner, callback));
      if (owner) onCleanup(cancel);
      return cancel;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unregisterReload();
      scheduler.dispose();
      surface.release();
      engine.setOnDirty(() => {});
      // Every node in the tree, before the owner's cleanup takes it apart: most have no lifetime
      // to be destroyed through, and each still holds its native handle (see below).
      const tree: EngineNode[] = [];
      collect(engine.root, tree);
      // Detach first: responder teardown can itself commit to clear active state.
      for (const child of [...engine.root.children]) engine.removeChild(engine.root, child);
      try {
        if (solidOwner) containOwnerCleanup(solidOwner);
        disposeOwner?.();
      } catch (error) {
        report(error, 'owner cleanup');
      }
      // Rows removed before the last commit went out are still waiting; their nodes are already
      // out of the tree collected above.
      disposeRetired();
      while (nodes) destroy(nodes);
      released.length = 0;
      dropped.length = 0;
      engine.commit();
      // A node app code still holds would otherwise keep its native shadow node, and through it
      // the subtree's, for as long as it is held.
      for (const node of tree) engine.destroyNode(node);
      engine.releaseHandles();
    },
  };
  engine.hostData = context;
  const hostAdapter = createNativeHostAdapter(context, root.afterCommit, scheduler.requestFrame);
  const unregisterReload = development ? registerNativeReloadRoot(root) : () => {};
  return root;
}

export function mountNative(code: () => NativeChild, options: NativeRootOptions): NativeRoot {
  const root = createNativeRoot(options);
  root.render(code);
  return root;
}
