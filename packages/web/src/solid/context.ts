import { createComponent, createContext, getOwner, useContext } from 'solid-js';
import type { HostEngine, HostNode } from '@solid-native/fabric';
import type { BrowserEngine } from '../browser-engine.ts';
import type { BrowserNode } from '../dom-node.ts';

/** The browser implementation of the shared, structural HostAdapter contract. */
export type HostChild =
  | HostNode
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly HostChild[]
  | (() => HostChild);
export interface HostAdapter {
  readonly engine: HostEngine;
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
  requestFrame(callback: () => void): () => void;
}
export interface BrowserContext {
  engine: BrowserEngine;
  root: BrowserNode;
  disposed: boolean;
  own(node: BrowserNode): BrowserNode;
  release(node: BrowserNode): void;
  owns(node: HostNode): boolean;
  cleanup(node: BrowserNode, cleanup: () => void): () => void;
  afterCommit(callback: () => void): () => void;
  report(error: unknown): void;
}
const host = createContext<HostAdapter>();
const browser = createContext<BrowserContext>();
function provide<T, V>(context: ReturnType<typeof createContext<V>>, value: V, render: () => T): T {
  let result!: T;
  createComponent(context.Provider, {
    value,
    get children() {
      result = render();
      return undefined;
    },
  });
  return result;
}
export function withHostAdapter<T>(adapter: HostAdapter, render: () => T): T {
  if (!getOwner()) throw new Error('Host adapters require an active Solid owner.');
  return provide(host, adapter, render);
}
export const withBrowserContext = <T>(context: BrowserContext, render: () => T): T =>
  provide(browser, context, render);
export function currentBrowser(): BrowserContext {
  const value = useContext(browser);
  if (!value || value.disposed)
    throw new Error('Browser rendering requires an active browser root owner.');
  return value;
}
export function useHostAdapter(): HostAdapter {
  const value = useContext(host);
  if (!value) throw new Error('Solid host operations require an active host adapter owner.');
  return value;
}
export const useHostEngine = (): HostEngine => useHostAdapter().engine;
export const createHostElement = (name: string): HostNode => useHostAdapter().createElement(name);
export const spreadHostProps: HostAdapter['spreadProps'] = (...args) =>
  useHostAdapter().spreadProps(...args);
export const insertHostChildren: HostAdapter['insertChildren'] = (...args) =>
  useHostAdapter().insertChildren(...args);
export const onHostCleanup: HostAdapter['onCleanup'] = (...args) =>
  useHostAdapter().onCleanup(...args);
export const afterHostCommit: HostAdapter['afterCommit'] = (callback) =>
  useHostAdapter().afterCommit(callback);
export const onNativeCleanup = onHostCleanup;

const contexts = new WeakMap<BrowserNode, BrowserContext>();
export function registerNode(node: BrowserNode, context: BrowserContext): void {
  contexts.set(node, context);
}
export function contextOf(node: BrowserNode): BrowserContext {
  const context = contexts.get(node);
  if (!context) throw new Error('Node does not belong to a Solid browser root.');
  return context;
}
