import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot, type HostChild } from '@solid-native/platform/solid';
import { registerPlatformComponents, type FabricNode } from '@solid-native/fabric';
import { safeAreaFixture, scrollFixture } from './g4-native-shell-fixture.tsx';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function boot(fixture: { Scene: () => HostChild }) {
  const commands: { name: string; args: readonly unknown[] }[] = [];
  const fabric = Object.assign(createFakeFabric(), {
    dispatchCommand(_node: FabricNode, name: string, args: readonly unknown[]) {
      commands.push({ name, args });
    },
  });
  const clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.Scene);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((entry) => entry.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };
  return { root, fabric, clock, commands, find };
}

const metrics = (top: number, bottom = 34, height = 874) => ({
  insets: { top, right: 0, bottom, left: 0 },
  frame: { x: 0, y: 0, width: 402, height },
});

test('compiled SafeAreaView registers the direct native host and replaces all edge modes', () => {
  const fixture = safeAreaFixture();
  const { root, find, clock } = boot(fixture);
  assert.equal(find('provider').viewName, 'RNCSafeAreaProvider');
  assert.equal(find('provider').props['flex'], 1);
  assert.equal(find('safe').viewName, 'RNCSafeAreaView');
  assert.deepEqual(find('safe').props['edges'], {
    top: 'additive',
    right: 'additive',
    bottom: 'additive',
    left: 'additive',
  });
  fixture.setEdges(['bottom']);
  fixture.setMode('margin');
  clock.flushMicrotasks();
  assert.deepEqual(find('safe').props['edges'], {
    top: 'off',
    right: 'off',
    bottom: 'additive',
    left: 'off',
  });
  assert.equal(find('safe').props['mode'], 'margin');
  fixture.setEdges({ top: 'maximum' });
  clock.flushMicrotasks();
  assert.deepEqual(find('safe').props['edges'], {
    top: 'maximum',
    right: 'off',
    bottom: 'off',
    left: 'off',
  });
  fixture.setEdges([]);
  clock.flushMicrotasks();
  assert.deepEqual(find('safe').props['edges'], {
    top: 'off',
    right: 'off',
    bottom: 'off',
    left: 'off',
  });
  root.dispose();
});

test('nested providers own local geometry and scoped CSS tokens without replacing root metrics', () => {
  const fixture = safeAreaFixture();
  const { root, find, clock, fabric } = boot(fixture);
  const rootArea = fixture.areas.get('outside')!;
  const localArea = fixture.areas.get('inner')!;
  assert.equal(fixture.areas.get('outer'), rootArea);
  assert.notEqual(localArea, rootArea);
  assert.equal(rootArea.known(), false);
  assert.deepEqual(localArea.insets(), { top: 0, right: 0, bottom: 0, left: 0 });
  const outerTag = find('outer').tag;
  const innerTag = find('inner').tag;
  fabric.emit(find('provider'), 'topInsetsChange', metrics(59));
  clock.flushMicrotasks();
  assert.deepEqual(rootArea.frame(), metrics(59).frame);
  assert.equal(rootArea.known(), true);
  assert.equal(find('outer').props['paddingTop'], 59);
  assert.equal(find('outer').props['marginBottom'], 34);
  assert.equal(find('inner').props['paddingTop'], 0);
  assert.equal(find('outside').props['paddingTop'], 7);
  assert.equal(find('provider').props['--safe-area-inset-top'], undefined);
  assert.equal(find('provider').props['reportInsets'], undefined);
  fabric.emit(find('nested'), 'topInsetsChange', metrics(12, 8, 437));
  clock.flushMicrotasks();
  assert.equal(localArea.insets().top, 12);
  assert.equal(localArea.frame()?.height, 437);
  assert.equal(find('inner').props['paddingTop'], 12);
  assert.equal(find('inner').props['marginBottom'], 8);
  assert.equal(rootArea.insets().top, 59);
  assert.equal(rootArea.frame()?.height, 874);
  fixture.setOpacity(0.5);
  clock.flushMicrotasks();
  assert.equal(find('provider').props['opacity'], 0.5);
  assert.equal(find('outer').tag, outerTag);
  assert.equal(find('inner').tag, innerTag);
  assert.equal(fixture.counts.mounts, 3);
  assert.deepEqual(fixture.events, [metrics(59)]);
  const before = fabric.commits;
  fabric.emit(find('provider'), 'topInsetsChange', metrics(59));
  clock.flushMicrotasks();
  assert.equal(fabric.commits, before, 'equal geometry does not commit an unchanged tree');
  root.dispose();
  assert.equal(fixture.counts.cleanups, 3);
  assert.equal(fixture.counts.stops, 1);
});

test('source updates reach root descendants and local provider disposal releases events and service lifetime', () => {
  const fixture = safeAreaFixture(true, metrics(20));
  const { root, find, clock, fabric } = boot(fixture);
  assert.equal(
    fixture.counts.subscriptions,
    1,
    'nested local providers do not subscribe the app source',
  );
  assert.equal(find('outer').props['paddingTop'], 20);
  fixture.emitSource(metrics(45));
  clock.flushMicrotasks();
  assert.equal(find('outer').props['paddingTop'], 45);
  const local = fixture.areas.get('inner')!;
  const staleNode = find('nested');
  fixture.setNested(false);
  clock.flushMicrotasks();
  assert.equal(fixture.counts.cleanups, 1);
  assert.equal(staleNode.instanceHandle.listeners?.get('topInsetsChange')?.size ?? 0, 0);
  local.report(metrics(99).insets, metrics(99).frame);
  fabric.emit(staleNode, 'topInsetsChange', metrics(99));
  assert.equal(local.known(), false);
  fixture.setNested(true);
  clock.flushMicrotasks();
  assert.notEqual(fixture.areas.get('inner'), local);
  assert.equal(fixture.counts.mounts, 4);
  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.equal(fixture.counts.stops, 0, 'root service outlives a removed provider');
  root.dispose();
  assert.equal(fixture.counts.stops, 1);
  const rootArea = fixture.areas.get('outside')!;
  fixture.emitSource(metrics(99));
  assert.equal(rootArea.insets().top, 45);
});

test('reportInsets chooses local versus root ownership at construction and never switches service identity', () => {
  for (const initial of [false, true]) {
    const fixture = safeAreaFixture(initial);
    const { root, find, fabric, clock } = boot(fixture);
    const outside = fixture.areas.get('outside')!;
    const own = fixture.areas.get('outer')!;
    assert.equal(own === outside, initial);
    fixture.setReport(!initial);
    fabric.emit(find('provider'), 'topInsetsChange', metrics(17));
    clock.flushMicrotasks();
    assert.equal(own.insets().top, 17);
    assert.equal(outside.known(), initial);
    assert.equal(find('outer').props['paddingTop'], 17);
    root.dispose();
  }
});

test('compiled ScrollView has stable noncollapsable content and reactive axis, bounce, style and native props', () => {
  const fixture = scrollFixture();
  const { root, find, clock } = boot(fixture);
  const initial = find('scroll');
  const content = initial.children[0]!;
  const childTag = find('scroll-child').tag;
  assert.equal(initial.viewName, 'ScrollView');
  assert.equal(initial.props['overflow'], 'scroll');
  assert.equal(initial.props['flexDirection'], 'column');
  assert.equal(initial.props['alwaysBounceHorizontal'], false);
  assert.equal(initial.props['alwaysBounceVertical'], true);
  assert.equal(initial.props['decelerationRate'], 0.998);
  assert.equal(initial.props['sendMomentumEvents'], true);
  assert.equal(initial.props['contentContainerStyle'], undefined);
  assert.equal(content.props['collapsable'], false);
  assert.equal(content.props['padding'], 12);
  fixture.setHorizontal(true);
  fixture.setRate('fast');
  clock.flushMicrotasks();
  assert.equal(find('scroll').props['flexDirection'], 'row');
  assert.equal(find('scroll').children[0]?.props['flexDirection'], 'row');
  assert.equal(find('scroll').props['alwaysBounceHorizontal'], true);
  assert.equal(find('scroll').props['alwaysBounceVertical'], false);
  assert.equal(find('scroll').props['decelerationRate'], 0.99);
  fixture.setContentStyle([{ flexDirection: 'column', gap: 4 }, { padding: 7 }]);
  fixture.setBounce(false);
  fixture.setRate(0.5);
  fixture.setEnabled(false);
  clock.flushMicrotasks();
  assert.equal(find('scroll').children[0]?.props['flexDirection'], 'column');
  assert.equal(find('scroll').children[0]?.props['padding'], 7);
  assert.equal(find('scroll').props['alwaysBounceHorizontal'], false);
  assert.equal(find('scroll').props['decelerationRate'], 0.5);
  assert.equal(find('scroll').props['scrollEnabled'], false);
  assert.equal(find('scroll').children[0]?.tag, content.tag);
  assert.equal(find('scroll-child').tag, childTag);
  assert.equal(fixture.counts.mounts, 1);
  fixture.setHorizontal(false);
  fixture.setContentStyle(null);
  clock.flushMicrotasks();
  assert.equal(find('scroll').children[0]?.props['flexDirection'] ?? undefined, undefined);
  assert.equal(find('scroll').children[0]?.props['padding'] ?? undefined, undefined);
  root.dispose();
  assert.equal(fixture.counts.cleanups, 1);
});

test('scroll events preserve native payloads; content size uses content layout and follows current handlers', () => {
  const fixture = scrollFixture();
  const { root, find, fabric, clock } = boot(fixture);
  const payload = {
    contentOffset: { x: 3, y: 40 },
    contentSize: { width: 200, height: 600 },
    layoutMeasurement: { width: 100, height: 300 },
    contentInset: { top: 4, right: 0, bottom: 8, left: 0 },
    zoomScale: 1,
    velocity: { x: 0, y: 5 },
  };
  for (const name of [
    'Scroll',
    'ScrollBeginDrag',
    'ScrollEndDrag',
    'MomentumScrollBegin',
    'MomentumScrollEnd',
    'ScrollToTop',
  ])
    fabric.emit(find('scroll'), `top${name}`, payload);
  assert.deepEqual(
    fixture.events.map(({ name }) => name),
    ['old', 'begin', 'end', 'momentum-begin', 'momentum-end', 'top'],
  );
  for (const { event } of fixture.events) assert.deepEqual(event.nativeEvent, payload);
  fixture.replaceHandler();
  clock.flushMicrotasks();
  fabric.emit(find('scroll'), 'topScroll', payload);
  assert.equal(fixture.events.at(-1)?.name, 'new');
  const content = find('scroll').children[0]!;
  fabric.emit(content, 'topLayout', { layout: { x: 1, y: 2, width: 200, height: 600 } });
  assert.deepEqual(fixture.sizes, [{ width: 200, height: 600 }]);
  fixture.setEnabled(false);
  clock.flushMicrotasks();
  fabric.emit(content, 'topLayout', { layout: { width: 300, height: 700 } });
  assert.equal(fixture.sizes.length, 1);
  assert.equal(content.instanceHandle.listeners?.get('topLayout')?.size ?? 0, 0);
  const stale = find('scroll');
  root.dispose();
  fabric.emit(stale, 'topScroll', payload);
  assert.equal(fixture.events.length, 7);
});

test('scroll ref commands wait for commit, reject detached ancestors, recover after reattachment and cancel on disposal', () => {
  const fixture = scrollFixture();
  const { root, find, clock, commands } = boot(fixture);
  const ref = fixture.ref();
  ref.scrollTo({ y: 123 });
  ref.scrollToEnd();
  ref.flashScrollIndicators();
  ref.zoomToRect({ x: 1, y: 2, width: 3, height: 4 }, false);
  assert.equal(commands.length, 0);
  clock.flushMicrotasks();
  assert.deepEqual(commands, [
    { name: 'scrollTo', args: [0, 123, true] },
    { name: 'scrollToEnd', args: [true] },
    { name: 'flashScrollIndicators', args: [] },
    { name: 'zoomToRect', args: [{ x: 1, y: 2, width: 3, height: 4 }, false] },
  ]);
  const ancestor = find('ancestor').instanceHandle;
  const container = ancestor.parent!;
  ref.scrollTo({ x: 9, animated: false });
  root.engine.removeChild(container, ancestor);
  assert.equal(ref.isAttached(), false);
  clock.flushMicrotasks();
  ref.scrollToEnd({ animated: false });
  clock.flushMicrotasks();
  assert.equal(commands.length, 4);
  root.engine.insertBefore(container, ancestor, null);
  clock.flushMicrotasks();
  assert.equal(ref.isAttached(), true);
  ref.scrollTo({ x: 9, animated: false });
  clock.flushMicrotasks();
  assert.deepEqual(commands.at(-1), { name: 'scrollTo', args: [9, 0, false] });
  ref.scrollToEnd();
  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.equal(commands.length, 5);
  assert.equal(ref.isAttached(), false);
  ref.scrollTo({});
  root.dispose();
  clock.flushMicrotasks();
  assert.equal(commands.length, 5);
});

test('named scroll deceleration rates match each native platform', () => {
  for (const [platform, normal, fast] of [
    ['ios', 0.998, 0.99],
    ['android', 0.985, 0.9],
  ] as const) {
    registerPlatformComponents(platform);
    const fixture = scrollFixture();
    const { root, find, clock } = boot(fixture);
    try {
      assert.equal(find('scroll').props['decelerationRate'], normal);
      fixture.setRate('fast');
      clock.flushMicrotasks();
      assert.equal(find('scroll').props['decelerationRate'], fast);
    } finally {
      root.dispose();
      registerPlatformComponents('ios');
    }
  }
});
