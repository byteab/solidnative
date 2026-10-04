import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, onCleanup } from 'solid-js';
import { createNativeRoot } from '@solidnative/platform/solid';
import { createRetainedStack, createRouteOwner } from '@solidnative/router/solid';
import { createRouteFixture } from './compiled-fixture.tsx';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function contents(node: FakeNode): string {
  return String(node.props['text'] ?? '') + node.children.map(contents).join('');
}

function mount() {
  const fabric = createFakeFabric();
  const clock = createClock();
  const fixture = createRouteFixture();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.View);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((node) => node.props['testID'] === id);
    assert.ok(node, `Committed node ${id} exists.`);
    return node;
  };
  return { fabric, clock, fixture, root, find };
}

test('compiled routes inherit context and keep covered owners, native tags and effects alive', () => {
  const { fixture, root, find, clock, fabric } = mount();
  const a = fixture.routes.get('a')!;
  const aTag = find('a').tag;
  const aSnapshot = find('a');
  assert.equal(contents(aSnapshot), 'inherited:0');
  const b = fixture.create('b');
  const push = fixture.stack.transitionTo([a, b]);
  assert.deepEqual(fixture.stack.entries(), [a, b]);
  assert.deepEqual(fixture.stack.children(), [a.node, b.node]);
  assert.equal(fixture.stack.complete(push), true);
  fixture.setValue(1);
  clock.flushMicrotasks();
  assert.equal(find('a').tag, aTag);
  assert.equal(contents(find('a')), 'inherited:1');
  assert.equal(contents(aSnapshot), 'inherited:0', 'Fabric snapshots remain immutable');
  fabric.emit(find('a'), 'topTouchEnd');
  fabric.emit(find('b'), 'topTouchEnd');
  assert.deepEqual(fixture.events, ['a', 'b']);
  assert.deepEqual(fixture.cleanups, []);
  assert.deepEqual(fixture.resources, []);
  root.dispose();
  assert.equal(a.disposed, true);
  assert.equal(b.disposed, true);
  assert.equal(fixture.stack.disposed, true);
  assert.deepEqual(fixture.resources.sort(), ['a', 'b']);
});

test('pop waits for completion, cancellation restores identity and stale tokens cannot release routes', () => {
  const { fixture, root, find, clock, fabric } = mount();
  const a = fixture.routes.get('a')!;
  const b = fixture.create('b');
  fixture.stack.complete(fixture.stack.transitionTo([a, b]));
  clock.flushMicrotasks();
  const bNative = find('b');
  const bTag = bNative.tag;
  const pop = fixture.stack.dismiss()!;
  clock.flushMicrotasks();
  assert.equal(find('b').tag, bTag, 'outgoing native screen is still present during transition');
  assert.equal(b.disposed, false);
  assert.deepEqual(fixture.cleanups, []);
  assert.equal(fixture.stack.cancel(pop), true);
  clock.flushMicrotasks();
  assert.equal(find('b').tag, bTag);
  const popAgain = fixture.stack.dismiss()!;
  assert.equal(fixture.stack.complete(pop), false);
  assert.equal(fixture.stack.cancel(pop), false);
  assert.equal(b.disposed, false);
  assert.equal(fixture.stack.complete(popAgain), true);
  assert.equal(b.disposed, true);
  assert.deepEqual(fixture.cleanups, [], 'a popped screen is torn down after the commit');
  clock.flushMicrotasks();
  assert.deepEqual(fixture.cleanups, ['b']);
  assert.deepEqual(fixture.resources, ['b']);
  assert.deepEqual(
    find('stack').children.map((node) => node.children[0]!.props['testID']),
    ['a'],
  );
  const effectCount = fixture.effects.filter((entry) => entry.startsWith('b:')).length;
  fixture.setValue(2);
  fabric.emit(bNative, 'topTouchEnd');
  clock.flushMicrotasks();
  assert.equal(fixture.effects.filter((entry) => entry.startsWith('b:')).length, effectCount);
  assert.deepEqual(fixture.events, []);
  b.dispose();
  fixture.stack.complete(popAgain);
  root.dispose();
  root.dispose();
  assert.deepEqual(fixture.cleanups.sort(), ['a', 'b']);
});

test('retained detach and explicit reuse preserve native identity until release clears resources', () => {
  const { fixture, root, find, clock, fabric } = mount();
  const a = fixture.routes.get('a')!;
  const b = fixture.create('b');
  fixture.stack.complete(fixture.stack.transitionTo([a, b]));
  clock.flushMicrotasks();
  const bNative = find('b');
  const creates = fabric.creates;
  fixture.stack.complete(fixture.stack.transitionTo([a], { retainRemoved: true }));
  clock.flushMicrotasks();
  assert.equal(b.node.parent, null);
  assert.equal(b.disposed, false);
  assert.deepEqual(fixture.stack.retained(), [a, b]);
  fabric.emit(bNative, 'topTouchEnd');
  assert.deepEqual(fixture.events, [], 'detached native routes cannot receive stale events');
  fixture.stack.complete(fixture.stack.transitionTo([a, b]));
  clock.flushMicrotasks();
  assert.equal(find('b').tag, bNative.tag);
  assert.equal(fabric.creates, creates);
  assert.throws(() => fixture.stack.release('b'), /still visible/);
  fixture.stack.complete(fixture.stack.transitionTo([a], { retainRemoved: true }));
  clock.flushMicrotasks();
  assert.equal(fixture.stack.release('b'), true);
  assert.equal(fixture.stack.release('b'), false);
  clock.flushMicrotasks();
  assert.equal(b.disposed, true);
  assert.deepEqual(fixture.stack.retained(), [a]);
  assert.deepEqual(fixture.resources, ['b']);
  assert.equal(bNative.instanceHandle.committed, null);
  root.dispose();
});

test('cancelled push/reset destroy only newly adopted owners and preserve cached routes', () => {
  const { fixture, root, clock, find } = mount();
  const a = fixture.routes.get('a')!;
  const aTag = find('a').tag;
  const b = fixture.create('b');
  const push = fixture.stack.transitionTo([a, b]);
  fixture.stack.cancel(push);
  clock.flushMicrotasks();
  assert.equal(b.disposed, true);
  assert.equal(find('a').tag, aTag);
  assert.equal(
    fixture.commits.includes('b'),
    false,
    'disposed route commit callback was cancelled',
  );
  const c = fixture.create('c');
  fixture.stack.complete(fixture.stack.transitionTo([a, c]));
  fixture.stack.complete(fixture.stack.transitionTo([a], { retainRemoved: true }));
  const d = fixture.create('d');
  const reset = fixture.stack.transitionTo([c, d]);
  clock.flushMicrotasks();
  fixture.stack.cancel(reset);
  clock.flushMicrotasks();
  assert.equal(c.disposed, false, 'a cached route is not newly owned by this cancelled transition');
  assert.equal(d.disposed, true);
  assert.deepEqual(fixture.stack.entries(), [a]);
  assert.deepEqual(fixture.stack.retained(), [a, c]);
  assert.equal(find('a').tag, aTag);
  fixture.stack.clear();
  clock.flushMicrotasks();
  assert.deepEqual(fixture.stack.retained(), []);
  assert.deepEqual(fixture.stack.children(), []);
  assert.deepEqual(fixture.cleanups.sort(), ['a', 'b', 'c', 'd']);
  const e = fixture.create('e');
  fixture.stack.complete(fixture.stack.transitionTo([e]));
  clock.flushMicrotasks();
  assert.ok(find('e'));
  root.dispose();
});

test('failed route construction and throwing cleanup/reporters cannot strand sibling effects', () => {
  const { fixture, root, clock, find } = mount();
  const a = fixture.routes.get('a')!;
  assert.throws(
    () => fixture.create('failed', { failRender: true, throwCleanup: true, throwReporter: true }),
    /render:failed/,
  );
  clock.flushMicrotasks();
  assert.deepEqual(fixture.stack.entries(), [a]);
  assert.equal(contents(find('a')), 'inherited:0');
  assert.deepEqual(fixture.cleanups, ['failed']);
  assert.deepEqual(fixture.resources, ['failed']);
  const b = fixture.create('b', { throwCleanup: true, throwReporter: true });
  const c = fixture.create('c', { throwCleanup: true });
  fixture.stack.complete(fixture.stack.transitionTo([a, b, c]));
  clock.flushMicrotasks();
  const token = fixture.stack.dismiss(100)!;
  assert.deepEqual(token.to, [a]);
  fixture.stack.complete(token);
  clock.flushMicrotasks();
  const effects = fixture.effects.length;
  fixture.setValue(1);
  clock.flushMicrotasks();
  assert.equal(fixture.effects.length, effects + 2, 'only the surviving route effects execute');
  assert.deepEqual(fixture.cleanups.sort(), ['b', 'c', 'failed']);
  assert.equal(fixture.reports.length, 3);
  assert.equal(fixture.stack.dismiss(), null, 'native dismissal preserves the base route');
  root.dispose();
});

test('parent disposal clears visible, pending and detached routes exactly once', () => {
  const { fixture, root, clock, fabric, find } = mount();
  const a = fixture.routes.get('a')!;
  const b = fixture.create('b', { throwCleanup: true });
  fixture.stack.complete(fixture.stack.transitionTo([a, b]));
  clock.flushMicrotasks();
  const bNative = find('b');
  fixture.stack.complete(fixture.stack.transitionTo([a], { retainRemoved: true }));
  clock.flushMicrotasks();
  const c = fixture.create('c', { throwCleanup: true });
  const token = fixture.stack.transitionTo([c]);
  clock.flushMicrotasks();
  const natives = [find('a'), bNative, find('c')];
  root.dispose();
  fixture.stack.dispose();
  fixture.stack.clear();
  assert.equal(fixture.stack.complete(token), false);
  assert.equal(fixture.stack.cancel(token), false);
  const effects = fixture.effects.length;
  fixture.setValue(10);
  clock.flushMicrotasks();
  assert.equal(fixture.effects.length, effects);
  assert.deepEqual(fixture.cleanups.sort(), ['a', 'b', 'c']);
  assert.deepEqual(fixture.resources.sort(), ['a', 'b', 'c']);
  for (const node of natives) assert.equal(node.instanceHandle.committed, null);
  assert.deepEqual(fabric.roots.get(1), []);
  assert.deepEqual(fixture.stack.entries(), []);
  assert.deepEqual(fixture.stack.retained(), []);
  assert.throws(() => fixture.stack.transitionTo([]), /disposed/);
  assert.throws(() => fixture.stack.release('a'), /disposed/);
  assert.throws(() => fixture.stack.dismiss(), /disposed/);
});

test('direct route disposal cancels pending work and removes the active native projection', () => {
  const { fixture, root, clock, find } = mount();
  const a = fixture.routes.get('a')!;
  const b = fixture.create('b');
  const token = fixture.stack.transitionTo([a, b]);
  clock.flushMicrotasks();
  const natives = [find('a'), find('b')];
  a.dispose();
  clock.flushMicrotasks();
  assert.equal(b.disposed, true);
  assert.equal(fixture.stack.complete(token), false);
  assert.deepEqual(fixture.stack.retained(), []);
  assert.deepEqual(find('stack').children, []);
  assert.deepEqual(fixture.resources.sort(), ['a', 'b']);
  for (const node of natives) assert.equal(node.instanceHandle.committed, null);
  root.dispose();
});

test('an inherited Solid error handler cannot swallow failed construction cleanup', () => {
  const { fixture, root, clock } = mount();
  fixture.handledFailure();
  clock.flushMicrotasks();
  assert.deepEqual(fixture.cleanups, ['handled']);
  assert.deepEqual(fixture.resources, ['handled']);
  const effects = fixture.effects.length;
  fixture.setValue(1);
  clock.flushMicrotasks();
  assert.equal(fixture.effects.length, effects + 2, 'failed route effects have been unlinked');
  assert.equal(fixture.reports.length, 2, 'render failure and contained cleanup each report once');
  root.dispose();
});

test('completed replace/reset and counted dismiss retain only their intended owners', () => {
  const { fixture, root, clock, find } = mount();
  const a = fixture.routes.get('a')!;
  const b = fixture.create('b');
  const c = fixture.create('c');
  fixture.stack.complete(fixture.stack.transitionTo([a, b, c]));
  const d = fixture.create('d');
  const replace = fixture.stack.transitionTo([a, b, d]);
  clock.flushMicrotasks();
  assert.equal(c.disposed, false);
  assert.ok(find('c'));
  fixture.stack.complete(replace);
  clock.flushMicrotasks();
  assert.equal(c.disposed, true);
  assert.equal(b.disposed, false);
  const count = fixture.stack.dismiss(2)!;
  assert.deepEqual(count.from, [a, b, d]);
  assert.deepEqual(count.to, [a]);
  fixture.stack.complete(count);
  clock.flushMicrotasks();
  assert.deepEqual(fixture.stack.retained(), [a]);
  const e = fixture.create('e');
  fixture.stack.complete(fixture.stack.transitionTo([e]));
  clock.flushMicrotasks();
  assert.equal(a.disposed, true);
  assert.deepEqual(fixture.stack.retained(), [e]);
  e.dispose();
  clock.flushMicrotasks();
  assert.deepEqual(find('stack').children, []);
  assert.deepEqual(fixture.resources.sort(), ['a', 'b', 'c', 'd', 'e']);
  root.dispose();
});

test('route keys, disposed handles and cross-stack claims are rejected without mutation', () => {
  const { fixture, root } = mount();
  const a = fixture.routes.get('a')!;
  const duplicate = fixture.create('a');
  const dead = fixture.create('dead');
  dead.dispose();
  assert.throws(() => fixture.stack.transitionTo([a, a]), /Duplicate/);
  assert.throws(() => fixture.stack.transitionTo([duplicate]), /another owner/);
  assert.throws(() => fixture.stack.transitionTo([dead]), /disposed/);
  assert.throws(() => fixture.otherStack([a]), /another stack/);
  const other = fixture.otherStack();
  assert.throws(() => other.transitionTo([a]), /another stack/);
  assert.deepEqual(other.retained(), []);
  assert.deepEqual(fixture.stack.entries(), [a]);
  const b = fixture.create('b');
  const token = fixture.stack.transitionTo([a, b]);
  assert.throws(() => fixture.stack.transitionTo([a]), /pending/);
  assert.throws(() => fixture.stack.release('b'), /visible/);
  assert.throws(() => fixture.stack.dismiss(0), /positive/);
  assert.throws(() => fixture.stack.dismiss(1.5), /positive/);
  assert.throws(() => fixture.stack.dismiss(Infinity), /positive/);
  assert.equal(fixture.stack.transition(), token);
  fixture.stack.cancel(token);
  root.dispose();
  duplicate.dispose();
});

test('unowned creation is refused and an empty stack can dispose under a plain Solid root', () => {
  assert.throws(() => createRouteOwner('unowned', () => null), /active Solid owner/);
  assert.throws(() => createRetainedStack(), /active Solid owner/);
  createRoot((dispose) => {
    const stack = createRetainedStack();
    onCleanup(() => stack.dispose());
    dispose();
    assert.equal(stack.disposed, true);
  });
});
