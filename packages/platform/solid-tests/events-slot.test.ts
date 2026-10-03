/**
 * Fabric's one event slot (D039). React's renderer claims it when its module loads, so ours has to
 * load that module first and claim after it, and claim again for every root in case React took the
 * slot back in between.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { Engine, FabricUIManager } from '@solidnative/fabric';
import { reserveSurface } from '../src/solid/events.ts';

type Handler = (target: unknown, type: string, event: unknown) => void;

const scope = globalThis as { require?: (id: string) => unknown };
const original = scope.require;
afterEach(() => {
  scope.require = original;
});

/** Only the slot matters here: a manager that records each claim, in order with the requires. */
function fakeManager(log: string[]) {
  let current: Handler | undefined;
  const fabric = {
    registerEventHandler(handler: Handler) {
      current = handler;
      log.push('register');
    },
  } as unknown as FabricUIManager;
  return { fabric, current: () => current, claim: (handler: Handler) => (current = handler) };
}

/** A root whose engine owns one node, and the handler that engine registered. */
function mountRoot(fabric: FabricUIManager, rootTag: number, seen: string[]) {
  const surface = reserveSurface(fabric, rootTag);
  surface.manager.registerEventHandler?.((_target, type) => void seen.push(`${rootTag}:${type}`));
  const node: { host?: unknown; parent: null } = { parent: null };
  const engine = { root: node } as unknown as Engine;
  node.host = engine;
  surface.attach(engine, (error) => {
    throw error;
  });
  return { surface, node };
}

test("loads React's Fabric renderer before claiming the slot", () => {
  const log: string[] = [];
  scope.require = (id) => void log.push(`require ${id}`);
  const { fabric } = fakeManager(log);
  reserveSurface(fabric, 1);
  assert.deepEqual(log, ['require react-native/Libraries/Renderer/shims/ReactFabric', 'register']);
});

test('carries on without React Native when the renderer cannot be required', () => {
  const log: string[] = [];
  scope.require = () => {
    throw new Error('Cannot find module');
  };
  const { fabric } = fakeManager(log);
  reserveSurface(fabric, 1);
  assert.deepEqual(log, ['register']);
});

test('a later root takes the slot back after React claimed it, with the same dispatcher', () => {
  scope.require = () => undefined;
  const log: string[] = [];
  const seen: string[] = [];
  const manager = fakeManager(log);
  const first = mountRoot(manager.fabric, 1, seen);
  const dispatcher = manager.current();

  // A React surface in the same session loads its renderer late and claims the slot.
  manager.claim(() => seen.push('react'));
  first.surface.release();

  const second = mountRoot(manager.fabric, 2, seen);
  assert.equal(manager.current(), dispatcher, 'the same shared dispatcher, not a second one');
  manager.current()!(second.node, 'topTouchEnd', {});
  assert.deepEqual(seen, ['2:topTouchEnd']);

  // Idempotent: a third root re-registers the same function, and both routes still work.
  const third = mountRoot(manager.fabric, 3, seen);
  assert.equal(manager.current(), dispatcher);
  manager.current()!(third.node, 'topPress', {});
  manager.current()!(second.node, 'topPress', {});
  assert.deepEqual(seen, ['2:topTouchEnd', '3:topPress', '2:topPress']);
});
