import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot, type HostChild } from '@solidnative/platform/solid';
import { registerPlatformComponents } from '@solidnative/fabric';
import { indicatorFixture, keyboardProviderFixture } from './g5-shell-fixture.tsx';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function contents(node: FakeNode): string {
  return String(node.props['text'] ?? '') + node.children.map(contents).join('');
}

function boot(fixture: { Scene: () => HostChild }) {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.Scene);
  const all = () => flatten(fabric.roots.get(1) ?? []);
  const find = (id: string) => {
    const node = all().find((entry) => entry.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };
  return { root, fabric, clock, find, all };
}

test('compiled indicators preserve native platform names, mandatory Android props and all size modes', () => {
  for (const platform of ['ios', 'android'] as const) {
    registerPlatformComponents(platform);
    const fixture = indicatorFixture();
    const { root, find, clock } = boot(fixture);
    try {
      const initial = find('indicator');
      assert.equal(
        initial.viewName,
        platform === 'ios' ? 'ActivityIndicatorView' : 'AndroidProgressBar',
      );
      assert.equal(initial.props['styleAttr'], platform === 'android' ? 'Normal' : undefined);
      assert.equal(initial.props['indeterminate'], platform === 'android' ? true : undefined);
      assert.equal(initial.props['size'], 'small');
      assert.equal(initial.props['width'], 20);
      assert.equal(initial.props['height'], 20);
      assert.equal(initial.props['opacity'], 0.5);
      assert.equal(initial.props['marginTop'], 8);
      for (const [size, expected] of [
        ['large', 36],
        [64, 64],
        [0, 0],
        ['small', 20],
      ] as const) {
        fixture.setSize(size);
        clock.flushMicrotasks();
        assert.equal(find('indicator').props['width'], expected);
        assert.equal(find('indicator').props['height'], expected);
        assert.equal(find('indicator').props['size'], size === 'large' ? 'large' : 'small');
        assert.equal(find('indicator').tag, initial.tag);
      }
    } finally {
      root.dispose();
      registerPlatformComponents('ios');
    }
  }
});

test('indicator state, accessibility and styles update and clear without replacing its native node', () => {
  const fixture = indicatorFixture();
  const { root, find, fabric, clock } = boot(fixture);
  const initial = find('indicator');
  assert.equal(initial.props['animating'], true);
  assert.equal(initial.props['hidesWhenStopped'], true);
  assert.equal(initial.props['accessibilityRole'], 'progressbar');
  assert.equal(initial.props['accessibilityLabel'], 'Loading');
  assert.deepEqual(initial.props['accessibilityState'], { busy: true });
  assert.equal(initial.props['nativeID'], 'loading-indicator');
  assert.equal(initial.props['aria-label'], undefined);
  assert.equal(initial.props['role'], undefined);
  fixture.setAnimating(false);
  fixture.setHides(false);
  fixture.setColor('#ff0000');
  fixture.setLabel('Ready');
  fixture.setStyle([{ marginLeft: 7 }, { opacity: 1 }]);
  clock.flushMicrotasks();
  assert.equal(find('indicator').props['animating'], false);
  assert.equal(find('indicator').props['hidesWhenStopped'], false);
  assert.equal(find('indicator').props['color'], '#ff0000');
  assert.equal(find('indicator').props['accessibilityLabel'], 'Ready');
  assert.deepEqual(find('indicator').props['accessibilityState'], { busy: false });
  assert.equal(find('indicator').props['marginTop'] ?? undefined, undefined);
  assert.equal(find('indicator').props['marginLeft'], 7);
  assert.equal(find('indicator').props['width'], 20);
  fixture.setColor(undefined);
  fixture.setAnimating(undefined);
  fixture.setHides(undefined);
  fixture.setStyle(null);
  clock.flushMicrotasks();
  assert.equal(find('indicator').props['color'] ?? undefined, undefined);
  assert.equal(find('indicator').props['animating'], true);
  assert.equal(find('indicator').props['hidesWhenStopped'], true);
  assert.equal(find('indicator').props['opacity'] ?? undefined, undefined);
  assert.equal(find('indicator').tag, initial.tag);
  const commits = fabric.commits;
  fixture.setSize('small');
  clock.flushMicrotasks();
  assert.equal(fabric.commits, commits, 'equal native output does not commit');
  root.dispose();
});

test('indicator refs and event listeners follow conditional removal and root cleanup', () => {
  const fixture = indicatorFixture();
  const { root, find, fabric, clock, all } = boot(fixture);
  const stale = find('indicator');
  const ref = fixture.ref();
  assert.equal(ref.node, stale.instanceHandle);
  assert.equal(ref.isAttached(), true);
  const layout = { layout: { x: 1, y: 2, width: 20, height: 20 } };
  fabric.emit(stale, 'topLayout', layout);
  assert.deepEqual(fixture.layouts, [layout]);
  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.ok(!all().includes(stale));
  assert.equal(ref.isAttached(), false);
  assert.equal(stale.instanceHandle.listeners?.get('topLayout')?.size ?? 0, 0);
  fabric.emit(stale, 'topLayout', layout);
  assert.equal(fixture.layouts.length, 1);
  fixture.setVisible(true);
  clock.flushMicrotasks();
  assert.notEqual(find('indicator').tag, stale.tag);
  const remounted = find('indicator');
  root.dispose();
  root.dispose();
  fabric.emit(remounted, 'topLayout', layout);
  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.equal(fixture.layouts.length, 1);
  assert.deepEqual(fabric.roots.get(1), []);
});

test('keyboard controller is an isolated opt-in with nearest-scope precedence and no wrapper view', () => {
  for (const optIn of [false, true]) {
    const fixture = keyboardProviderFixture(optIn);
    const { root, find, all, clock } = boot(fixture);
    assert.equal(fixture.values.get('outside'), optIn);
    assert.equal(fixture.values.get('sibling'), optIn);
    assert.equal(fixture.values.get('inside'), true);
    assert.equal(fixture.values.get('inherited'), true);
    assert.equal(fixture.values.get('disabled'), false);
    assert.deepEqual(
      find('keyboard-shell').children.map((node) => node.props['testID']),
      ['outside', 'provider-child', 'sibling'],
    );
    assert.ok(all().every((node) => !node.viewName.includes('Keyboard')));
    const childTag = find('inside').tag;
    fixture.setLabel('updated');
    clock.flushMicrotasks();
    assert.equal(contents(find('inside')), 'updated');
    assert.equal(find('inside').tag, childTag);
    assert.equal(fixture.counts.mounts, 5);
    root.dispose();
    assert.deepEqual(fixture.counts, { mounts: 5, cleanups: 5 });
    assert.deepEqual(fixture.errors, []);
  }
});

test('keyboard capability is captured once per scope and rebuilt on remount with complete owner cleanup', () => {
  const fixture = keyboardProviderFixture();
  const { root, clock, find, fabric } = boot(fixture);
  const oldTag = find('inside').tag;
  fixture.setEnabled(false);
  clock.flushMicrotasks();
  assert.equal(fixture.values.get('inside'), true);
  assert.equal(find('inside').tag, oldTag);
  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.equal(fixture.counts.cleanups, 3);
  fixture.setVisible(true);
  clock.flushMicrotasks();
  assert.equal(fixture.values.get('inside'), false);
  assert.equal(fixture.values.get('inherited'), false);
  assert.equal(fixture.values.get('outside'), false);
  assert.notEqual(find('inside').tag, oldTag);
  root.dispose();
  root.dispose();
  assert.deepEqual(fixture.counts, { mounts: 8, cleanups: 8 });
  fixture.setLabel('after disposal');
  clock.flushMicrotasks();
  assert.deepEqual(fabric.roots.get(1), []);
  assert.deepEqual(fixture.errors, []);
});
