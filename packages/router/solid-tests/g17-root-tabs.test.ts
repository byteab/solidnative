import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solidnative/platform/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { createRootTabsFixture } from './g17-root-tabs-fixture.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function mount() {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, clock: createClock(), rootTag: 1 });
  const fixture = createRootTabsFixture();
  root.render(fixture.View);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((node) => node.props['testID'] === id);
    assert.ok(node, `Committed ${id}`);
    return node;
  };
  const settle = () => {
    root.flush();
    fabric.emit(find('root-stack'), 'topFinishTransitioning');
    root.flush();
  };
  return { fixture, root, find, settle };
}

test('a relative redirect under an empty-path tabs parent lands on /x, never the external //x', async () => {
  const { fixture, root, find } = mount();
  assert.equal(await fixture.nav.reset('/'), true);
  root.flush();
  assert.equal(fixture.nav.url(), '/notes');
  assert.deepEqual(fixture.errors, []);
  find('page:/notes');
  root.dispose();
});

test('selecting an unvisited tab under base / pushes /x and mounts it', async () => {
  const { fixture, root, find, settle } = mount();
  // Deep link past the redirect so this proves selectTab's own path join.
  assert.equal(await fixture.nav.reset('/notes'), true);
  settle();
  const tabs = fixture.nav.current()!.children!;
  assert.equal(tabs.basePath, '/');
  assert.equal(await tabs.selectTab('settings'), true);
  await tick();
  root.flush();
  assert.equal(fixture.nav.url(), '/settings');
  find('page:/settings');
  assert.equal(await tabs.selectTab('notes'), true);
  root.flush();
  assert.equal(fixture.nav.url(), '/notes');
  assert.deepEqual(fixture.errors, []);
  root.dispose();
});

test('TabSafeAreaView commits RNSSafeAreaView with all four edges as booleans', async () => {
  const { fixture, root, find } = mount();
  await fixture.nav.reset('/notes');
  root.flush();
  const inset = find('inset:/notes');
  assert.equal(inset.viewName, 'RNSSafeAreaView');
  assert.deepEqual(inset.props['edges'], { top: false, right: false, bottom: true, left: false });
  assert.ok(inset.instanceHandle.classes?.has('inset'));
  root.dispose();
});
