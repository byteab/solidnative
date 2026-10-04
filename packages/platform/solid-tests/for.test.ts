import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, createSignal, onCleanup, type Accessor } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { EngineNode } from '@solidnative/fabric';
import {
  createElement,
  createNativeRoot,
  For,
  insert,
  onNativeCleanup,
  Show,
} from '../src/solid.ts';
import { createClock, createFakeFabric, type FakeNode } from './fake-fabric.ts';

const texts = (nodes: readonly FakeNode[]): string[] =>
  nodes.flatMap((node) => [
    ...(node.viewName === 'RawText' ? [String(node.props['text'])] : []),
    ...texts(node.children),
  ]);

function label(text: string | (() => string)): EngineNode {
  const node = createElement('text');
  insert(node, text);
  return node;
}

function mount<T>(
  each: Accessor<readonly T[]>,
  row: (item: T, index: Accessor<number>) => EngineNode,
  fallback?: () => EngineNode,
) {
  const fabric = createFakeFabric();
  const clock = createClock();
  const errors: unknown[] = [];
  const root = createNativeRoot({
    fabric,
    rootTag: 1,
    clock,
    engineOptions: { onError: (error) => errors.push(error) },
  });
  root.render(() => {
    const page = createElement('view');
    insert(
      page,
      For({
        get each() {
          return each();
        },
        children: row,
        ...(fallback
          ? {
              get fallback() {
                return fallback();
              },
            }
          : {}),
      }),
    );
    return page;
  });
  const shown = () => texts(fabric.roots.get(1)!);
  return { root, clock, shown, errors };
}

test('For disposes a removed row after the commit that takes it off screen', () => {
  const [items, setItems] = createSignal(['a', 'b', 'c']);
  const disposed: { item: string; shown: string[] }[] = [];
  const { root, clock, shown } = mount(items, (item) => {
    onCleanup(() => disposed.push({ item, shown: shown() }));
    return label(item);
  });
  assert.deepEqual(shown(), ['a', 'b', 'c']);
  setItems(['a', 'c']);
  assert.equal(disposed.length, 0, 'not inside the setter');
  clock.flushMicrotasks();
  assert.deepEqual(disposed, [{ item: 'b', shown: ['a', 'c'] }], 'after the commit went out');
  setItems([]);
  clock.flushMicrotasks();
  assert.deepEqual(
    disposed.map((entry) => [entry.item, entry.shown]),
    [
      ['b', ['a', 'c']],
      ['a', []],
      ['c', []],
    ],
  );
  root.dispose();
});

test("a new row runs after the cleanups of the rows it replaces, as Solid's For does", () => {
  const [items, setItems] = createSignal([{ id: 'a' }, { id: 'b' }]);
  const registry = new Set<string>();
  const { root, clock } = mount(items, (item) => {
    registry.add(item.id);
    onCleanup(() => registry.delete(item.id));
    return label(item.id);
  });
  // An immutable refetch: the same ids, every row a new object.
  setItems(items().map((item) => ({ ...item })));
  clock.flushMicrotasks();
  assert.deepEqual([...registry], ['a', 'b']);
  // Cleared, then refilled before the commit has gone out.
  setItems([]);
  setItems([{ id: 'a' }]);
  clock.flushMicrotasks();
  assert.deepEqual([...registry], ['a']);
  root.dispose();
});

test('a retired row releases its native resources in the same flush', () => {
  const [items, setItems] = createSignal([1, 2]);
  const released: number[] = [];
  const { root, clock } = mount(items, (item) => {
    const node = label(String(item));
    onNativeCleanup(node, () => released.push(item));
    return node;
  });
  setItems([1]);
  clock.flushMicrotasks();
  assert.deepEqual(released, [2]);
  root.dispose();
  assert.deepEqual(released, [2, 1]);
});

test('For keeps indexes, reorders without recreating and shows its fallback', () => {
  const [items, setItems] = createSignal(['a', 'b']);
  let made = 0;
  const { root, clock, shown } = mount(
    items,
    (item, index) => {
      made++;
      return label(() => `${item}${index()}`);
    },
    () => label('empty'),
  );
  assert.deepEqual(shown(), ['a0', 'b1']);
  setItems(['b', 'c', 'a']);
  clock.flushMicrotasks();
  assert.deepEqual(shown(), ['b0', 'c1', 'a2']);
  assert.equal(made, 3, 'moved rows are kept');
  setItems([]);
  clock.flushMicrotasks();
  assert.deepEqual(shown(), ['empty']);
  setItems(['d']);
  clock.flushMicrotasks();
  assert.deepEqual(shown(), ['d0']);
  root.dispose();
});

test('For follows a store array, and a duplicate item maps to a row each', () => {
  const [state, setState] = createStore({ items: ['x', 'y'] });
  const { root, clock, shown } = mount(
    () => state.items,
    (item) => label(item),
  );
  setState('items', state.items.length, 'x');
  clock.flushMicrotasks();
  assert.deepEqual(shown(), ['x', 'y', 'x']);
  setState('items', ['x', 'x']);
  clock.flushMicrotasks();
  assert.deepEqual(shown(), ['x', 'x']);
  root.dispose();
});

test('rows still waiting for a commit are disposed with the root, and the list with its owner', () => {
  const [items, setItems] = createSignal(['a', 'b']);
  const [visible, setVisible] = createSignal(true);
  const disposed: string[] = [];
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  root.render(() => {
    const page = createElement('view');
    insert(
      page,
      Show({
        get when() {
          return visible();
        },
        get children() {
          return For({
            get each() {
              return items();
            },
            children: (item: string) => {
              onCleanup(() => disposed.push(item));
              return label(item);
            },
          });
        },
      }),
    );
    return page;
  });
  setVisible(false);
  assert.deepEqual(disposed, ['a', 'b'], 'a list that goes away takes its rows at once');
  setVisible(true);
  clock.flushMicrotasks();
  setItems(['b']);
  assert.deepEqual(disposed, ['a', 'b']);
  root.dispose();
  // The live row goes with its owner, then the one retired by the last update.
  assert.deepEqual(disposed, ['a', 'b', 'b', 'a']);
});

test('a retired row whose cleanup throws is reported, and the others are still disposed', () => {
  const [items, setItems] = createSignal(['a', 'b', 'c']);
  const disposed: string[] = [];
  const { root, clock, errors } = mount(items, (item) => {
    onCleanup(() => {
      disposed.push(item);
      if (item === 'a') throw new Error('cleanup failed');
    });
    return label(item);
  });
  setItems([]);
  clock.flushMicrotasks();
  assert.deepEqual(disposed, ['a', 'b', 'c']);
  assert.equal(errors.length, 1);
  root.dispose();
});

test('outside a native root, For disposes a removed row at once', () => {
  const [items, setItems] = createSignal(['a', 'b']);
  const disposed: string[] = [];
  createRoot((dispose) => {
    const rows = For({
      get each() {
        return items();
      },
      children: (item: string) => {
        onCleanup(() => disposed.push(item));
        return item as never;
      },
    }) as unknown as () => string[];
    assert.deepEqual(rows(), ['a', 'b']);
    setItems(['b']);
    assert.deepEqual(rows(), ['b']);
    assert.deepEqual(disposed, ['a']);
    dispose();
  });
  assert.deepEqual(disposed, ['a', 'b']);
});

test('a removed row that derives from the list does not run before it is disposed', () => {
  const [lines, setLines] = createSignal([
    { id: 'a', count: 1 },
    { id: 'b', count: 2 },
  ]);
  const { root, clock, shown, errors } = mount(
    () => lines().map((line) => line.id),
    (id) => {
      const line = () => lines().find((one) => one.id === id)!;
      return label(() => `${id}${line().count}`);
    },
  );
  assert.deepEqual(shown(), ['a1', 'b2']);
  setLines([{ id: 'a', count: 3 }]);
  clock.flushMicrotasks();
  assert.deepEqual(shown(), ['a3']);
  assert.deepEqual(errors, []);
  root.dispose();
});
