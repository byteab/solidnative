/**
 * Fake `global.nativeFabricUIManager`. Records every host call so tests can assert on
 * the committed tree without a simulator. This is what lets the whole seam be tested in Node.
 */
import type { FabricNode, FabricNodeSet, FabricUIManager } from '@solidnative/fabric';
import type { NativeClock } from '@solidnative/platform/solid';

export interface FakeFabricNode {
  handle: number;
  reactTag: number;
  viewName: string;
  props: Record<string, unknown>;
  children: FakeFabricNode[];
  instanceHandle: unknown;
}

export interface FakeFabric extends FabricUIManager {
  /** Root child set from the most recent `completeRoot`. */
  readonly committed: FakeFabricNode[];
  readonly calls: {
    createNode: number;
    cloneWithChildren: number;
    cloneWithProps: number;
    cloneWithChildrenAndProps: number;
    completeRoot: number;
  };
  /**
   * Indented view-name tree, for golden assertions. `props: true` includes the flattened
   * prop payload, so a parity test catches prop regressions as well as shape ones.
   */
  render(options?: { props?: boolean }): string;
  find(viewName: string): FakeFabricNode | undefined;
  /** Drive the registered Fabric event handler, as the C++ side would. */
  emit(target: FakeFabricNode, topLevelType: string, nativeEvent?: unknown): void;
  /** Every `setIsJSResponder` the renderer made, in order. */
  readonly responderCalls: { viewName: string; isResponder: boolean; block: boolean }[];
  /**
   * Every `dispatchCommand`, in order. `node` is the node it was sent to, as a non-enumerable
   * property: there to read, and left out of a `deepEqual`.
   */
  readonly commands: {
    viewName: string;
    name: string;
    args: readonly unknown[];
    readonly node?: FakeFabricNode;
  }[];
  /**
   * What `measureInWindow` answers, keyed by `nativeID` and falling back to view name.
   *
   * A test sets the frames it cares about; a node with no entry is not measured at all, which is
   * what the real thing does for a view the platform has not laid out. The two keys are for the
   * two shapes a test comes in: one candidate on screen, where the view name says all there is to
   * say, and several, where which one got measured is the whole question.
   */
  readonly frames: Map<string, { x: number; y: number; width: number; height: number }>;
  reset(): void;
}

/**
 * Keep the instance handle off the node's enumerable props. It is the engine's own node, which
 * reaches the whole application, and a node a query returns ends up printed in any failed
 * assertion about it: Node's inspector and Vitest's formatter both walk enumerable keys only.
 */
function withHandle(node: Omit<FakeFabricNode, 'instanceHandle'>, instanceHandle: unknown) {
  Object.defineProperty(node, 'instanceHandle', {
    value: instanceHandle,
    enumerable: false,
    writable: true,
  });
  return node as FakeFabricNode;
}

export function createFakeFabric(): FakeFabric {
  let handle = 0;
  let committed: FakeFabricNode[] = [];
  let handler: ((h: unknown, t: string, e: unknown) => void) | null = null;
  const responderCalls: { viewName: string; isResponder: boolean; block: boolean }[] = [];
  const commands: { viewName: string; name: string; args: readonly unknown[] }[] = [];
  const frames = new Map<string, { x: number; y: number; width: number; height: number }>();
  const calls = {
    createNode: 0,
    cloneWithChildren: 0,
    cloneWithProps: 0,
    cloneWithChildrenAndProps: 0,
    completeRoot: 0,
  };

  /*
   * The parent each view has been appended to, by tag. Native keeps one parent per view for as
   * long as it lives - `ShadowNodeFamily::setParent` asserts it, in a debug build, and a release
   * build goes on with the old parent and measures and lays out against the wrong ancestry - so a
   * view that moves has to be created again, as React does. This fails the test that tries.
   */
  const parents = new Map<number, number>();
  const ROOT = -1;
  const adopt = (parent: number, child: FakeFabricNode): void => {
    const was = parents.get(child.reactTag);
    if (was !== undefined && was !== parent) {
      throw new Error(
        `${child.viewName} ${child.reactTag} was appended to ${parent} after ${was}: native ` +
          'never re-parents a view, and asserts on it. Create it again instead.',
      );
    }
    parents.set(child.reactTag, parent);
  };

  const clone = (n: FabricNode, props?: object, keepChildren = false): FabricNode => {
    const source = n as unknown as FakeFabricNode;
    return withHandle(
      {
        ...source,
        handle: ++handle,
        // Fabric merges raw props onto the source props rather than replacing them.
        props: props ? { ...source.props, ...props } : source.props,
        children: keepChildren ? source.children : [],
      },
      source.instanceHandle,
    ) as unknown as FabricNode;
  };

  const node = (
    reactTag: number,
    viewName: string,
    props: object,
    instanceHandle: unknown,
  ): FakeFabricNode =>
    withHandle(
      { handle: ++handle, reactTag, viewName, props: { ...props }, children: [] },
      instanceHandle,
    );

  const walk = (nodes: FakeFabricNode[], depth: number, withProps: boolean): string[] =>
    nodes.flatMap((n) => {
      const text = typeof n.props['text'] === 'string' ? ` "${n.props['text']}"` : '';
      const props =
        withProps && Object.keys(n.props).length && !text
          ? ' ' + JSON.stringify(n.props, Object.keys(n.props).sort())
          : '';
      return [
        '  '.repeat(depth) + n.viewName + text + props,
        ...walk(n.children, depth + 1, withProps),
      ];
    });

  const fake: FakeFabric = {
    createNode(reactTag, viewName, _rootTag, props, instanceHandle) {
      calls.createNode++;
      return node(reactTag, viewName, props, instanceHandle) as unknown as FabricNode;
    },
    cloneNodeWithNewChildren(n) {
      calls.cloneWithChildren++;
      return clone(n);
    },
    cloneNodeWithNewProps(n, newProps) {
      calls.cloneWithProps++;
      return clone(n, newProps, true);
    },
    cloneNodeWithNewChildrenAndProps(n, newProps) {
      calls.cloneWithChildrenAndProps++;
      return clone(n, newProps);
    },
    appendChild(parent, child) {
      const into = parent as unknown as FakeFabricNode;
      adopt(into.reactTag, child as unknown as FakeFabricNode);
      into.children.push(child as unknown as FakeFabricNode);
      return parent;
    },
    createChildSet() {
      return [] as FabricNodeSet;
    },
    appendChildToSet(set, child) {
      adopt(ROOT, child as unknown as FakeFabricNode);
      (set as FakeFabricNode[]).push(child as unknown as FakeFabricNode);
    },
    completeRoot(_rootTag, set) {
      calls.completeRoot++;
      committed = set as FakeFabricNode[];
    },
    registerEventHandler(fn) {
      handler = fn;
    },
    setIsJSResponder(node, isResponder, block) {
      responderCalls.push({
        viewName: (node as unknown as FakeFabricNode).viewName,
        isResponder,
        block,
      });
    },
    measureInWindow(node, onSuccess) {
      // By `nativeID` first, so a test that cares which of two views was measured can say so; by
      // view name otherwise, which is enough when there is only one candidate on screen.
      const fake = node as unknown as FakeFabricNode;
      const frame = frames.get(String(fake.props['nativeID'])) ?? frames.get(fake.viewName);
      if (frame) onSuccess(frame.x, frame.y, frame.width, frame.height);
    },
    dispatchCommand(node, name, args) {
      const command = { viewName: (node as unknown as FakeFabricNode).viewName, name, args };
      // Which node, for a test that has several of one view; off the enumerable keys, so a
      // `deepEqual` against `{ viewName, name, args }` still holds.
      Object.defineProperty(command, 'node', { value: node, enumerable: false });
      commands.push(command as typeof command & { node: FakeFabricNode });
    },
    responderCalls,
    commands,
    frames,
    get committed() {
      return committed;
    },
    calls,
    render(options) {
      return walk(committed, 0, options?.props === true).join('\n');
    },
    find(viewName) {
      const search = (nodes: FakeFabricNode[]): FakeFabricNode | undefined => {
        for (const n of nodes) {
          if (n.viewName === viewName) return n;
          const hit = search(n.children);
          if (hit) return hit;
        }
        return undefined;
      };
      return search(committed);
    },
    emit(target, type, nativeEvent = {}) {
      if (!handler) throw new Error('no Fabric event handler registered');
      handler(target.instanceHandle, type, nativeEvent);
    },
    reset() {
      calls.createNode = 0;
      calls.cloneWithChildren = 0;
      calls.cloneWithProps = 0;
      calls.cloneWithChildrenAndProps = 0;
      calls.completeRoot = 0;
    },
  };

  return fake;
}

/** A clock a test drives by hand, for `render(..., { clock })`: nothing runs until it is told to. */
export interface ManualClock extends NativeClock {
  /** Run queued microtasks, and the ones they queue, until none are left. */
  flushMicrotasks(): void;
  /** Run every requested animation frame once, at `time`. */
  frame(time: number): void;
}

export function createClock(): ManualClock {
  const microtasks: (() => void)[] = [];
  const frames = new Map<number, (time: number) => void>();
  let id = 0;
  return {
    queueMicrotask: (callback) => void microtasks.push(callback),
    requestFrame(callback) {
      frames.set(++id, callback);
      return id;
    },
    cancelFrame: (handle) => void frames.delete(handle as number),
    flushMicrotasks() {
      for (let count = 0; microtasks.length; count++) {
        if (count > 1000) throw new Error('Microtasks did not settle.');
        microtasks.shift()!();
      }
    },
    frame(time) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    },
  };
}
