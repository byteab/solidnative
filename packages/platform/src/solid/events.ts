import { batch } from 'solid-js';
import type { Engine, EngineNode, FabricUIManager } from '@solid-native/fabric';

type Handler =
  NonNullable<FabricUIManager['registerEventHandler']> extends (handler: infer T) => void
    ? T
    : never;

interface Routes {
  readonly roots: Map<
    number,
    { engine: Engine; handler: Handler; report: (error: unknown, source: string) => void }
  >;
  readonly dispatch: Handler;
}

const managers = new WeakMap<FabricUIManager, Routes>();

/**
 * React's Fabric renderer claims the one event slot when its module loads, and React Native loads
 * it lazily: the first read of `AccessibilityInfo` (the device conditions do one after mount) is
 * enough. Claimed after ours, every native event lands in React's plugins, which throw
 * `Unsupported top level event type` from inside the native dispatch. Loading it first means ours
 * is the last claim. Required, not imported: React Native ships Flow, which Node cannot parse, and
 * a test or the web has no React Native at all.
 */
function loadReactRenderer(): void {
  try {
    require('react-native/Libraries/Renderer/shims/ReactFabric');
  } catch {
    // No React Native under us.
  }
}

/** One dispatcher per Fabric manager, routing each event to the root whose engine owns it. */
function routesFor(fabric: FabricUIManager): Routes {
  const known = managers.get(fabric);
  if (known) return known;
  const roots: Routes['roots'] = new Map();
  const routes: Routes = {
    roots,
    dispatch: (target, type, event) => {
      const node = target as EngineNode | null;
      if (!node?.host) return;
      for (const { engine, handler, report } of roots.values()) {
        if (node.host !== engine) continue;
        let top = node;
        while (top.parent) top = top.parent;
        if (top !== engine.root) return;
        // The engine isolates individual listeners. Its error reporter is contained by root.ts.
        try {
          batch(() => handler(target, type, event));
        } catch (error) {
          report(error, type);
        }
        return;
      }
    },
  };
  managers.set(fabric, routes);
  return routes;
}

/**
 * Fabric has one callback slot. Share it across this adapter's active surfaces.
 *
 * Claimed again on every reservation, not once per manager: in a session that also runs React
 * surfaces, React can take the slot back after our first claim, and a later Solid root would then
 * never receive an event. Re-registering the same dispatcher is idempotent.
 */
export function reserveSurface(fabric: FabricUIManager, rootTag: number) {
  const routes = routesFor(fabric);
  if (routes.roots.has(rootTag)) throw new Error(`Native root ${rootTag} is already mounted.`);
  loadReactRenderer();
  fabric.registerEventHandler?.(routes.dispatch);
  let handler: Handler | undefined;
  // A plain object, not a Proxy: the engine calls through it for every node it creates, clones
  // and appends, and Hermes runs a Proxy trap on each of those calls. Each method is still looked
  // up on the manager when it is called, so a method replaced later (an instrument, a test) is the
  // one that runs, and an optional one reads as absent while the manager has none.
  const manager: FabricUIManager = {
    createNode: (tag, viewName, rootTag, props, handle) =>
      fabric.createNode(tag, viewName, rootTag, props, handle),
    cloneNodeWithNewChildren: (node) => fabric.cloneNodeWithNewChildren(node),
    cloneNodeWithNewProps: (node, props) => fabric.cloneNodeWithNewProps(node, props),
    cloneNodeWithNewChildrenAndProps: (node, props) =>
      fabric.cloneNodeWithNewChildrenAndProps(node, props),
    appendChild: (parent, child) => fabric.appendChild(parent, child),
    createChildSet: (tag) => fabric.createChildSet(tag),
    appendChildToSet: (set, child) => fabric.appendChildToSet(set, child),
    completeRoot: (tag, set) => fabric.completeRoot(tag, set),
    registerEventHandler: (next) => (handler = next),
    get setIsJSResponder() {
      return fabric.setIsJSResponder?.bind(fabric);
    },
    get dispatchCommand() {
      return fabric.dispatchCommand?.bind(fabric);
    },
    get measureInWindow() {
      return fabric.measureInWindow?.bind(fabric);
    },
  };
  return {
    manager,
    attach(engine: Engine, report: (error: unknown, source: string) => void) {
      if (!handler) throw new Error('The native engine did not register an event handler.');
      routes.roots.set(rootTag, { engine, handler, report });
    },
    release() {
      routes.roots.delete(rootTag);
      // The installed dispatcher becomes a no-op when the map is empty; no engine is retained.
    },
  };
}
