import { createRoot, getOwner, onCleanup, type Owner } from 'solid-js';
import type { HostNode } from '@solid-native/fabric';
import {
  createHostElement,
  insertHostChildren,
  type HostChild,
} from '@solid-native/platform/solid';

export interface RouteOwnerOptions {
  readonly onError?: (error: unknown) => void;
  /** Host boundary; native stacks require a direct `screen` child. Defaults to `view`. */
  readonly element?: string;
}

/** A live route instance. Its key is instance identity, not a URL matching policy. */
export interface RouteOwner {
  readonly key: string;
  readonly node: HostNode;
  readonly disposed: boolean;
  dispose(): void;
}

const disposalListeners = new WeakMap<RouteOwner, Set<() => void>>();

/** Internal stack hook: remove a route from its mounted projection before Solid releases it. */
export function observeRouteDisposal(route: RouteOwner, callback: () => void): () => void {
  const listeners = disposalListeners.get(route);
  if (!listeners) throw new Error('A retained stack requires routes from createRouteOwner().');
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function reportCleanup(error: unknown, options: RouteOwnerOptions): void {
  try {
    if (options.onError) options.onError(error);
    else console.error('[native-solid-router] route cleanup', error);
  } catch {
    // Error reporters are application callbacks too; they cannot interrupt final release.
  }
}

/** Pinned Solid 1.9.15 public owner fields, also used by the native root adapter. */
function containCleanup(owner: Owner, options: RouteOwnerOptions): void {
  for (const child of owner.owned ?? []) containCleanup(child, options);
  if (owner.cleanups)
    owner.cleanups = owner.cleanups.map((cleanup) => () => {
      try {
        cleanup();
      } catch (error) {
        reportCleanup(error, options);
      }
    });
}

function bindParentDisposal(dispose: () => void): () => void {
  let target: (() => void) | undefined = dispose;
  onCleanup(() => target?.());
  // An explicitly released route must not remain reachable through its parent's cleanup.
  return () => {
    target = undefined;
  };
}

/**
 * Create under a host/Solid owner. The independent root survives stack detach and covered
 * states, but never outlives that parent. Mount through RetainedStack.children so direct
 * disposal removes the wrapper before host resources are released.
 */
export function createRouteOwner(
  key: string,
  render: (node: HostNode) => HostChild,
  options: RouteOwnerOptions = {},
): RouteOwner {
  const parent = getOwner();
  if (!parent) throw new Error('createRouteOwner requires an active Solid owner.');
  let node!: HostNode;
  let owner: Owner | null = null;
  let disposeOwner: (() => void) | undefined;
  let disposed = false;
  let unlinkParent = () => {};
  const listeners = new Set<() => void>();
  const route: RouteOwner = {
    key,
    get node() {
      return node;
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unlinkParent();
      for (const callback of [...listeners]) {
        try {
          callback();
        } catch (error) {
          reportCleanup(error, options);
        }
      }
      listeners.clear();
      disposalListeners.delete(route);
      if (owner) containCleanup(owner, options);
      disposeOwner?.();
      disposeOwner = undefined;
      owner = null;
    },
  };
  disposalListeners.set(route, listeners);
  unlinkParent = bindParentDisposal(route.dispose);
  let failed = false;
  let failure: unknown;
  try {
    createRoot((dispose) => {
      disposeOwner = dispose;
      owner = getOwner();
      try {
        node = createHostElement(options.element ?? 'view');
        insertHostChildren(node, render(node));
      } catch (error) {
        // Dispose before Solid can deliver the error to an inherited handler. Throw outside
        // createRoot so an error boundary cannot turn an incomplete root into a live route.
        failed = true;
        failure = error;
        route.dispose();
      }
    }, parent);
    if (failed) throw failure;
  } catch (error) {
    route.dispose();
    throw error;
  }
  return route;
}
