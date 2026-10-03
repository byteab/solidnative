import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solid-native/platform/solid';
import { registerPlatformComponents } from '@solid-native/fabric';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { canaryStyles } from '../src/app/global-styles.solid.ts';
import { features } from '../src/app/home/home-features.ts';
import { palette } from '../src/app/palette-values.ts';
import { shellFixture } from './shell-fixture.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

test('actual canary App/Home/ToastHost compose, preserve every feature and clean as one root', async (t) => {
  registerPlatformComponents('ios');
  const fixture = shellFixture();
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({
    fabric,
    clock,
    rootTag: 1,
    engineOptions: {
      globalStyles: canaryStyles({ rules: [] }),
      onError: (error) => fixture.errors.push(error),
    },
  });
  t.after(() => root.dispose());
  root.render(fixture.Scene);
  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  const find = (name: string) => {
    const node = nodes().find((node) => node.viewName === name);
    assert.ok(node, name);
    return node;
  };
  const finish = () => {
    clock.flushMicrotasks();
    fabric.emit(find('RNSScreenStack'), 'topFinishTransitioning');
    clock.flushMicrotasks();
  };
  assert.equal(await fixture.navigation().reset('/'), true);
  finish();
  assert.equal(features.length, 55);
  const text = JSON.stringify(nodes().map((node) => node.props));
  for (const feature of features) {
    assert.ok(text.includes(feature.title), feature.title);
    assert.ok(text.includes(feature.blurb), feature.blurb);
  }
  assert.equal(find('RNSScreenStackHeaderConfig').props['title'], 'Solid Native');
  assert.equal(find('RNSScreenStackHeaderConfig').props['backgroundColor'], palette.light.screen);
  fixture.theme('dark');
  clock.flushMicrotasks();
  assert.equal(fixture.status.at(-1), 'light');
  assert.equal(find('RNSScreenStackHeaderConfig').props['backgroundColor'], palette.dark.screen);
  const homeTag = find('RNSScreen').tag;
  const taskManager = nodes().find(
    (node) =>
      node.instanceHandle.name === 'pressable' &&
      JSON.stringify(flatten(node.children).map((child) => child.props)).includes('Task manager'),
  );
  assert.ok(taskManager);
  for (const type of ['topTouchStart', 'topTouchEnd']) {
    const touch = { identifier: 1, pageX: 1, pageY: 1 };
    fabric.emit(taskManager, type, {
      ...touch,
      changedTouches: [touch],
      touches: type === 'topTouchEnd' ? [] : [touch],
    });
  }
  for (let turn = 0; turn < 20 && fixture.navigation().pending(); turn++) await Promise.resolve();
  assert.equal(fixture.navigation().current()?.route.pathname, '/projects');
  finish();
  assert.equal(await fixture.navigation().pop(), true);
  finish();
  assert.equal(find('RNSScreen').tag, homeTag);
  fixture.toasts().show('Saved above the sheet');
  clock.flushMicrotasks();
  const overlay = find('RNSFullWindowOverlay');
  assert.equal(overlay.props['width'], 402);
  assert.equal(overlay.props['height'], 874);
  assert.deepEqual(fixture.announcements, ['Saved above the sheet']);
  assert.ok(
    flatten([overlay]).some((node) => node.props['accessibilityLabel'] === 'Saved above the sheet'),
  );
  let complete!: () => void;
  const work = fixture.toasts().while(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  clock.flushMicrotasks();
  assert.ok(nodes().some((node) => node.props['accessibilityLabel'] === 'Loading'));
  find('ActivityIndicatorView');
  complete();
  await work;
  clock.flushMicrotasks();
  assert.ok(!nodes().some((node) => node.props['accessibilityLabel'] === 'Loading'));
  root.dispose();
  root.dispose();
  fixture.toasts().show('Late message');
  fixture.theme('light');
  clock.flushMicrotasks();
  assert.deepEqual(fabric.roots.get(1), []);
  assert.deepEqual(fixture.announcements, ['Saved above the sheet']);
  assert.deepEqual(fixture.errors, []);
  assert.deepEqual(fixture.cleanups.sort(), ['accessibility', 'safe-area', 'screen', 'theme']);
});
