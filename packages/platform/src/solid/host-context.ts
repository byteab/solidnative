import { createComponent, createContext, getOwner, useContext } from 'solid-js';
import type { HostEngine, HostNode } from '@solidnative/fabric';

/** Shared JSX values; native handles stay behind the host adapter. */
export type HostChild =
  | HostNode
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly HostChild[]
  | (() => HostChild);

/** Operations needed by shared Solid primitives, supplied by the owning renderer. */
export interface HostAdapter {
  readonly engine: HostEngine;
  /** A committed handle alone does not prove that a retained node is mounted. */
  isAttached(node: HostNode): boolean;
  createElement(name: string): HostNode;
  spreadProps(
    node: HostNode,
    props: Record<string, unknown> | (() => Record<string, unknown>),
    skipChildren?: boolean,
  ): void;
  insertChildren(node: HostNode, children: HostChild): void;
  onCleanup(node: HostNode, cleanup: () => void): () => void;
  afterCommit(callback: () => void): () => void;
  /** Run `callback` on the next frame, unless cancelled through what this returns. */
  requestFrame(callback: () => void): () => void;
}

const context = createContext<HostAdapter>();

/** Hosts install this under a Solid owner, so lazy descendants inherit the same adapter. */
export function withHostAdapter<T>(adapter: HostAdapter, render: () => T): T {
  if (!getOwner()) throw new Error('Host adapters require an active Solid owner.');
  let result!: T;
  createComponent(context.Provider, {
    value: adapter,
    get children() {
      result = render();
      return undefined;
    },
  });
  return result;
}

/**
 * Capture for later engine, attachment, cleanup or commit operations. Creation/spread/insert
 * still require the owning Solid context: they can create reactive computations.
 */
export function useHostAdapter(): HostAdapter {
  const adapter = useContext(context);
  if (!adapter) throw new Error('Solid host operations require an active host adapter owner.');
  return adapter;
}

export function useHostEngine(): HostEngine {
  return useHostAdapter().engine;
}

export function createHostElement(name: string): HostNode {
  return useHostAdapter().createElement(name);
}

export function spreadHostProps(
  node: HostNode,
  props: Record<string, unknown> | (() => Record<string, unknown>),
  skipChildren?: boolean,
): void {
  useHostAdapter().spreadProps(node, props, skipChildren);
}

export function insertHostChildren(node: HostNode, children: HostChild): void {
  useHostAdapter().insertChildren(node, children);
}

export function onHostCleanup(node: HostNode, cleanup: () => void): () => void {
  return useHostAdapter().onCleanup(node, cleanup);
}

export function afterHostCommit(callback: () => void): () => void {
  return useHostAdapter().afterCommit(callback);
}
