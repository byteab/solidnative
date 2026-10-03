import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerPlatformComponents } from '@solid-native/fabric';
import { createNativeRoot } from '@solid-native/platform/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { chromeFixture } from './g8-chrome-fixture.tsx';
import type { NativeRoute, NativeNavigation } from '../src/solid.ts';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
async function boot(extra: readonly NativeRoute[] = []) {
  registerPlatformComponents('ios');
  const fixture = chromeFixture(extra),
    fabric = createFakeFabric(),
    clock = createClock();
  const commands: { name: string; args: unknown }[] = [];
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.engine.dispatchCommand = (_node, name, args) => {
    commands.push({ name, args });
  };
  root.render(fixture.Scene);
  const nav = fixture.nav();
  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  const settle = () => {
    clock.flushMicrotasks();
    if (nav.transition()) nav.complete(nav.transition()!);
    clock.flushMicrotasks();
  };
  await nav.reset('/');
  settle();
  return { fixture, fabric, clock, root, nav, nodes, settle, commands };
}

test('native search keeps controlled text authoritative, exposes events and commits safe commands', async () => {
  const h = await boot();
  const search = h.nodes().find((n) => n.viewName === 'RNSSearchBar')!;
  assert.equal(search.props['obscureBackground'], 'false');
  assert.equal(search.props['hideNavigationBar'], 'true');
  assert.deepEqual(h.commands.at(-1), { name: 'setText', args: ['seed'] });
  h.fabric.emit(search, 'topChangeText', { text: 'accepted' });
  h.clock.flushMicrotasks();
  assert.equal(h.fixture.query(), 'accepted');
  h.fixture.reject();
  h.fabric.emit(search, 'topChangeText', { text: 'rejected' });
  h.clock.flushMicrotasks();
  assert.deepEqual(h.commands.at(-1), { name: 'setText', args: ['accepted'] });
  h.fixture.ref().clear();
  h.clock.flushMicrotasks();
  assert.equal(h.fixture.query(), 'accepted');
  assert.deepEqual(h.commands.at(-1), { name: 'setText', args: ['accepted'] });
  for (const event of [
    'topSearchButtonPress',
    'topCancelButtonPress',
    'topSearchFocus',
    'topSearchBlur',
  ])
    h.fabric.emit(search, event, {});
  assert.deepEqual(h.fixture.calls.slice(-4), ['search:accepted', 'cancel', 'focus', 'blur']);
  h.fixture.ref().focus();
  assert.notEqual(h.commands.at(-1)?.name, 'focus');
  h.clock.flushMicrotasks();
  assert.equal(h.commands.at(-1)?.name, 'focus');
  h.fixture.ref().blur();
  h.root.dispose();
  h.clock.flushMicrotasks();
  assert.equal(h.commands.at(-1)?.name, 'focus');
});

test('covered search ignores late events/commands and corrects text on return with header updates', async () => {
  const h = await boot();
  const search = h.nodes().find((n) => n.viewName === 'RNSSearchBar')!;
  await h.nav.push('/other');
  h.settle();
  h.fixture.setQuery('covered');
  h.fixture.setColor('blue');
  h.fixture.ref().focus();
  h.clock.flushMicrotasks();
  h.fabric.emit(search, 'topChangeText', { text: 'late' });
  assert.equal(h.fixture.query(), 'covered');
  assert.equal(
    h.nodes().find((n) => n.viewName === 'RNSScreenStackHeaderConfig')!.props['color'],
    'red',
  );
  await h.nav.back();
  h.settle();
  assert.deepEqual(h.commands.at(-1), { name: 'setText', args: ['covered'] });
  const header = h.nodes().find((n) => n.viewName === 'RNSScreenStackHeaderConfig')!;
  assert.equal(header.props['color'], 'blue');
  assert.equal(header.props['largeTitleFontSize'], 38);
  assert.equal(header.props['backButtonInCustomView'], true);
  assert.equal(header.props['consumeLeftInset'], false);
  h.root.dispose();
});

test('componentless guard/resolver groups inherit inputs without manufacturing native screens', async () => {
  const seen: string[] = [];
  const h = await boot([
    {
      path: 'group/:gid',
      data: { outer: 1 },
      guard: (ctx) => {
        seen.push('guard:' + ctx.to.params['gid']);
        return true;
      },
      resolve: () => ({ resolved: 'parent' }),
      children: [
        {
          path: '',
          children: [{ path: 'item/:id', data: { outer: 2 }, component: () => undefined }],
        },
      ],
    },
  ]);
  assert.equal(await h.nav.push('/group/g/item/i?q=yes'), true);
  h.settle();
  const route = h.nav.current()!.route;
  assert.deepEqual(
    { ...route.inputs },
    { q: 'yes', gid: 'g', id: 'i', outer: 2, resolved: 'parent' },
  );
  assert.deepEqual(seen, ['guard:g']);
  assert.equal(h.nav.current()!.children, undefined);
  assert.equal(h.nodes().filter((n) => n.viewName === 'RNSScreen').length, 2);
  h.root.dispose();
});

test('navigation state is copied before async preparation, separate from inputs and retained per screen', async () => {
  let resume!: (value: boolean) => void;
  const h = await boot([
    {
      path: 'delayed',
      guard: () =>
        new Promise<boolean>((resolve) => {
          resume = resolve;
        }),
      component: () => undefined,
    },
  ]);
  const state = { title: 'Original' };
  const pending = h.nav.push('/delayed?title=query', { state });
  state.title = 'Mutated';
  resume(true);
  assert.equal(await pending, true);
  h.settle();
  const entry = h.nav.current()!;
  assert.equal(entry.route.state?.['title'], 'Original');
  assert.equal(entry.route.inputs['title'], 'query');
  assert.ok(Object.isFrozen(entry.route.state));
  await h.nav.push('/other');
  h.settle();
  assert.equal(h.nav.current()!.route.state, undefined);
  await h.nav.back();
  h.settle();
  assert.equal(h.nav.current(), entry);
  h.root.dispose();
});
test('navigation started by an older guard abort listener keeps newest intent ownership', async () => {
  let latest: Promise<boolean> | undefined;
  let nav!: NativeNavigation;
  const h = await boot([
    {
      path: 'pending',
      guard: ({ signal }) =>
        new Promise<boolean>(() => {
          signal.addEventListener(
            'abort',
            () => {
              latest = nav.push('/latest');
            },
            { once: true },
          );
        }),
      component: () => undefined,
    },
    { path: 'middle', component: () => undefined },
    { path: 'latest', component: () => undefined },
  ]);
  nav = h.nav;
  const pending = nav.push('/pending');
  const middle = nav.push('/middle');
  assert.equal(await pending, false);
  assert.ok(latest);
  assert.equal(await latest, true, 'newest intent initiated during abort must win');
  assert.equal(await middle, false, 'the interrupted outer intent must not overwrite newest work');
  h.settle();
  assert.equal(nav.current()!.route.pathname, '/latest');
  h.root.dispose();
});
