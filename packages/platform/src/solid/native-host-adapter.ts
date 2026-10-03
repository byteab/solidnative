import type { EngineNode, HostNode } from '@solidnative/fabric';
import { currentRoot, NodeLifetime, onNativeCleanup, type RootContext } from './context.ts';
import { useHostAdapter, type HostAdapter } from './host-context.ts';
import { createElementIn, renderer, spread } from './renderer.ts';

/** The only conversion from the portable node contract to native retained nodes. */
export function createNativeHostAdapter(
  root: RootContext,
  afterCommit: HostAdapter['afterCommit'],
  requestFrame: HostAdapter['requestFrame'],
): HostAdapter {
  function assertBindingOwner(): void {
    if (currentRoot() !== root || useHostAdapter() !== adapter)
      throw new Error('Create native bindings under their owning host adapter.');
  }

  function nativeNode(node: HostNode): EngineNode {
    if (root.disposed || node.host !== root.engine)
      throw new Error('The node does not belong to this active native root.');
    const native = node as EngineNode;
    const data = native.hostData;
    if (data === undefined) throw new Error('The node does not belong to a Solid native root.');
    if (data instanceof NodeLifetime && (data.root !== root || !data.active || data.released))
      throw new Error('The native node has been disposed.');
    return native;
  }
  const adapter: HostAdapter = {
    engine: root.engine,
    isAttached(node) {
      let current: EngineNode;
      try {
        current = nativeNode(node);
      } catch {
        return false;
      }
      while (current.parent) current = current.parent;
      return current === root.engine.root;
    },
    createElement(name) {
      assertBindingOwner();
      return createElementIn(root, name);
    },
    spreadProps(node, props, skipChildren) {
      assertBindingOwner();
      spread(nativeNode(node), props, skipChildren);
    },
    insertChildren(node, children) {
      assertBindingOwner();
      // The universal renderer validates each inserted node through its native lifetime.
      renderer.insert(nativeNode(node), children as Parameters<typeof renderer.insert>[1]);
    },
    onCleanup: (node, cleanup) => onNativeCleanup(nativeNode(node), cleanup),
    afterCommit,
    requestFrame,
  };
  return adapter;
}
