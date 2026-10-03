import assert from 'node:assert/strict';
import { test } from 'node:test';
import { batch, createSignal, mapArray, onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { EngineNode, ResponderHandlers } from '@solidnative/fabric';
import {
  createElement,
  createNativeRoot,
  effect,
  insert,
  insertNode,
  onNativeCleanup,
  setProp,
  spread,
  useHostEngine,
} from '../src/solid.ts';
import { createClock, createFakeFabric } from './fake-fabric.ts';

test('real client signals and stores coalesce and preserve reused native text identity', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  const [count, setCount] = createSignal(0);
  const [store, setStore] = createStore({ count: 0 });
  let label!: EngineNode;
  root.render(() => {
    assert.equal(useHostEngine(), root.engine);
    label = createElement('text');
    insert(label, () => `${count()}:${store.count}`);
    return label;
  });
  const text = label.children[0]!;
  const tag = root.engine.tagOf(text);
  const first = fabric.roots.get(1)![0]!;
  assert.equal(first.children[0]!.props['text'], '0:0');
  assert.equal(fabric.commits, 1);
  batch(() => {
    setCount(1);
    setStore('count', 2);
    setCount(3);
  });
  assert.equal(fabric.commits, 1);
  clock.flushMicrotasks();
  assert.equal(fabric.commits, 2);
  assert.equal(label.children[0], text);
  assert.equal(root.engine.tagOf(text), tag);
  assert.equal(fabric.roots.get(1)![0]!.children[0]!.props['text'], '3:2');
  assert.notEqual(fabric.roots.get(1)![0], first, 'changed descendant clones its ancestor');
  assert.equal(first.children[0]!.props['text'], '0:0', 'the committed snapshot remains immutable');
  setCount(3);
  clock.flushMicrotasks();
  assert.equal(root.flush(), false);
  assert.equal(fabric.commits, 2);
  root.dispose();
  setCount(8);
  setStore('count', 9);
  clock.flushMicrotasks();
  assert.deepEqual(fabric.roots.get(1), []);
  assert.equal(text.committed, null);
  assert.equal(root.flush(), false);
});

test('keyed item movement keeps native tags while removed owner resources are released once', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  const [items, setItems] = createSignal([1, 2, 3]);
  const rows = new Map<number, EngineNode>();
  const cleanups: number[] = [];
  root.render(() => {
    const list = createElement('view');
    insert(
      list,
      mapArray(items, (id) => {
        const node = createElement('view');
        setProp(node, 'testID', `row-${id}`);
        setProp(node, 'onTouchEnd', () => {});
        rows.set(id, node);
        onNativeCleanup(node, () => cleanups.push(id));
        return node;
      }),
    );
    return list;
  });
  const tags = new Map([...rows].map(([id, node]) => [id, root.engine.tagOf(node)]));
  const creates = fabric.creates;
  setItems([3, 1, 2]);
  clock.flushMicrotasks();
  assert.equal(fabric.creates, creates);
  for (const [id, node] of rows) assert.equal(root.engine.tagOf(node), tags.get(id));
  assert.deepEqual(
    fabric.roots.get(1)![0]!.children.map((node) => node.props['testID']),
    ['row-3', 'row-1', 'row-2'],
  );
  setItems([3, 2]);
  clock.flushMicrotasks();
  assert.deepEqual(cleanups, [1]);
  assert.equal(rows.get(1)!.committed, null);
  assert.equal(rows.get(1)!.listeners, null);
  root.dispose();
  root.dispose();
  assert.deepEqual(cleanups.sort(), [1, 2, 3]);
});

test('detach and later reinsert retains owner-live nodes; disposal also destroys detached nodes', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  const [shown, setShown] = createSignal(true);
  let retained!: EngineNode;
  let cleanups = 0;
  root.render(() => {
    const parent = createElement('view');
    retained = createElement('view');
    onNativeCleanup(retained, () => cleanups++);
    insert(parent, () => (shown() ? [retained] : []));
    return parent;
  });
  const tag = root.engine.tagOf(retained);
  const native = retained.committed;
  setShown(false);
  clock.flushMicrotasks();
  assert.equal(retained.parent, null);
  assert.equal(retained.committed, native);
  assert.equal(cleanups, 0);
  setShown(true);
  clock.flushMicrotasks();
  assert.equal(root.engine.tagOf(retained), tag);
  setShown(false);
  clock.flushMicrotasks();
  root.dispose();
  assert.equal(retained.committed, null);
  assert.equal(cleanups, 1);
  setProp(retained, 'testID', 'too late');
  assert.equal(retained.props['testID'], undefined);
});

test('owner cleanup removes retained children after root disposal starts without reviving the root', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const errors: unknown[] = [];
  const root = createNativeRoot({
    fabric,
    rootTag: 1,
    clock,
    engineOptions: { onError: (error) => errors.push(error) },
  });
  let parent!: EngineNode;
  let child!: EngineNode;
  let cleanups = 0;
  root.render(() => {
    parent = createElement('view');
    child = createElement('view');
    insertNode(parent, child);
    onNativeCleanup(child, () => cleanups++);
    onCleanup(() => {
      assert.equal(root.disposed, true);
      // Universal clears a parent by repeatedly removing its first child. This operation
      // must still make progress when a retained owner's cleanup clears its projection.
      insert(parent, null);
      assert.equal(parent.children.length, 0);
      assert.equal(child.parent, null);
      insertNode(parent, child);
      assert.equal(parent.children.length, 0, 'disposal cannot remount native children');
    });
    return parent;
  });
  root.dispose();
  root.dispose();
  assert.deepEqual(errors, []);
  assert.equal(cleanups, 1);
  assert.equal(child.committed, null);
  assert.deepEqual(fabric.roots.get(1), []);
  const commits = fabric.commits;
  clock.flushMicrotasks();
  assert.equal(fabric.commits, commits);
  assert.equal(root.flush(), false);
  const remount = createNativeRoot({ fabric, rootTag: 1, clock });
  remount.render(() => createElement('view'));
  remount.dispose();
});

for (const skipChildren of [false, true])
  test(`spread (skipChildren: ${skipChildren}) replaces callbacks, removes omitted props and listeners, and calls ref`, () => {
    const fabric = createFakeFabric();
    const clock = createClock();
    const root = createNativeRoot({ fabric, rootTag: 1, clock });
    const calls: string[] = [];
    const [props, setProps] = createSignal<Record<string, unknown>>({
      testID: 'first',
      onTouchEnd: () => calls.push('first'),
      ref: (target: EngineNode) => calls.push(`ref:${target === node}`),
    });
    let node!: EngineNode;
    root.render(() => {
      node = createElement('view');
      spread(node, props, skipChildren);
      return node;
    });
    fabric.emit(node, 'topTouchEnd');
    setProps({ testID: 'second', onTouchEnd: () => calls.push('second') });
    clock.flushMicrotasks();
    fabric.emit(node, 'topTouchEnd');
    setProps({});
    clock.flushMicrotasks();
    fabric.emit(node, 'topTouchEnd');
    assert.deepEqual(calls, ['ref:true', 'first', 'second']);
    assert.equal(node.props['testID'], undefined);
    assert.equal(node.listeners?.get('topTouchEnd')?.size, 0);
    root.dispose();
  });

function pressHandlers(released: () => void): ResponderHandlers {
  return { onStartShouldSetResponder: () => true, onResponderRelease: released };
}

function touch(fabric: ReturnType<typeof createFakeFabric>, node: EngineNode, type: string) {
  fabric.emit(node, type, {
    changedTouches: [{ identifier: 1, pageX: 1, pageY: 1 }],
    touches: [],
    pageX: 1,
    pageY: 1,
    identifier: 1,
  });
}

test('one native event registration routes realistic responder touches across roots and remounts', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const first = createNativeRoot({ fabric, rootTag: 1, clock });
  const second = createNativeRoot({ fabric, rootTag: 11, clock });
  assert.throws(() => createNativeRoot({ fabric, rootTag: 1 }), /already mounted/);
  const [count, setCount] = createSignal(0);
  let a!: EngineNode;
  let b!: EngineNode;
  let secondPresses = 0;
  first.render(() => {
    a = createElement('view');
    setProp(
      a,
      'responder',
      pressHandlers(() => setCount((value) => value + 1)),
    );
    effect(() => setProp(a, 'testID', `count-${count()}`));
    return a;
  });
  second.render(() => {
    b = createElement('view');
    setProp(
      b,
      'responder',
      pressHandlers(() => secondPresses++),
    );
    return b;
  });
  touch(fabric, a, 'topTouchStart');
  touch(fabric, a, 'topTouchEnd');
  touch(fabric, b, 'topTouchStart');
  touch(fabric, b, 'topTouchEnd');
  clock.flushMicrotasks();
  assert.equal(count(), 1);
  assert.equal(secondPresses, 1);
  assert.equal(fabric.roots.get(1)![0]!.props['testID'], 'count-1');
  assert.equal(fabric.eventHandlerCount, 1);
  touch(fabric, a, 'topTouchStart');
  first.dispose();
  assert.equal(
    fabric.responderCalls.filter((call) => call.node.instanceHandle === a).at(-1)!.active,
    false,
  );
  touch(fabric, a, 'topTouchStart');
  touch(fabric, a, 'topTouchEnd');
  touch(fabric, b, 'topTouchStart');
  touch(fabric, b, 'topTouchEnd');
  assert.equal(count(), 1);
  assert.equal(secondPresses, 2);
  second.dispose();
  const remount = createNativeRoot({ fabric, rootTag: 1, clock });
  remount.render(() => createElement('view'));
  assert.equal(fabric.eventHandlerCount, 1);
  remount.dispose();
  touch(fabric, b, 'topTouchStart');
  touch(fabric, b, 'topTouchEnd');
  assert.equal(secondPresses, 2);
});

test('throwing listeners and error reporters remain contained and later listeners still run', (t) => {
  t.mock.method(console, 'error', () => {});
  const fabric = createFakeFabric();
  let reported = 0;
  const root = createNativeRoot({
    fabric,
    rootTag: 1,
    engineOptions: {
      onError() {
        reported++;
        throw new Error('reporter');
      },
    },
  });
  const calls: string[] = [];
  let node!: EngineNode;
  root.render(() => {
    const parent = createElement('view');
    node = createElement('view');
    setProp(node, 'onTouchEnd', () => {
      throw new Error('listener');
    });
    onNativeCleanup(
      node,
      root.engine.setEventListener(node, 'topTouchEnd', () => calls.push('later')),
    );
    setProp(parent, 'onTouchEnd', () => calls.push('parent'));
    insertNode(parent, node);
    return parent;
  });
  assert.doesNotThrow(() => fabric.emit(node, 'topTouchEnd'));
  assert.equal(reported, 1);
  assert.deepEqual(calls, ['later', 'parent']);
  root.dispose();
});

test('native bindings wait for the commit barrier and pending callbacks cancel with owners', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  let node!: EngineNode;
  let mounted = false;
  let bound = false;
  let cleaned = 0;
  root.render(() => {
    node = createElement('view');
    onMount(() => {
      mounted = true;
      assert.equal(root.engine.shadowNodeOf(node), null);
      root.afterCommit(() => {
        assert.ok(root.engine.shadowNodeOf(node));
        bound = true;
      });
    });
    onCleanup(() => cleaned++);
    return node;
  });
  assert.equal(mounted, true);
  assert.equal(bound, true);
  root.afterCommit(() => {
    throw new Error('cancelled by root disposal');
  });
  root.dispose();
  clock.flushMicrotasks();
  assert.equal(cleaned, 1);
  assert.equal(node.committed, null);
  assert.equal(clock.frames.size, 0);
});

test('failed mounts clear partial native resources and release the surface for remount', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  let node!: EngineNode;
  let cleanup = 0;
  assert.throws(
    () =>
      root.render(() => {
        node = createElement('view');
        setProp(node, 'onTouchEnd', () => {});
        onNativeCleanup(node, () => cleanup++);
        throw new Error('mount failed');
      }),
    /mount failed/,
  );
  assert.equal(root.disposed, true);
  assert.equal(cleanup, 1);
  assert.equal(node.listeners, null);
  assert.throws(() => root.render(() => node), /only once/);
  const remount = createNativeRoot({ fabric, rootTag: 1, clock });
  remount.render(() => createElement('view'));
  assert.throws(() => remount.render(() => node), /only once/);
  remount.dispose();
});

test('reactive errors at the native event batch boundary are contained', () => {
  const fabric = createFakeFabric();
  const errors: unknown[] = [];
  const root = createNativeRoot({
    fabric,
    rootTag: 1,
    engineOptions: { onError: (error) => errors.push(error) },
  });
  const [fail, setFail] = createSignal(false);
  let node!: EngineNode;
  root.render(() => {
    node = createElement('view');
    effect(() => {
      if (fail()) throw new Error('reactive callback');
    });
    setProp(node, 'onTouchEnd', () => setFail(true));
    return node;
  });
  assert.doesNotThrow(() => fabric.emit(node, 'topTouchEnd'));
  assert.equal(errors.length, 1);
  root.dispose();
});

test('a conditional owner cancels its pending native binding before the next commit', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  const [items, setItems] = createSignal<number[]>([]);
  let bindings = 0;
  root.render(() => {
    const container = createElement('view');
    insert(
      container,
      mapArray(items, () => {
        const node = createElement('view');
        root.afterCommit(() => bindings++);
        return node;
      }),
    );
    return container;
  });
  setItems([1]);
  setItems([]);
  clock.flushMicrotasks();
  assert.equal(bindings, 0);
  root.dispose();
});

test('an on-prefixed prop that is not a handler is a plain native prop', () => {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 1, clock: createClock() });
  root.render(() => {
    const node = createElement('view');
    // The iOS switch's track color is spelled like an event.
    setProp(node, 'onTintColor', '#ff0000');
    return node;
  });
  assert.equal(fabric.roots.get(1)![0]!.props['onTintColor'], '#ff0000');
});
