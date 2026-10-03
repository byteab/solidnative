import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solidnative/platform/solid';
import { createCssFixture } from './css-compiled-fixture.tsx';
import { createFakeFabric, createClock, type FakeNode } from './fake-fabric.ts';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

test('actual native CSS imports scope compiled TSX, including reactive descendants, hosts and inherited styles', () => {
  const fixture = createCssFixture();
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((node) => node.props['testID'] === id);
    assert.ok(node, `native node ${id} exists`);
    return node;
  };
  root.render(fixture.View);
  assert.equal(find('outer').props['paddingTop'], 12);
  assert.equal(find('label').props['fontSize'], 17);
  assert.equal(find('label').props['color'], 'rgb(255, 0, 0)');
  assert.equal(find('label').props['opacity'], 0.4);
  assert.equal(find('unscoped').props['opacity'], undefined);
  // A bound `data-hover`/`data-focus` attribute is how a component drives `hover:`/`focus:` styles.
  fixture.setHover(true);
  clock.flushMicrotasks();
  assert.equal(find('label').props['opacity'], 0.6);
  fixture.setHover(false);
  clock.flushMicrotasks();
  assert.equal(find('label').props['opacity'], 0.4);
  fixture.setShown(true);
  fixture.setActive(true);
  clock.flushMicrotasks();
  assert.equal(find('later').props['fontSize'], 23);
  assert.equal(find('later').props['color'], 'rgb(0, 0, 255)');
  assert.equal(find('later').props['opacity'], 0.7);
  assert.equal(find('label').props['opacity'], 0.9);
  assert.equal(fixture.nodes.get('later')!.sheet, fixture.inner);
  assert.equal(fixture.nodes.get('label')!.sheet, fixture.outer);
  fixture.setInk('green');
  clock.flushMicrotasks();
  assert.equal(find('label').props['color'], 'green');
  assert.equal(find('later').props['color'], 'rgb(0, 0, 255)');
  fixture.setInk(undefined);
  clock.flushMicrotasks();
  assert.equal(find('label').props['color'], 'rgb(255, 0, 0)');
  const oldLater = fixture.nodes.get('later')!;
  fixture.setShown(false);
  clock.flushMicrotasks();
  assert.equal(oldLater.committed, null);
  fixture.setShown(true);
  clock.flushMicrotasks();
  assert.equal(find('later').props['opacity'], 0.7);
  root.dispose();
  assert.deepEqual(fabric.roots.get(1), []);
  const commits = fabric.commits;
  fixture.setInk('purple');
  fixture.setActive(false);
  clock.flushMicrotasks();
  assert.equal(fabric.commits, commits);
  assert.equal(clock.frames.size, 0);
  const clean = createNativeRoot({ fabric, clock, rootTag: 1 });
  clean.render(createCssFixture().View);
  assert.equal(find('label').props['opacity'], 0.4);
  assert.equal(find('unscoped').props['opacity'], undefined);
  clean.dispose();
});
