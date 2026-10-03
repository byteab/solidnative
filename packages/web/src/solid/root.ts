import { createRoot, getOwner, onCleanup, runWithOwner, type Owner } from 'solid-js';
import { withServiceScope, type ServiceBinding } from '@solidnative/device';
import type { HostNode } from '@solidnative/fabric';
import { BrowserEngine } from '../browser-engine.ts';
import type { BrowserNode } from '../dom-node.ts';
import { ISLAND_RESET_CSS, RESET_CSS } from '../reset-css.ts';
import { browserServices } from './device.ts';
import {
  currentBrowser,
  registerNode,
  withBrowserContext,
  withHostAdapter,
  type BrowserContext,
  type HostAdapter,
  type HostChild,
} from './context.ts';
import { renderer, spread } from './renderer.ts';

export interface BrowserRootOptions {
  readonly island?: boolean;
  readonly injectReset?: boolean;
  readonly services?: readonly ServiceBinding[];
  readonly onError?: (error: unknown) => void;
  /** Inherit the surrounding Solid service scope and tie disposal to that owner. */
  readonly owner?: Owner | null;
}
export interface BrowserRoot {
  readonly engine: BrowserEngine;
  readonly node: BrowserNode;
  readonly disposed: boolean;
  render(code: () => HostChild): void;
  flush(): boolean;
  afterCommit(callback: () => void): () => void;
  dispose(): void;
}
const roots = new WeakSet<Element>();
function reset(document: Document, island: boolean): void {
  const id = island ? 'solidnative-web-island-reset' : 'solidnative-web-reset';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `@layer base {\n${island ? ISLAND_RESET_CSS : RESET_CSS}\n}`;
  document.head.insertBefore(style, document.head.firstChild);
}
function contain(owner: Owner, report: (error: unknown) => void): void {
  for (const child of owner.owned ?? []) contain(child, report);
  if (owner.cleanups)
    owner.cleanups = owner.cleanups.map((cleanup) => () => {
      try {
        cleanup();
      } catch (error) {
        report(error);
      }
    });
}
/** Solid universal host over BrowserEngine. No native renderer is imported. */
export function createBrowserRoot(element: Element, options: BrowserRootOptions = {}): BrowserRoot {
  if (roots.has(element)) throw new Error('This element already has an active Solid browser root.');
  roots.add(element);
  const report = (error: unknown) => {
    try {
      (options.onError ?? console.error)(error);
    } catch {
      /* contain reporter */
    }
  };
  const original = new Map(
    ['data-rn', 'data-rn-root'].map((name) => [name, element.getAttribute(name)]),
  );
  const hadPlatform = element.classList.contains('platform-web');
  let engine: BrowserEngine;
  try {
    if (options.injectReset !== false) reset(element.ownerDocument, options.island ?? false);
    engine = new BrowserEngine(element.ownerDocument, { onError: report });
  } catch (error) {
    roots.delete(element);
    throw error;
  }
  const node = engine.wrapRoot(element);
  element.setAttribute('data-rn-root', '');
  element.classList.add('platform-web');
  const nodes = new Map<BrowserNode, Set<() => void>>([[node, new Set()]]);
  const released = new Set<BrowserNode>();
  const pending = new Set<() => void>();
  let disposed = false,
    mounted = false,
    constructing = false,
    scheduled = false,
    finalized = false;
  let disposeOwner: (() => void) | undefined;
  let owner: Owner | null = null;
  const attached = (child: BrowserNode) => {
    while (child.parent) child = child.parent;
    return child === node;
  };
  const safe = (callback: () => void) => {
    try {
      callback();
    } catch (error) {
      report(error);
    }
  };
  function destroy(child: BrowserNode): void {
    const resources = nodes.get(child);
    if (!resources) return;
    nodes.delete(child);
    released.delete(child);
    for (const cleanup of [...resources]) safe(cleanup);
    engine.destroyNode(child);
  }
  function flush(): boolean {
    scheduled = false;
    if (disposed) return false;
    for (const child of released) if (!attached(child)) destroy(child);
    const callbacks = [...pending];
    pending.clear();
    for (const callback of callbacks) {
      if (disposed) break;
      safe(callback);
    }
    return false; // DOM writes are synchronous; no Fabric-style commit is manufactured.
  }
  function schedule(): void {
    if (disposed || scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
  }
  function cleanup(child: BrowserNode, callback: () => void): () => void {
    const resources = nodes.get(child);
    if (!resources || disposed) {
      safe(callback);
      return () => {};
    }
    let active = true;
    const remove = () => {
      if (!active) return;
      active = false;
      resources.delete(remove);
      callback();
    };
    resources.add(remove);
    return remove;
  }
  const context: BrowserContext = {
    engine,
    root: node,
    get disposed() {
      return disposed;
    },
    own(child) {
      nodes.set(child, new Set());
      registerNode(child, context);
      onCleanup(() => context.release(child));
      return child;
    },
    release(child) {
      released.add(child);
      schedule();
    },
    owns: (child) => nodes.has(child as BrowserNode),
    cleanup,
    afterCommit(callback) {
      if (disposed) return () => {};
      const caller = getOwner();
      const run = () => runWithOwner(caller, callback);
      const cancel = () => {
        pending.delete(run);
      };
      pending.add(run);
      schedule();
      if (caller) onCleanup(cancel);
      return cancel;
    },
    report,
  };
  registerNode(node, context);
  function validate(child: HostNode): BrowserNode {
    if (disposed || !nodes.has(child as BrowserNode))
      throw new Error('Node does not belong to this active browser root.');
    return child as BrowserNode;
  }
  function bindingOwner(): void {
    if (currentBrowser() !== context)
      throw new Error('Create browser bindings under their owning host adapter.');
  }
  const adapter: HostAdapter = {
    engine,
    isAttached: (child) =>
      !disposed && nodes.has(child as BrowserNode) && attached(child as BrowserNode),
    createElement(name) {
      bindingOwner();
      return renderer.createElement(name);
    },
    spreadProps(child, props, skip) {
      bindingOwner();
      spread(validate(child), props, skip);
    },
    insertChildren(child, children) {
      bindingOwner();
      renderer.insert(validate(child), children as never);
    },
    onCleanup: (child, callback) => cleanup(validate(child), callback),
    afterCommit: context.afterCommit,
    requestFrame(callback) {
      if (disposed) return () => {};
      const handle = requestAnimationFrame(() => {
        if (!disposed) safe(callback);
      });
      return () => cancelAnimationFrame(handle);
    },
  };
  function finalize(): void {
    if (finalized || constructing) return;
    finalized = true;
    if (owner) contain(owner, report);
    if (disposeOwner) safe(disposeOwner);
    for (const child of [...node.children]) {
      child.el.parentNode?.removeChild(child.el);
      child.parent = null;
    }
    node.children.length = 0;
    for (const child of [...nodes.keys()]) destroy(child);
    engine.dispose();
    for (const [name, value] of original) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    if (!hadPlatform) element.classList.remove('platform-web');
    roots.delete(element);
  }
  const root: BrowserRoot = {
    engine,
    node,
    get disposed() {
      return disposed;
    },
    flush,
    afterCommit: context.afterCommit,
    render(code) {
      if (mounted || disposed)
        throw new Error('A browser root can render only once before disposal.');
      mounted = true;
      constructing = true;
      try {
        createRoot((dispose) => {
          disposeOwner = dispose;
          owner = getOwner();
          withBrowserContext(context, () =>
            withHostAdapter(adapter, () =>
              withServiceScope(
                [
                  ...new Map(
                    [...browserServices(element.ownerDocument), ...(options.services ?? [])].map(
                      (binding) => [binding.token, binding],
                    ),
                  ).values(),
                ],
                () => renderer.insert(node, code() as never),
                report,
              ),
            ),
          );
        }, options.owner ?? null);
      } catch (error) {
        root.dispose();
        throw error;
      } finally {
        constructing = false;
        if (disposed) finalize();
      }
      flush();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending.clear();
      finalize();
    },
  };
  if (options.owner) runWithOwner(options.owner, () => onCleanup(root.dispose));
  return root;
}
export function mountBrowser(
  code: () => HostChild,
  element: Element,
  options?: BrowserRootOptions,
): BrowserRoot {
  const root = createBrowserRoot(element, options);
  root.render(code);
  return root;
}
