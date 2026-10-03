import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignal, onCleanup, untrack } from 'solid-js';
import { createNativeRoot, type HostChild } from '@solidnative/platform/solid';
import {
  registerPlatformComponents,
  type FabricNode,
  type ScrollRange,
  type HostNode,
} from '@solidnative/fabric';
import { VirtualList, type VirtualListRef } from '../src/solid/virtual-list.ts';
import { SectionList, type SectionListRef } from '../src/solid/section-list.ts';
import { ScrollView } from '../src/solid/scroll-view.ts';
import { Text } from '../src/solid/primitive.ts';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
const textOf = (node: FakeNode): string =>
  node.viewName === 'RawText'
    ? String(node.props['text'] ?? '')
    : node.children.map(textOf).join('');
function boot(Scene: () => HostChild, setup?: (root: ReturnType<typeof createNativeRoot>) => void) {
  const commands: { node: FabricNode; name: string; args: readonly unknown[] }[] = [];
  const errors: unknown[] = [];
  const fabric = Object.assign(createFakeFabric(), {
    dispatchCommand(node: FabricNode, name: string, args: readonly unknown[]) {
      commands.push({ node, name, args });
    },
  });
  const clock = createClock();
  const root = createNativeRoot({
    fabric,
    clock,
    rootTag: 1,
    engineOptions: { onError: (error) => errors.push(error) },
  });
  setup?.(root);
  // Component execution has the same untracked boundary as compiled JSX createComponent.
  root.render(() => untrack(Scene));
  clock.flushMicrotasks();
  const all = () => flatten(fabric.roots.get(1) ?? []);
  const find = (id: string) => {
    const node = all().find((node) => node.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };
  const layout = (node: FakeNode, width: number, height: number) => {
    fabric.emit(node, 'topLayout', { layout: { x: 0, y: 0, width, height } });
    clock.flushMicrotasks();
  };
  const scroll = (y: number, x = 0) => {
    fabric.emit(find('list'), 'topScroll', { contentOffset: { x, y } });
    clock.flushMicrotasks();
  };
  return { root, fabric, clock, commands, errors, all, find, layout, scroll };
}

test('keyed row owners survive reorder/replacement, update item/index bindings, and dispose once on removal', () => {
  registerPlatformComponents('ios');
  const [items, setItems] = createSignal([
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ]);
  const starts = new Map<string, number>(),
    ends: string[] = [];
  const states = new Map<string, (value: number) => void>();
  const app = boot(() =>
    VirtualList({
      testID: 'list',
      get items() {
        return items();
      },
      itemHeight: 56,
      keyExtractor: (item) => item.id,
      renderItem(item, index) {
        const key = item().id;
        starts.set(key, (starts.get(key) ?? 0) + 1);
        const [state, setState] = createSignal(0);
        states.set(key, setState);
        onCleanup(() => ends.push(key));
        return Text({
          testID: key,
          get children() {
            return `${item().label}:${index()}:${state()}`;
          },
        });
      },
    }),
  );
  const tag = app.find('b').tag;
  states.get('b')!(9);
  setItems([
    { id: 'c', label: 'C2' },
    { id: 'b', label: 'B2' },
    { id: 'a', label: 'A2' },
  ]);
  app.clock.flushMicrotasks();
  assert.equal(app.find('b').tag, tag);
  assert.equal(textOf(app.find('b')), 'B2:1:9');
  assert.equal(textOf(app.find('a')), 'A2:2:0');
  assert.deepEqual([...starts.values()], [1, 1, 1]);
  assert.deepEqual(ends, []);
  setItems([{ id: 'b', label: 'B3' }]);
  app.clock.flushMicrotasks();
  assert.deepEqual(ends.sort(), ['a', 'c']);
  assert.equal(textOf(app.find('b')), 'B3:0:9');
  app.root.dispose();
  app.clock.flushMicrotasks();
  assert.deepEqual(ends.sort(), ['a', 'b', 'c']);
  assert.deepEqual(app.errors, []);
});

test('fixed window, native callbacks, viewability thresholds, scroll commands and end rearming', () => {
  const items = Array.from({ length: 50 }, (_, id) => ({ id }));
  let ref!: VirtualListRef;
  const seen: number[][] = [],
    ends: number[] = [],
    calls: string[] = [];
  const app = boot(() =>
    VirtualList({
      testID: 'list',
      items,
      itemHeight: 50,
      overscan: 1,
      keyExtractor: (item) => item.id,
      renderItem: (item, index) =>
        Text({
          get testID() {
            return `row-${item().id}`;
          },
          get children() {
            return index();
          },
        }),
      itemVisiblePercentThreshold: 50,
      endReachedThreshold: 0,
      ref(value) {
        ref = value;
      },
      onViewableItemsChanged(event) {
        seen.push(event.viewable.map((row) => row.index));
      },
      onEndReached: (event) => ends.push(event.distanceFromEnd),
      onScroll: () => calls.push('scroll'),
    }),
  );
  app.layout(app.find('list'), 200, 100);
  assert.deepEqual(seen.at(-1), [0, 1]);
  app.scroll(75);
  assert.deepEqual(seen.at(-1), [1, 2, 3]);
  assert.ok(
    app.all().filter((node) => node.props['testID']?.toString().startsWith('row-')).length <= 5,
  );
  ref.scrollToIndex({ index: 10, viewOffset: 5, animated: false });
  app.clock.flushMicrotasks();
  assert.deepEqual(app.commands.at(-1)?.args, [0, 495, false]);
  assert.ok(app.find('row-10'));
  ref.scrollToOffset({ offset: 111, animated: false });
  ref.scrollToEnd({ animated: false });
  ref.flashScrollIndicators();
  app.clock.flushMicrotasks();
  assert.deepEqual(
    app.commands.slice(-3).map((c) => c.name),
    ['scrollTo', 'scrollToEnd', 'flashScrollIndicators'],
  );
  app.scroll(2400);
  app.scroll(2420);
  assert.equal(ends.length, 1);
  app.scroll(0);
  app.scroll(2400);
  assert.equal(ends.length, 2);
  assert.equal(calls.length, 5);
  const old = app.find('list');
  app.root.dispose();
  const count = app.commands.length;
  ref.scrollToIndex({ index: 4 });
  ref.scrollToOffset({ offset: 20 });
  app.fabric.emit(old, 'topScroll', { contentOffset: { y: 20 } });
  app.clock.flushMicrotasks();
  assert.equal(app.commands.length, count);
  assert.equal(calls.length, 5);
});

test('measured rows remain in flow, heights follow keys, and prepends/deletions/header changes preserve the anchor', () => {
  const initial = Array.from({ length: 12 }, (_, id) => ({ id }));
  const [items, setItems] = createSignal(initial);
  const app = boot(() =>
    VirtualList({
      testID: 'list',
      get items() {
        return items();
      },
      estimatedItemHeight: 50,
      keyExtractor: (item) => item.id,
      overscan: 1,
      maintainVisibleContentPosition: {},
      listHeader: Text({ testID: 'header', children: 'Header' }),
      renderItem: (item) =>
        Text({
          get testID() {
            return `row-${item().id}`;
          },
          children: 'Row',
        }),
    }),
  );
  app.layout(app.find('list'), 200, 100);
  const row = app.find('row-0').instanceHandle.parent!;
  assert.equal(
    row.props['style'] && (row.props['style'] as Record<string, unknown>)['position'],
    undefined,
  );
  app.fabric.emit(row, 'topLayout', { layout: { height: 80, width: 200 } });
  app.clock.flushMicrotasks();
  app.scroll(180);
  setItems([{ id: 99 }, ...initial]);
  app.clock.flushMicrotasks();
  assert.deepEqual(app.commands.at(-1)?.args, [0, 230, false]);
  setItems(items().filter((item) => item.id !== 3));
  app.clock.flushMicrotasks();
  assert.deepEqual(
    app.commands.at(-1)?.args,
    [0, 230, false],
    'successor takes the removed row position',
  );
  app.fabric.emit(app.find('header').instanceHandle.parent!, 'topLayout', {
    layout: { height: 40, width: 200 },
  });
  app.clock.flushMicrotasks();
  assert.deepEqual(app.commands.at(-1)?.args, [0, 270, false]);
  app.root.dispose();
  assert.deepEqual(app.errors, []);
});

test('filter shrink clamps the viewport and horizontal inverted rows/separators use the horizontal axis', () => {
  let ref!: VirtualListRef;
  const [items, setItems] = createSignal(Array.from({ length: 20 }, (_, id) => id));
  const app = boot(() =>
    VirtualList({
      testID: 'list',
      get items() {
        return items();
      },
      itemHeight: 40,
      horizontal: true,
      inverted: true,
      ref(value) {
        ref = value;
      },
      renderItem: (item) =>
        Text({
          get testID() {
            return `row-${item()}`;
          },
          get children() {
            return item();
          },
        }),
      renderSeparator: (a, b) =>
        Text({
          get testID() {
            return `gap-${a()}`;
          },
          get children() {
            return `${a()}|${b()}`;
          },
        }),
    }),
  );
  app.layout(app.find('list'), 120, 200);
  app.scroll(0, 400);
  setItems([0, 1, 2, 3]);
  app.clock.flushMicrotasks();
  assert.deepEqual(app.commands.at(-1)?.args, [40, 0, false]);
  const row = app.find('row-1').instanceHandle.parent!;
  assert.deepEqual((row.props['style'] as Record<string, unknown>)['transform'], [{ scaleX: -1 }]);
  assert.equal((row.props['style'] as Record<string, unknown>)['width'], 40);
  ref.scrollToIndex({ index: 2, animated: false });
  app.clock.flushMicrotasks();
  assert.deepEqual(app.commands.at(-1)?.args, [80, 0, false]);
  assert.equal(textOf(app.find('gap-1')), '1|2');
  assert.ok(!app.all().some((node) => node.props['testID'] === 'gap-3'));
  app.root.dispose();
  assert.deepEqual(app.errors, []);
});

for (const platform of ['ios', 'android'] as const) {
  test(`${platform}: refresh uses native shape, controlled correction and permanent Android wrapper`, () => {
    registerPlatformComponents(platform);
    const [refreshing, setRefreshing] = createSignal(false),
      [present, setPresent] = createSignal(true);
    let pulls = 0,
      accept = false;
    const style = Object.freeze({ height: 200, marginTop: 8, backgroundColor: 'red' });
    const app = boot(() =>
      ScrollView({
        testID: 'list',
        style,
        get refreshControl() {
          return present()
            ? {
                refreshing: refreshing(),
                testID: 'refresh',
                onRefresh() {
                  pulls++;
                  if (accept) setRefreshing(true);
                },
              }
            : undefined;
        },
        children: Text({ testID: 'child', children: 0 }),
      }),
    );
    const scrollTag = app.find('list').tag,
      refreshTag = app.find('refresh').tag;
    if (platform === 'android') {
      assert.equal(app.fabric.roots.get(1)?.[0]?.viewName, 'AndroidSwipeRefreshLayout');
      assert.equal(app.find('list').props['nestedScrollEnabled'], true);
      assert.equal(app.find('refresh').props['height'], 200);
      assert.equal(app.find('list').props['height'], undefined);
    } else {
      assert.equal(app.find('list').children[0]?.viewName, 'PullToRefreshView');
      assert.equal(app.find('list').children[1]?.props['collapsable'], false);
    }
    app.fabric.emit(app.find('refresh'), 'topRefresh', {});
    app.clock.flushMicrotasks();
    assert.equal(pulls, 1);
    assert.deepEqual(app.commands.at(-1)?.args, [false]);
    accept = true;
    app.fabric.emit(app.find('refresh'), 'topRefresh', {});
    app.clock.flushMicrotasks();
    assert.equal(app.find('refresh').props['refreshing'], true);
    assert.equal(app.commands.length, 1);
    setRefreshing(false);
    app.clock.flushMicrotasks();
    assert.equal(app.find('refresh').props['refreshing'], false);
    setPresent(false);
    app.clock.flushMicrotasks();
    assert.equal(app.find('list').tag, scrollTag);
    if (platform === 'android') assert.equal(app.fabric.roots.get(1)?.[0]?.props['enabled'], false);
    setPresent(true);
    app.clock.flushMicrotasks();
    assert.equal(app.find('refresh').tag, refreshTag);
    assert.equal(app.find('list').tag, scrollTag);
    assert.deepEqual(style, { height: 200, marginTop: 8, backgroundColor: 'red' });
    app.fabric.emit(app.find('refresh'), 'topRefresh', {});
    app.root.dispose();
    app.clock.flushMicrotasks();
    assert.equal(app.commands.length, 1);
    assert.deepEqual(app.errors, []);
  });
}

test('section keys preserve local item owners through reorders and location scroll accounts for sticky header', () => {
  registerPlatformComponents('ios');
  const [sections, setSections] = createSignal([
    {
      key: 'a',
      title: 'A',
      data: [
        { id: 1, name: 'One' },
        { id: 2, name: 'Two' },
      ],
    },
    { key: 'b', title: 'B', data: [{ id: 1, name: 'Other' }] },
  ]);
  let ref!: SectionListRef;
  const mounts: string[] = [];
  const app = boot(() =>
    SectionList({
      testID: 'list',
      get sections() {
        return sections();
      },
      itemHeight: 50,
      sectionHeaderHeight: 20,
      overscan: 10,
      keyExtractor: (item) => item.id,
      ref(value) {
        ref = value;
      },
      renderItem(item, index, section) {
        mounts.push(`${section().key}-${item().id}`);
        return Text({
          get testID() {
            return `${section().key}-${item().id}`;
          },
          get children() {
            return `${item().name}:${index()}`;
          },
        });
      },
      renderSectionHeader: (section) =>
        Text({
          get testID() {
            return `head-${section().key}`;
          },
          get children() {
            return section().title;
          },
        }),
      renderSeparator: (a, b, section) =>
        Text({
          get testID() {
            return `gap-${section().key}-${a().id}`;
          },
          get children() {
            return `${a().id}|${b().id}`;
          },
        }),
    }),
  );
  const tag = app.find('a-1').tag;
  setSections([
    { key: 'b', title: 'B2', data: [{ id: 1, name: 'Other2' }] },
    {
      key: 'a',
      title: 'A2',
      data: [
        { id: 2, name: 'Two2' },
        { id: 1, name: 'One2' },
      ],
    },
  ]);
  app.clock.flushMicrotasks();
  assert.equal(app.find('a-1').tag, tag);
  assert.equal(textOf(app.find('a-1')), 'One2:1');
  assert.deepEqual(mounts.sort(), ['a-1', 'a-2', 'b-1']);
  assert.equal(textOf(app.find('gap-a-2')), '2|1');
  assert.ok(!app.all().some((node) => node.props['testID'] === 'gap-a-1'));
  ref.scrollToLocation({ sectionIndex: 1, itemIndex: 1, animated: false });
  app.clock.flushMicrotasks();
  assert.deepEqual(app.commands.at(-1)?.args, [0, 70, false]);
  app.root.dispose();
  assert.deepEqual(app.errors, []);
});

test('native sticky drives bind after commit, update ranges and release on removal/disposal', async () => {
  registerPlatformComponents('ios');
  const [sticky, setSticky] = createSignal<readonly number[]>([0, 4]);
  const binds: { node: HostNode; range: ScrollRange }[] = [],
    updates: ScrollRange[] = [],
    stops: HostNode[] = [];
  const app = boot(
    () =>
      VirtualList({
        testID: 'list',
        items: Array.from({ length: 30 }, (_, i) => i),
        itemHeight: 40,
        overscan: 1,
        get stickyIndices() {
          return sticky();
        },
        renderItem: (item) =>
          Text({
            get testID() {
              return `row-${item()}`;
            },
            get children() {
              return item();
            },
          }),
      }),
    (root) => {
      Object.defineProperty(root.engine, 'drivesScroll', { value: true });
      root.engine.driveByScroll = (node, scroll, _axis, range) => {
        assert.ok(appCommit(node));
        assert.ok(appCommit(scroll));
        binds.push({ node, range });
        return {
          update: (next) => {
            updates.push(next);
          },
          stop: () => {
            stops.push(node);
          },
          shift: () => 0,
        };
      };
    },
  );
  function appCommit(node: HostNode) {
    return 'committed' in node && node['committed'];
  }
  app.layout(app.find('list'), 200, 80);
  assert.equal(binds.length, 1);
  app.scroll(100);
  assert.equal(app.find('row-0').instanceHandle.parent, binds[0]?.node);
  const before = app.find('row-0').instanceHandle.parent!.props['style'];
  assert.equal(
    (before as Record<string, unknown>)['transform'],
    undefined,
    'native drive owns continuous movement',
  );
  await new Promise((resolve) => setTimeout(resolve, 70));
  app.clock.flushMicrotasks();
  assert.deepEqual(
    (app.find('row-0').instanceHandle.parent!.props['style'] as Record<string, unknown>)[
      'transform'
    ],
    [{ translateY: 100 }],
  );
  setSticky([]);
  app.clock.flushMicrotasks();
  assert.ok(stops.length >= 1);
  app.root.dispose();
  app.clock.flushMicrotasks();
  assert.deepEqual(app.errors, []);
});

test('opt-in recycling parks a bounded type pool and passes reactive data/index to reused owners', () => {
  registerPlatformComponents('ios');
  const [items, setItems] = createSignal(
    Array.from({ length: 10 }, (_, id) => ({ id, type: 'same' })),
  );
  const mounts: number[] = [],
    cleanups: number[] = [];
  const app = boot(() =>
    VirtualList({
      testID: 'list',
      get items() {
        return items();
      },
      itemHeight: 40,
      overscan: 0,
      recycleItems: true,
      itemType: (item) => item.type,
      keyExtractor: (item) => item.id,
      renderItem(item, index) {
        const mount = item().id;
        mounts.push(mount);
        onCleanup(() => cleanups.push(mount));
        return Text({
          get testID() {
            return `row-${item().id}`;
          },
          get children() {
            return `${item().id}:${index()}`;
          },
        });
      },
    }),
  );
  app.layout(app.find('list'), 200, 40);
  const original = app.find('row-0').tag;
  app.scroll(200);
  assert.equal(app.find('row-5').tag, original);
  assert.equal(textOf(app.find('row-5')), '5:5');
  assert.equal(mounts.length, 1);
  setItems([]);
  app.clock.flushMicrotasks();
  assert.equal(
    app.find('row-5').instanceHandle.parent?.props['style'] &&
      (app.find('row-5').instanceHandle.parent!.props['style'] as Record<string, unknown>)[
        'display'
      ],
    'none',
  );
  setItems([{ id: 20, type: 'same' }]);
  app.clock.flushMicrotasks();
  assert.equal(app.find('row-20').tag, original);
  setItems([{ id: 21, type: 'other' }]);
  app.clock.flushMicrotasks();
  assert.notEqual(app.find('row-21').tag, original);
  assert.equal(mounts.length, 2);
  app.root.dispose();
  app.clock.flushMicrotasks();
  assert.equal(cleanups.length, 2);
  assert.deepEqual(app.errors, []);
});

test('compiled universal JSX list renderers retain keyed owners and numeric zero text', async () => {
  const { compiledListFixture } = await import('./g7-lists-fixture.tsx');
  registerPlatformComponents('ios');
  const fixture = compiledListFixture();
  const app = boot(fixture.Scene);
  const tag = app.find('one').tag;
  fixture.setItems([
    { id: 'two', label: 'Second2' },
    { id: 'one', label: 'First2' },
  ]);
  app.clock.flushMicrotasks();
  assert.equal(app.find('one').tag, tag);
  assert.equal(textOf(app.find('one')), 'First2:1:0');
  assert.equal(textOf(app.find('section-one')), 'First2:1');
  app.fabric.emit(app.find('refresh'), 'topRefresh', {});
  app.clock.flushMicrotasks();
  assert.equal(app.find('refresh').props['refreshing'], true);
  assert.deepEqual(fixture.cleanups, []);
  app.root.dispose();
  app.clock.flushMicrotasks();
  assert.deepEqual(fixture.cleanups.sort(), ['one', 'two']);
  assert.deepEqual(app.errors, []);
});

test('parked recycling owners retain old type-specific item data when the same key changes type', () => {
  registerPlatformComponents('ios');
  type Item =
    | { id: number; kind: 'a'; a: { title: string } }
    | { id: number; kind: 'b'; b: { title: string } };
  const [items, setItems] = createSignal<readonly Item[]>([
    { id: 1, kind: 'a', a: { title: 'Alpha' } },
  ]);
  const [typed, setTyped] = createSignal(true);
  const mounted: string[] = [];
  const app = boot(() =>
    VirtualList({
      testID: 'list',
      get items() {
        return items();
      },
      itemHeight: 40,
      recycleItems: true,
      itemType: (item) => (typed() ? item.kind : 'untyped'),
      keyExtractor: (item) => item.id,
      renderItem(item) {
        const type = item().kind;
        mounted.push(type);
        return Text({
          testID: type,
          get children() {
            return type === 'a'
              ? (item() as Extract<Item, { kind: 'a' }>).a.title
              : (item() as Extract<Item, { kind: 'b' }>).b.title;
          },
        });
      },
    }),
  );
  setItems([{ id: 1, kind: 'b', b: { title: 'Beta' } }]);
  app.clock.flushMicrotasks();
  assert.equal(textOf(app.find('a')), 'Alpha');
  assert.equal(textOf(app.find('b')), 'Beta');
  assert.deepEqual(mounted, ['a', 'b']);
  setTyped(false);
  app.clock.flushMicrotasks();
  assert.deepEqual(
    mounted,
    ['a', 'b', 'b'],
    'reactive itemType dependencies can change the slot type',
  );
  app.root.dispose();
  app.clock.flushMicrotasks();
  assert.deepEqual(app.errors, []);
});

test('sticky row/header bindings disabled before commit cannot install a stale native driver', () => {
  registerPlatformComponents('ios');
  const [enabled, setEnabled] = createSignal(false);
  let binds = 0,
    stops = 0;
  const app = boot(
    () =>
      VirtualList({
        testID: 'list',
        items: [1, 2, 3],
        itemHeight: 40,
        get stickyIndices() {
          return enabled() ? [0] : [];
        },
        get stickyHeader() {
          return enabled();
        },
        listHeader: Text({ children: 'Header' }),
        renderItem: (item) =>
          Text({
            get children() {
              return item();
            },
          }),
      }),
    (root) => {
      Object.defineProperty(root.engine, 'drivesScroll', { value: true });
      root.engine.driveByScroll = () => {
        binds++;
        return {
          update() {},
          shift: () => 0,
          stop() {
            stops++;
          },
        };
      };
    },
  );
  setEnabled(true);
  setEnabled(false);
  app.clock.flushMicrotasks();
  assert.equal(binds, 0);
  setEnabled(true);
  app.clock.flushMicrotasks();
  assert.equal(binds, 2);
  setEnabled(false);
  app.clock.flushMicrotasks();
  assert.equal(stops, 2);
  app.root.dispose();
  app.clock.flushMicrotasks();
  assert.deepEqual(app.errors, []);
});

test('a refresh accepted then synchronously finished before commit still stops the native spinner', () => {
  registerPlatformComponents('ios');
  const [refreshing, setRefreshing] = createSignal(false);
  const app = boot(() =>
    ScrollView({
      testID: 'list',
      get refreshControl() {
        return {
          testID: 'refresh',
          refreshing: refreshing(),
          onRefresh() {
            setRefreshing(true);
            setRefreshing(false);
          },
        };
      },
    }),
  );
  app.fabric.emit(app.find('refresh'), 'topRefresh', {});
  app.clock.flushMicrotasks();
  assert.equal(app.find('refresh').props['refreshing'], false);
  assert.deepEqual(
    app.commands.map(({ name, args }) => ({ name, args })),
    [{ name: 'setNativeRefreshing', args: [false] }],
  );
  app.root.dispose();
  assert.deepEqual(app.errors, []);
});

test('scrolling prefetches rows ahead a frame at a time, within a budget, and lets them go on turning round', () => {
  const items = Array.from({ length: 50 }, (_, id) => ({ id }));
  let slow = false;
  const app = boot(() =>
    VirtualList({
      testID: 'list',
      items,
      itemHeight: 50,
      overscan: 0,
      prefetch: 3,
      keyExtractor: (item) => item.id,
      renderItem: (item) => {
        // Past the per-frame budget on its own, so each frame can make exactly one.
        const until = performance.now() + 6;
        while (slow && performance.now() < until);
        return Text({ testID: `row-${item().id}`, children: 'row' });
      },
    }),
  );
  const rows = () =>
    app
      .all()
      .map((node) => String(node.props['testID'] ?? ''))
      .filter((id) => id.startsWith('row-'))
      .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  const frame = () => {
    app.clock.frame(performance.now());
    app.clock.flushMicrotasks();
  };
  app.layout(app.find('list'), 200, 100);
  assert.equal(app.clock.frames.size, 0, 'nothing is prefetched before the list scrolls');
  app.scroll(100);
  assert.deepEqual(rows(), ['row-2', 'row-3']);
  slow = true;
  frame();
  assert.deepEqual(rows(), ['row-2', 'row-3', 'row-4']);
  frame();
  frame();
  assert.deepEqual(rows(), ['row-2', 'row-3', 'row-4', 'row-5', 'row-6']);
  slow = false;
  frame();
  assert.equal(app.clock.frames.size, 0, 'it stops once the rows ahead are made');
  app.scroll(150);
  assert.deepEqual(rows(), ['row-3', 'row-4', 'row-5', 'row-6'], 'made rows are reused');
  frame();
  assert.deepEqual(rows(), ['row-3', 'row-4', 'row-5', 'row-6', 'row-7']);
  app.scroll(100);
  assert.deepEqual(rows(), ['row-2', 'row-3'], 'turning round drops the rows made ahead');
  frame();
  assert.deepEqual(rows(), ['row-0', 'row-1', 'row-2', 'row-3']);
  app.scroll(200);
  app.root.dispose();
  assert.equal(app.clock.frames.size, 0, 'disposal cancels a pending prefetch');
  assert.deepEqual(app.errors, []);
});

test('prefetch 0 never asks for a frame', () => {
  const app = boot(() =>
    VirtualList({
      testID: 'list',
      items: Array.from({ length: 50 }, (_, id) => ({ id })),
      itemHeight: 50,
      prefetch: 0,
      keyExtractor: (item) => item.id,
      renderItem: () => Text({ children: 'row' }),
    }),
  );
  app.layout(app.find('list'), 200, 100);
  app.scroll(300);
  assert.equal(app.clock.frames.size, 0);
});
