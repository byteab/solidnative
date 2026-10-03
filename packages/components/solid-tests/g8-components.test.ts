import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solidnative/platform/solid';
import { registerPlatformComponents } from '@solidnative/fabric';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { componentsFixture } from './g8-components-fixture.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((n) => [n, ...flatten(n.children)]);
function boot(platform: 'ios' | 'android' = 'ios') {
  registerPlatformComponents(platform);
  const fixture = componentsFixture(),
    fabric = createFakeFabric(),
    clock = createClock();
  let now = 0;
  const root = createNativeRoot({ fabric, clock, rootTag: 1, engineOptions: { now: () => now } });
  root.render(fixture.Scene);
  const all = () => flatten(fabric.roots.get(1) ?? []);
  const find = (id: string) => {
    const n = all().find((n) => n.props['testID'] === id);
    assert.ok(n, id);
    return n;
  };
  const touch = (id: string, type: string) =>
    fabric.emit(find(id), type, {
      identifier: 1,
      pageX: 1,
      pageY: 1,
      changedTouches: [{ identifier: 1, pageX: 1, pageY: 1 }],
      touches: type === 'topTouchEnd' ? [] : [{ identifier: 1, pageX: 1, pageY: 1 }],
    });
  const advance = (time: number) => {
    now = time;
    clock.frame(time);
    clock.flushMicrotasks();
  };
  return { ...fixture, root, fabric, clock, find, all, touch, advance };
}
test('compiled image API retains source blending, source dimensions, headers, alt mapping and events', () => {
  const app = boot();
  const img = app.find('image');
  assert.equal(img.props['width'], 30);
  assert.equal(img.props['height'], 40);
  assert.equal(img.props['accessibilityLabel'], 'description');
  assert.equal(img.props['accessible'], true);
  assert.deepEqual((img.props['source'] as object[])[0], {
    uri: 'local',
    width: 30,
    height: 40,
    headers: {
      Existing: 'yes',
      'Access-Control-Allow-Credentials': 'true',
      'Referrer-Policy': 'no-referrer',
    },
  });
  assert.equal(img.props['alt'], undefined);
  assert.deepEqual(
    (app.find('sources').props['source'] as { uri: string }[]).map((s) => s.uri),
    ['first', 'hi', 'bad'],
  );
  app.fabric.emit(img, 'topLoad', {});
  assert.deepEqual(app.events, ['load']);
  app.setAlt(undefined);
  app.clock.flushMicrotasks();
  assert.equal(app.find('image').props['accessible'], false);
  assert.equal(app.find('image').props['accessibilityLabel'] ?? undefined, undefined);
  app.root.dispose();
});
test('image background preserves image-first child order, full fill, reactive dimensions and separate image styling', () => {
  const app = boot();
  const back = app.find('background');
  assert.equal(back.children[0]!.viewName, 'Image');
  assert.equal(back.children[1]!.props['testID'], 'front');
  assert.equal(back.children[0]!.props['width'], 90);
  assert.equal(back.children[0]!.props['height'], 70);
  assert.equal(back.children[0]!.props['opacity'], 0.5);
  app.setSize(120);
  app.clock.flushMicrotasks();
  assert.equal(app.find('background').children[0]!.props['width'], 120);
  app.root.dispose();
});
test('modal owns a full-bleed RTL-aware backdrop, default visibility, events and iOS dismissal retention', () => {
  const app = boot();
  assert.equal(app.find('modal').props['visible'], true);
  let container = app.find('modal').children[0]!;
  assert.equal(container.props['left'], 0);
  assert.equal(container.props['backgroundColor'], 'white');
  assert.equal(container.props['collapsable'], false);
  app.setTransparent(true);
  app.setRtl(true);
  app.clock.flushMicrotasks();
  assert.equal(app.find('modal').props['presentationStyle'], 'overFullScreen');
  container = app.find('modal').children[0]!;
  assert.equal(container.props['right'], 0);
  assert.equal(container.props['left'] ?? undefined, undefined);
  assert.equal(container.props['backgroundColor'], 'transparent');
  app.fabric.emit(app.find('modal'), 'topRequestClose', {});
  assert.deepEqual(app.events, ['close']);
  app.setVisible(false);
  app.clock.flushMicrotasks();
  assert.equal(app.find('modal').props['visible'], false);
  app.fabric.emit(app.find('modal'), 'topDismiss', {});
  app.clock.flushMicrotasks();
  assert.ok(!app.all().some((n) => n.props['testID'] === 'modal'));
  app.root.dispose();
});
test('input accessory host is absolute and Android maps it to the ordinary view', () => {
  for (const platform of ['ios', 'android'] as const) {
    const app = boot(platform);
    const n = app.find('accessory');
    assert.equal(n.viewName, platform === 'ios' ? 'InputAccessoryView' : 'View');
    assert.equal(n.props['position'], 'absolute');
    assert.equal(n.props['nativeID'], 'toolbar');
    assert.equal(app.find('accessory-input').props['inputAccessoryViewID'], 'toolbar');
    app.root.dispose();
  }
});
test('touchable opacity preserves caller/class opacity and actual asymmetric engine transitions', () => {
  const app = boot();
  assert.equal(app.find('class-touch').props['opacity'], 0.6);
  assert.equal(app.find('touch').props['opacity'], 0.7);
  app.touch('touch', 'topTouchStart');
  app.clock.flushMicrotasks();
  app.advance(150);
  assert.equal(app.find('touch').props['opacity'], 0.2);
  app.touch('touch', 'topTouchEnd');
  app.clock.flushMicrotasks();
  app.advance(400);
  assert.equal(app.find('touch').props['opacity'], 0.7);
  assert.deepEqual(app.events, ['press']);
  app.setOpacity(0.8);
  app.clock.flushMicrotasks();
  app.advance(650);
  assert.equal(app.find('touch').props['opacity'], 0.8);
  app.root.dispose();
  assert.equal(app.clock.frames.size, 0);
});
test('keyboard avoidance uses measured overlap and configures the keyboard curve before layout', () => {
  const app = boot();
  app.fabric.emit(app.find('avoid'), 'topLayout', {
    layout: { x: 0, y: 100, width: 200, height: 300 },
  });
  app.setMetrics({ height: 200, screenY: 350, duration: 250, easing: 'keyboard' });
  app.clock.flushMicrotasks();
  assert.equal(app.find('avoid').props['paddingBottom'], 50);
  assert.deepEqual(app.animations, [
    { duration: 250, easing: 'keyboard', appear: 'none', leave: 'none' },
  ]);
  app.setMetrics({ height: 0 });
  app.clock.flushMicrotasks();
  assert.equal(app.find('avoid').props['paddingBottom'] ?? undefined, undefined);
  app.root.dispose();
});
