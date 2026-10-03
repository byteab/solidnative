import type { EngineNode, FabricNode, FabricNodeSet, FabricUIManager } from '@solid-native/fabric';

export interface FakeNode {
  readonly tag: number;
  readonly rootTag: number;
  readonly viewName: string;
  readonly instanceHandle: EngineNode;
  props: Record<string, unknown>;
  children: FakeNode[];
}

/** Immutable clone behavior and a single event slot, matching the boundary being exercised. */
export function createFakeFabric() {
  let handler: ((target: unknown, type: string, event: unknown) => void) | undefined;
  const roots = new Map<number, FakeNode[]>();
  const parents = new Map<number, number>();
  const responderCalls: { node: FakeNode; active: boolean }[] = [];
  let commits = 0;
  // Distinct dispatchers registered: every root re-claims the slot with the same one (D039).
  const eventHandlers = new Set<unknown>();
  let creates = 0;
  const clone = (node: FabricNode, props: object | undefined, children: boolean): FakeNode => {
    const source = node as FakeNode;
    return {
      ...source,
      props: { ...source.props, ...props },
      children: children ? [...source.children] : [],
    };
  };
  const adopt = (parent: number, node: FakeNode) => {
    const old = parents.get(node.tag);
    if (old !== undefined && old !== parent)
      throw new Error('Fabric cannot reparent an existing native tag.');
    parents.set(node.tag, parent);
  };
  const fabric = {
    roots,
    responderCalls,
    get commits() {
      return commits;
    },
    get creates() {
      return creates;
    },
    get eventHandlerCount() {
      return eventHandlers.size;
    },
    createNode(
      tag: number,
      viewName: string,
      rootTag: number,
      props: object,
      instanceHandle: unknown,
    ) {
      creates++;
      return {
        tag,
        viewName,
        rootTag,
        props: { ...props },
        instanceHandle: instanceHandle as EngineNode,
        children: [],
      };
    },
    cloneNodeWithNewChildren: (node: FabricNode) => clone(node, undefined, false),
    cloneNodeWithNewProps: (node: FabricNode, props: object) => clone(node, props, true),
    cloneNodeWithNewChildrenAndProps: (node: FabricNode, props: object) =>
      clone(node, props, false),
    appendChild(parent: FabricNode, child: FabricNode) {
      adopt((parent as FakeNode).tag, child as FakeNode);
      (parent as FakeNode).children.push(child as FakeNode);
      return parent;
    },
    createChildSet: () => [] as FakeNode[],
    appendChildToSet(set: FabricNodeSet, child: FabricNode) {
      adopt(-(child as FakeNode).rootTag, child as FakeNode);
      (set as FakeNode[]).push(child as FakeNode);
    },
    completeRoot(rootTag: number, set: FabricNodeSet) {
      commits++;
      roots.set(rootTag, set as FakeNode[]);
    },
    registerEventHandler(callback: (target: unknown, type: string, event: unknown) => void) {
      eventHandlers.add(callback);
      handler = callback;
    },
    setIsJSResponder(node: FabricNode, active: boolean) {
      responderCalls.push({ node: node as FakeNode, active });
    },
    emit(node: FakeNode | EngineNode, type: string, event: unknown = {}) {
      handler?.('instanceHandle' in node ? node.instanceHandle : node, type, event);
    },
  } satisfies FabricUIManager & Record<string, unknown>;
  return fabric;
}

export function createClock() {
  const microtasks: (() => void)[] = [];
  const frames = new Map<number, (time: number) => void>();
  let id = 0;
  return {
    microtasks,
    frames,
    queueMicrotask(callback: () => void) {
      microtasks.push(callback);
    },
    requestFrame(callback: (time: number) => void) {
      frames.set(++id, callback);
      return id;
    },
    cancelFrame(handle: unknown) {
      frames.delete(handle as number);
    },
    flushMicrotasks() {
      let count = 0;
      while (microtasks.length) {
        if (++count > 100) throw new Error('Microtask loop did not settle.');
        microtasks.shift()!();
      }
    },
    frame(time: number) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    },
  };
}
