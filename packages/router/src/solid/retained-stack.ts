import { batch, createSignal, getOwner, onCleanup, type Accessor } from 'solid-js';
import type { HostNode } from '@solidnative/fabric';
import { observeRouteDisposal, type RouteOwner, type RouteOwnerOptions } from './route-owner.ts';

export interface StackTransition {
  readonly id: symbol;
  readonly from: readonly RouteOwner[];
  readonly to: readonly RouteOwner[];
}

export interface StackTransitionOptions {
  /** Cache removed routes for explicit reuse. Otherwise completion disposes them. */
  readonly retainRemoved?: boolean;
}

export interface RetainedStack {
  readonly entries: Accessor<readonly RouteOwner[]>;
  /** Mount this accessor once under the same host parent for the stack's lifetime. */
  readonly children: Accessor<readonly HostNode[]>;
  /** Every owned route: active entries, transition participants, and detached cached routes. */
  readonly retained: Accessor<readonly RouteOwner[]>;
  readonly transition: Accessor<StackTransition | null>;
  readonly disposed: boolean;
  transitionTo(next: readonly RouteOwner[], options?: StackTransitionOptions): StackTransition;
  complete(token: StackTransition): boolean;
  cancel(token: StackTransition): boolean;
  /** Positive native dismissal count, bounded so the base route remains. */
  dismiss(count?: number): StackTransition | null;
  /** Release a detached cached route. Visible/transitioning routes must finish leaving first. */
  release(key: string): boolean;
  /** Clear may empty the stack, unlike dismiss. The stack remains reusable. */
  clear(): void;
  dispose(): void;
}

interface PendingTransition {
  readonly token: StackTransition;
  readonly added: readonly RouteOwner[];
  readonly retainRemoved: boolean;
}

const stackOwners = new WeakMap<RouteOwner, object>();
const snapshot = <T>(items: readonly T[]): readonly T[] => Object.freeze([...items]);

/**
 * Lifetime state machine only: native transition notifications settle its opaque token.
 * Matching, history, guards, tabs, and RN Screens event binding belong to later layers.
 */
export function createRetainedStack(
  initial: readonly RouteOwner[] = [],
  options: RouteOwnerOptions = {},
): RetainedStack {
  if (!getOwner()) throw new Error('createRetainedStack requires an active Solid owner.');
  const identity = {};
  const owned = new Map<string, RouteOwner>();
  const unwatch = new Map<RouteOwner, () => void>();
  const [entries, setEntries] = createSignal<readonly RouteOwner[]>([]);
  const [children, setChildren] = createSignal<readonly HostNode[]>([]);
  const [retained, setRetained] = createSignal<readonly RouteOwner[]>([]);
  const [transition, setTransition] = createSignal<StackTransition | null>(null);
  let pending: PendingTransition | null = null;
  let disposed = false;

  function assertActive(): void {
    if (disposed) throw new Error('The retained stack has been disposed.');
  }

  function validate(next: readonly RouteOwner[]): void {
    const keys = new Set<string>();
    for (const route of next) {
      if (route.disposed) throw new Error(`Route ${route.key} has been disposed.`);
      if (keys.has(route.key)) throw new Error(`Duplicate route key: ${route.key}.`);
      keys.add(route.key);
      const existing = owned.get(route.key);
      if (existing && existing !== route)
        throw new Error(`Route key ${route.key} already belongs to another owner.`);
      const claimed = stackOwners.get(route);
      if (claimed && claimed !== identity)
        throw new Error(`Route ${route.key} already belongs to another stack.`);
    }
  }

  function forget(route: RouteOwner): void {
    owned.delete(route.key);
    unwatch.get(route)?.();
    unwatch.delete(route);
    stackOwners.delete(route);
    setRetained(snapshot([...owned.values()]));
  }

  function destroy(route: RouteOwner): void {
    forget(route);
    try {
      route.dispose();
    } catch (error) {
      try {
        options.onError?.(error);
      } catch {
        // Complete release even when the application's reporter throws.
      }
    }
  }

  function project(next: readonly RouteOwner[]): void {
    setEntries(snapshot(next));
    setChildren(snapshot(next.map((route) => route.node)));
  }

  function externallyDisposed(route: RouteOwner): void {
    if (pending) stack.cancel(pending.token);
    forget(route);
    project(entries().filter((entry) => entry !== route));
  }

  function adopt(next: readonly RouteOwner[]): RouteOwner[] {
    const added: RouteOwner[] = [];
    try {
      for (const route of next) {
        if (owned.has(route.key)) continue;
        unwatch.set(
          route,
          observeRouteDisposal(route, () => externallyDisposed(route)),
        );
        owned.set(route.key, route);
        stackOwners.set(route, identity);
        added.push(route);
      }
    } catch (error) {
      for (const route of added) forget(route);
      throw error;
    }
    setRetained(snapshot([...owned.values()]));
    return added;
  }

  function take(token: StackTransition): PendingTransition | null {
    if (!pending || pending.token !== token) return null;
    const current = pending;
    pending = null;
    setTransition(null);
    return current;
  }

  const stack: RetainedStack = {
    entries,
    children,
    retained,
    transition,
    get disposed() {
      return disposed;
    },
    transitionTo(next, transitionOptions = {}) {
      assertActive();
      if (pending) throw new Error('Complete or cancel the pending stack transition first.');
      validate(next);
      const token = Object.freeze({
        id: Symbol('stack transition'),
        from: entries(),
        to: snapshot(next),
      });
      const added = adopt(token.to);
      pending = { token, added, retainRemoved: transitionOptions.retainRemoved === true };
      batch(() => {
        setTransition(token);
        setEntries(token.to);
        const visible = [...token.from, ...token.to.filter((route) => !token.from.includes(route))];
        setChildren(snapshot(visible.map((route) => route.node)));
      });
      return token;
    },
    complete(token) {
      const current = take(token);
      if (!current) return false;
      batch(() => {
        project(token.to);
        if (!current.retainRemoved)
          for (const route of token.from) if (!token.to.includes(route)) destroy(route);
      });
      return true;
    },
    cancel(token) {
      const current = take(token);
      if (!current) return false;
      batch(() => {
        project(token.from.filter((route) => !route.disposed));
        for (const route of current.added) destroy(route);
      });
      return true;
    },
    dismiss(count = 1) {
      assertActive();
      if (!Number.isSafeInteger(count) || count < 1)
        throw new RangeError('A dismissal count must be a positive safe integer.');
      if (entries().length < 2) return null;
      return stack.transitionTo(entries().slice(0, Math.max(1, entries().length - count)));
    },
    release(key) {
      assertActive();
      const route = owned.get(key);
      if (!route) return false;
      if (children().includes(route.node))
        throw new Error(`Route ${key} is still visible or transitioning.`);
      destroy(route);
      return true;
    },
    clear() {
      batch(() => {
        pending = null;
        setTransition(null);
        project([]);
        for (const route of [...owned.values()]) destroy(route);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stack.clear();
    },
  };
  validate(initial);
  adopt(initial);
  project(initial);
  onCleanup(stack.dispose);
  return stack;
}
