import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createComputed, createRoot, createSignal } from 'solid-js';
import type { HostNode } from '@solid-native/fabric';
import {
  afterHostCommit,
  createHostElement,
  createNativeRoot,
  insertHostChildren,
  onHostCleanup,
  spreadHostProps,
  useHostAdapter,
  useHostEngine,
  withHostAdapter,
  type HostAdapter,
} from '../src/solid.ts';
import { createClock, createFakeFabric } from './fake-fabric.ts';

test('portable operations preserve reactive children, owner cleanup and post-commit timing', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  const [value, setValue] = createSignal('first');
  let cleanup = 0;
  let barrier = 0;
  let node!: HostNode;
  let adapter!: HostAdapter;
  root.render(() => {
    adapter = useHostAdapter();
    node = createHostElement('text');
    spreadHostProps(node, () => ({ testID: value() }), true);
    insertHostChildren(node, value);
    onHostCleanup(node, () => cleanup++);
    afterHostCommit(() => {
      assert.equal(fabric.roots.get(1)![0]!.props['testID'], 'first');
      assert.equal(useHostEngine(), root.engine);
      barrier++;
    });
    return node;
  });
  assert.equal(barrier, 1);
  const tag = fabric.roots.get(1)![0]!.tag;
  setValue('second');
  clock.flushMicrotasks();
  const committed = fabric.roots.get(1)![0]!;
  assert.equal(committed.tag, tag);
  assert.equal(committed.props['testID'], 'second');
  assert.equal(committed.children[0]!.props['text'], 'second');
  adapter.afterCommit(() => barrier++);
  root.dispose();
  root.dispose();
  clock.flushMicrotasks();
  assert.equal(barrier, 1);
  assert.equal(cleanup, 1);
  assert.throws(() => adapter.spreadProps(node, {}), /active native root/);
});

test('native host adapter rejects portable impostors and nodes owned by another root', () => {
  const fabric = createFakeFabric();
  const a = createNativeRoot({ fabric, rootTag: 1 });
  const b = createNativeRoot({ fabric, rootTag: 2 });
  let aNode!: HostNode;
  let bNode!: HostNode;
  let aAdapter!: HostAdapter;
  let adapter!: HostAdapter;
  a.render(() => {
    aAdapter = useHostAdapter();
    return (aNode = createHostElement('view'));
  });
  b.render(() => {
    assert.throws(() => aAdapter.createElement('view'), /owning host adapter/);
    assert.throws(() => aAdapter.spreadProps(aNode, {}), /owning host adapter/);
    assert.throws(() => aAdapter.insertChildren(aNode, 'wrong owner'), /owning host adapter/);
    adapter = useHostAdapter();
    bNode = createHostElement('view');
    assert.throws(() => adapter.spreadProps(aNode, {}), /active native root/);
    assert.throws(() => adapter.insertChildren(bNode, aNode), /another native root/);
    return bNode;
  });
  createRoot((dispose) => {
    assert.throws(() => adapter.spreadProps(aNode, {}), /active native root owner/);
    assert.throws(() => adapter.insertChildren(bNode, aNode), /active native root owner/);
    dispose();
  });
  const impostor: HostNode = {
    kind: 'element',
    props: {},
    text: '',
    children: [],
    parent: null,
    host: b.engine,
  };
  assert.throws(() => adapter.onCleanup(impostor, () => {}), /does not belong/);
  a.dispose();
  b.dispose();
});

test('captured native adapters reject unowned bindings before evaluating accessors', () => {
  const root = createNativeRoot({ fabric: createFakeFabric(), rootTag: 1 });
  let adapter!: HostAdapter;
  let node!: HostNode;
  const [value, setValue] = createSignal(0);
  let runs = 0;
  root.render(() => {
    adapter = useHostAdapter();
    return (node = createHostElement('view'));
  });
  const read = () => {
    runs++;
    return String(value());
  };
  assert.throws(() => adapter.spreadProps(node, () => ({ testID: read() })), /owner/);
  assert.throws(() => adapter.insertChildren(node, read), /owner/);
  assert.equal(runs, 0);
  setValue(1);
  root.dispose();
  setValue(2);
  assert.equal(runs, 0, 'rejected bindings never subscribe');
});

test('host context is injected and survives later computations without requiring native nodes', () => {
  const root = createNativeRoot({ fabric: createFakeFabric(), rootTag: 1 });
  const portable: HostNode = { kind: 'element', props: {}, text: '', children: [], parent: null };
  const calls: string[] = [];
  const adapter: HostAdapter = {
    engine: root.engine,
    isAttached: (node) => node === portable,
    createElement(name) {
      calls.push(name);
      return portable;
    },
    spreadProps(node) {
      assert.equal(node, portable);
      calls.push('props');
    },
    insertChildren(node) {
      assert.equal(node, portable);
      calls.push('children');
    },
    onCleanup() {
      return () => {};
    },
    afterCommit(callback) {
      callback();
      return () => {};
    },
    requestFrame(callback) {
      callback();
      return () => {};
    },
  };
  const [value, setValue] = createSignal(0);
  let dispose!: () => void;
  createRoot((stop) => {
    dispose = stop;
    withHostAdapter(adapter, () => {
      createComputed(() => {
        value();
        assert.equal(createHostElement('portable'), portable);
        assert.equal(useHostEngine(), adapter.engine);
        spreadHostProps(portable, {});
        insertHostChildren(portable, 'content');
      });
    });
  });
  setValue(1);
  assert.deepEqual(calls, ['portable', 'props', 'children', 'portable', 'props', 'children']);
  dispose();
  setValue(2);
  assert.equal(calls.length, 6);
  assert.throws(useHostAdapter, /active host adapter owner/);
  assert.throws(() => withHostAdapter(adapter, () => portable), /active Solid owner/);
  root.dispose();
});

test('attachment queries reject descendants of detached retained ancestors and disposed nodes', () => {
  const root = createNativeRoot({ fabric: createFakeFabric(), rootTag: 1 });
  let adapter!: HostAdapter;
  let child!: HostNode;
  root.render(() => {
    adapter = useHostAdapter();
    const parent = createHostElement('view');
    child = createHostElement('text');
    insertHostChildren(parent, child);
    return parent;
  });
  assert.equal(adapter.isAttached(child), true);
  const parent = root.engine.root.children[0]!;
  root.engine.removeChild(root.engine.root, parent);
  root.flush();
  assert.equal(adapter.isAttached(child), false);
  root.engine.appendChild(root.engine.root, parent);
  root.flush();
  assert.equal(adapter.isAttached(child), true);
  assert.equal(
    adapter.isAttached({ kind: 'element', props: {}, text: '', children: [], parent: null }),
    false,
  );
  root.dispose();
  assert.equal(adapter.isAttached(child), false);
});
