/**
 * Mounts a Solid fixture onto the fake Fabric, the way an app's root does, for the CSS suites that
 * need a component tree rather than hand-built engine nodes.
 */
import { createNativeRoot } from '@solidnative/platform/solid';
import type { EngineOptions } from '@solidnative/fabric';
import { createClock, createFakeFabric, type FakeFabricNode } from '@solidnative/testing';

export type FakeNode = FakeFabricNode;

export const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

export function mountSolid(view: () => unknown, engineOptions?: EngineOptions) {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1, engineOptions });
  root.render(view as () => never);
  const nodes = () => flatten(fabric.committed);
  const byId = (id: string) => {
    const node = nodes().find((n) => n.props['nativeID'] === id || n.props['testID'] === id);
    if (!node) throw new Error(`no native node '${id}'`);
    return node;
  };
  return {
    fabric,
    clock,
    root,
    engine: root.engine,
    nodes,
    byId,
    /** Runs the scheduled commit, as the app's microtask queue would. */
    settle: () => clock.flushMicrotasks(),
  };
}
