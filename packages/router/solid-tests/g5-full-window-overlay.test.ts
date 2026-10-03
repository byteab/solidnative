import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solid-native/platform/solid';
import { registerPlatformComponents } from '@solid-native/fabric';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { overlayFixture } from './g5-full-window-overlay-fixture.tsx';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function contents(node: FakeNode): string {
  return String(node.props['text'] ?? '') + node.children.map(contents).join('');
}

function boot() {
  const fixture = overlayFixture();
  const fabric = createFakeFabric();
  const clock = createClock();
  const errors: unknown[] = [];
  const root = createNativeRoot({
    fabric,
    clock,
    rootTag: 1,
    engineOptions: { onError: (error) => errors.push(error) },
  });
  root.render(fixture.Scene);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((entry) => entry.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };
  return { fixture, fabric, clock, root, find, errors };
}

test('compiled overlay uses the platform window host, keeps child order and passes empty-space touches through', () => {
  for (const platform of ['ios', 'android'] as const) {
    registerPlatformComponents(platform);
    const { root, find, fixture } = boot();
    try {
      const overlay = find('overlay');
      assert.equal(overlay.viewName, platform === 'ios' ? 'RNSFullWindowOverlay' : 'RCTView');
      assert.equal(overlay.props['pointerEvents'], 'box-none');
      assert.equal(overlay.props['position'], 'absolute');
      assert.equal(overlay.props['left'], 0);
      assert.equal(overlay.props['top'], 0);
      assert.equal(overlay.props['width'], 390);
      assert.equal(overlay.props['height'], 800);
      assert.equal(overlay.props['opacity'], 0.75);
      assert.equal(overlay.props['accessibilityContainerViewIsModal'], false);
      assert.equal(overlay.props['modal'], undefined);
      assert.equal(overlay.props['nativeID'], 'global-overlay');
      assert.equal(fixture.ref(), overlay.instanceHandle);
      assert.deepEqual(
        find('app').children.map((child) => child.props['testID']),
        ['screen', 'overlay'],
      );
      assert.equal(contents(overlay), 'Loading');
    } finally {
      root.dispose();
      registerPlatformComponents('ios');
    }
  }
});

test('overlay follows window rotation and measured edge-to-edge frames without remounting its content', () => {
  const { root, fixture, clock, find, fabric } = boot();
  const initial = find('overlay');
  const child = find('toast');
  fixture.emit({ window: { width: 800, height: 390 }, screen: { width: 844, height: 390 } });
  fixture.setModal(true);
  fixture.setOpacity(1);
  fixture.setLabel('Ready');
  clock.flushMicrotasks();
  assert.equal(find('overlay').props['width'], 800);
  assert.equal(find('overlay').props['height'], 390);
  assert.equal(find('overlay').props['accessibilityContainerViewIsModal'], true);
  assert.equal(find('overlay').props['opacity'], 1);
  assert.equal(contents(find('toast')), 'Ready');
  assert.equal(find('overlay').tag, initial.tag);
  assert.equal(find('toast').tag, child.tag);
  assert.ok(find('overlay').instanceHandle.classes?.has('active'));
  fixture.report(844, 390);
  clock.flushMicrotasks();
  assert.equal(find('overlay').props['width'], 844, 'measured drawable frame outranks Dimensions');
  const commits = fabric.commits;
  fixture.emit({ window: { width: 700, height: 300 }, screen: { width: 844, height: 390 } });
  clock.flushMicrotasks();
  assert.equal(find('overlay').props['width'], 844);
  assert.equal(fabric.commits, commits, 'Dimensions does not dirty a measured window');
  fixture.setModal(undefined);
  clock.flushMicrotasks();
  assert.equal(find('overlay').props['accessibilityContainerViewIsModal'], false);
  assert.equal(fixture.counts.mounts, 1);
  root.dispose();
});

test('an empty overlay remains mounted and conditional removal releases only its content owner', () => {
  const { root, fixture, clock, find } = boot();
  const initial = find('overlay');
  fixture.setContent(false);
  clock.flushMicrotasks();
  assert.equal(find('overlay').tag, initial.tag);
  assert.deepEqual(find('overlay').children, []);
  assert.equal(fixture.counts.cleanups, 1);
  fixture.setContent(true);
  clock.flushMicrotasks();
  assert.equal(fixture.counts.mounts, 2);
  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.ok(!flatten(find('app').children).some((child) => child.tag === initial.tag));
  assert.ok(
    find('app').children.every(
      (child) =>
        child.props['testID'] === 'screen' ||
        (child.viewName === 'RawText' && child.props['text'] === ''),
    ),
    "only the screen and Solid universal's empty branch marker remain",
  );
  assert.equal(fixture.counts.cleanups, 2);
  assert.equal(fixture.counts.stops, 0, 'the shared Screen service outlives the overlay');
  fixture.setVisible(true);
  clock.flushMicrotasks();
  assert.notEqual(find('overlay').tag, initial.tag);
  assert.equal(fixture.counts.subscriptions, 1);
  root.dispose();
  assert.equal(fixture.counts.cleanups, 3);
  assert.equal(fixture.counts.stops, 1);
});

test('root disposal releases the shared window subscription once and rejects late geometry updates', () => {
  const { root, fixture, fabric, clock, errors } = boot();
  root.dispose();
  root.dispose();
  const commits = fabric.commits;
  fixture.emit({ window: { width: 1, height: 2 }, screen: { width: 3, height: 4 } });
  fixture.report(5, 6);
  fixture.setLabel('late');
  fixture.setModal(true);
  clock.flushMicrotasks();
  assert.deepEqual(fabric.roots.get(1), []);
  assert.equal(fabric.commits, commits);
  assert.deepEqual(fixture.counts, { subscriptions: 1, stops: 1, mounts: 1, cleanups: 1 });
  assert.deepEqual(errors, []);
  assert.deepEqual(fixture.errors, []);
});
