/**
 * Screen identity on a native stack (HEAD's router-reuse.test.ts and the reuseScreen case of
 * router-stack.test.ts): a screen is its resolved url, never handed to another url, except a
 * route opted in with `reuseScreen`, which keeps one screen and updates its route in place.
 */
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createNativeRoot } from '@solid-native/platform/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { createScreenReuseFixture } from './screen-reuse-fixture.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

async function mount(t: TestContext) {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, clock: createClock(), rootTag: 1 });
  const fixture = createScreenReuseFixture();
  root.render(fixture.View);
  t.after(() => root.dispose());
  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  /** Settle every native stack's pending transition, as RN Screens' finish events do. */
  const settle = async () => {
    await tick();
    root.flush();
    for (const stack of nodes().filter((node) => node.viewName === 'RNSScreenStack'))
      fabric.emit(stack, 'topFinishTransitioning');
    root.flush();
  };
  const text = (name: string) =>
    nodes()
      .filter((node) => node.props['testID'] === `text:${name}`)
      .map((node) =>
        flatten(node.children)
          .map((child) => child.props['text'])
          .filter((value) => typeof value === 'string')
          .join(''),
      );
  /** The root stack's screens, bottom first, by the testID of the page each shows. */
  const stack = () =>
    nodes()
      .find((node) => node.props['testID'] === 'root-stack')!
      .children.map(
        (screen) =>
          flatten(screen.children).find((node) => node.viewName !== 'RNSScreen')?.props['testID'],
      );
  assert.equal(await fixture.nav.reset('/'), true);
  await settle();
  return { fixture, nav: fixture.nav, root, settle, text, stack, nodes };
}

test('reuseScreen updates one screen in place: no new screen, no transition, reactive route', async (t) => {
  const { fixture, nav, root, settle, text, stack } = await mount(t);
  assert.equal(await nav.push('/photo/1'), true);
  await settle();
  const photo = nav.current()!;
  assert.equal(await nav.push('/photo/2?tab=info', { state: { from: 'pager' } }), true);
  assert.ok(nav.transition() === null, 'an in-place update stages no native transition');
  root.flush();
  assert.deepEqual(stack(), ['home', 'photo']);
  assert.equal(fixture.created['photo'], 1);
  assert.ok(nav.current() === photo, 'the same retained entry and owner');
  assert.equal(photo.owner.disposed, false);
  assert.equal(nav.url(), '/photo/2?tab=info');
  assert.equal(photo.route.params['index'], '2');
  assert.deepEqual(text('photo'), ['/photo/2|2|info|pager'], 'useRoute() fields update in place');

  assert.equal(await nav.replace('/photo/3'), true);
  root.flush();
  assert.deepEqual(stack(), ['home', 'photo']);
  assert.equal(fixture.created['photo'], 1);
  assert.deepEqual(text('photo'), ['/photo/3|3||']);

  // The stack is unchanged by in-place updates: one back leaves the pager.
  assert.equal(await nav.back(), true);
  await settle();
  assert.deepEqual(stack(), ['home']);
  assert.equal(fixture.live['photo'], 0);
  assert.deepEqual(fixture.errors, []);
});

test('a query-only push or replace updates the top screen in place; a path change still pushes', async (t) => {
  const { fixture, nav, root, settle, text, stack, nodes } = await mount(t);
  assert.equal(await nav.push('/users/1'), true);
  await settle();
  const user = nav.current()!;
  const screenTag = () => nodes().find((node) => node.props['screenId'] === user.key)?.tag;
  const tag = screenTag();
  assert.ok(tag !== undefined);
  assert.equal(await nav.push('/users/1?tab=posts#top'), true);
  assert.ok(nav.transition() === null, 'an in-place update stages no native transition');
  root.flush();
  assert.deepEqual(stack(), ['home', 'user']);
  assert.equal(fixture.created['user'], 1);
  assert.ok(nav.current() === user);
  assert.equal(screenTag(), tag, 'the same native screen');
  assert.equal(nav.url(), '/users/1?tab=posts#top');
  assert.equal(user.route.fragment, 'top');
  assert.deepEqual(text('user'), ['/users/1||posts|'], 'the query signal updates');

  assert.equal(await nav.replace('/users/1?tab=likes'), true);
  root.flush();
  assert.deepEqual(stack(), ['home', 'user']);
  assert.equal(fixture.created['user'], 1);
  assert.deepEqual(text('user'), ['/users/1||likes|']);

  assert.equal(await nav.push('/users/2?tab=likes'), true);
  await settle();
  assert.deepEqual(stack(), ['home', 'user', 'user'], 'a different path is a new screen');
  assert.equal(fixture.created['user'], 2);
  // In-place updates leave the stack as it was: back returns to the screen below the first push.
  await nav.back();
  await settle();
  await nav.back();
  await settle();
  assert.deepEqual(stack(), ['home']);
  assert.equal(fixture.live['user'], 0);
  assert.deepEqual(fixture.errors, []);
});

test('a query-only push updates the leaf in a nested stack and a selected tab in place', async (t) => {
  const { fixture, nav, settle } = await mount(t);
  await nav.push('/a/1');
  await settle();
  const leaf = nav.current()!.children!.current()!;
  assert.equal(await nav.push('/a/1?tab=x'), true);
  await settle();
  assert.ok(nav.current()!.children!.current() === leaf);
  assert.equal(leaf.route.query['tab'], 'x');
  assert.equal(fixture.created['a-leaf'], 1);

  await nav.push('/tabs/other');
  await settle();
  const other = nav.current()!.children!.current()!;
  assert.equal(await nav.push('/tabs/other?tab=y'), true);
  await settle();
  assert.ok(nav.current()!.children!.current() === other);
  assert.equal(other.route.query['tab'], 'y');
  assert.equal(fixture.created['other'], 1);
  assert.deepEqual(fixture.errors, []);
});

test('reuseScreen reuses only the top screen; present and reset still mount fresh screens', async (t) => {
  const { fixture, nav, settle, stack } = await mount(t);
  await nav.push('/photo/1');
  await settle();
  await nav.push('/users/1');
  await settle();
  assert.equal(await nav.push('/photo/2'), true);
  await settle();
  assert.deepEqual(stack(), ['home', 'photo', 'user', 'photo']);
  assert.equal(fixture.created['photo'], 2);
  assert.equal(await nav.present('/photo/3'), true);
  await settle();
  assert.equal(fixture.created['photo'], 3);
  assert.equal(await nav.reset('/photo/4'), true);
  await settle();
  assert.deepEqual(stack(), ['photo']);
  assert.equal(fixture.created['photo'], 4);
  assert.equal(fixture.live['photo'], 1);
});

test('a different param is a different screen; pushing away keeps the screen below alive', async (t) => {
  const { fixture, nav, settle, stack } = await mount(t);
  await nav.push('/users/1');
  await settle();
  const one = nav.current()!;
  assert.equal(await nav.push('/users/2'), true);
  await settle();
  assert.deepEqual(stack(), ['home', 'user', 'user']);
  assert.equal(fixture.created['user'], 2);
  assert.equal(one.owner.disposed, false, 'detached, not destroyed');
  assert.equal(one.route.params['id'], '1');
  await nav.back();
  await settle();
  assert.ok(nav.current() === one, 'back reveals the same screen');
  assert.equal(fixture.created['user'], 2);
});

test('two routes whose segments join to the same text stay apart', async (t) => {
  const { fixture, nav, settle } = await mount(t);
  await nav.push('/seg/a%2Fb');
  await settle();
  await nav.push('/seg/a/b');
  await settle();
  assert.equal(fixture.created['seg-one'], 1);
  assert.equal(fixture.created['seg-two'], 1);
  assert.ok(nav.entries()[1] !== nav.entries()[2]);
});

test('the same leaf under different parents is two screens; a layout is not a screen of its own', async (t) => {
  const { fixture, nav, settle } = await mount(t);
  await nav.push('/a/1');
  await settle();
  const a = nav.current()!;
  // A push inside the layout keeps the layout and stacks in its own outlet.
  await nav.push('/a/2');
  await settle();
  assert.ok(nav.current() === a);
  assert.equal(fixture.created['a'], 1);
  assert.equal(a.children!.entries().length, 2);
  await nav.push('/b/1');
  await settle();
  assert.equal(fixture.created['b'], 1);
  assert.equal(fixture.created['b-leaf'], 1, 'same leaf, different parent');
  assert.equal(fixture.live['a-leaf'], 2);
});

test('a tab and the empty-path screen at the root of its stack are kept apart', async (t) => {
  const { fixture, nav, settle } = await mount(t);
  assert.equal(await nav.push('/tabs/library'), true);
  await settle();
  const tabs = nav.current()!.children!;
  const library = tabs.current()!;
  const list = library.children!.current()!;
  assert.ok(library !== list);
  assert.equal(library.route.pathname, '/tabs/library');
  assert.equal(list.route.pathname, '/tabs/library');
  assert.equal(fixture.created['library'], 1);
  assert.equal(fixture.created['list'], 1);
  // Switching away and back keeps the tab's whole subtree.
  assert.equal(await tabs.selectTab('other'), true);
  await settle();
  assert.equal(await tabs.selectTab('library'), true);
  await settle();
  assert.ok(tabs.current() === library);
  assert.ok(library.children!.current() === list);
  assert.equal(fixture.created['library'], 1);
  assert.deepEqual(fixture.errors, []);
});

test('a sheet presented over a parent with children leaves that parent standing', async (t) => {
  const { fixture, nav, settle, stack } = await mount(t);
  await nav.push('/tabs/library');
  await settle();
  const tabs = nav.current()!;
  assert.equal(await nav.present('/sheet'), true);
  await settle();
  assert.deepEqual(stack(), ['home', 'tabs-host', 'sheet']);
  assert.equal(tabs.owner.disposed, false);
  assert.equal(fixture.live['tabs'], 1);
});

test('a popped screen is forgotten: pushing its url again builds a fresh one', async (t) => {
  const { fixture, nav, settle } = await mount(t);
  await nav.push('/users/1');
  await settle();
  const first = nav.current()!;
  await nav.back();
  await settle();
  assert.equal(first.owner.disposed, true);
  assert.equal(fixture.live['user'], 0);
  await nav.push('/users/1');
  await settle();
  assert.ok(nav.current() !== first, 'a destroyed screen is never offered back');
  assert.equal(nav.current()!.owner.disposed, false);
  assert.equal(fixture.created['user'], 2);
});
