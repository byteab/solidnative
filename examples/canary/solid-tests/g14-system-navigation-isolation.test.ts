import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Direction, provideService, type ServiceBinding } from '@solidnative/device/solid';
import { registerExpoUiViews } from '@solidnative/expo/views';
import { regressionRoutes } from '../src/app/navigation/regressions-routes.solid.ts';
import { systemFixture as consumerFixture } from './g13-system-fixture.tsx';
import { bootConsumer, flatten } from './consumer-harness.ts';
import type { FakeNode } from '../../../packages/platform/solid-tests/fake-fabric.ts';
const routes = [...regressionRoutes, { path: 'cover', component: () => null }];
const text = (node: FakeNode) =>
  flatten([node])
    .map((child) => child.props['text'] ?? '')
    .join('');
function boot(platform: 'ios' | 'android', services: readonly ServiceBinding[] = []) {
  registerExpoUiViews(platform);
  const fixture = consumerFixture(
    () => routes,
    [
      provideService(Direction.SOURCE, () => ({ current: () => 'ltr', subscribe: () => () => {} })),
      ...services,
    ],
  );
  return { fixture, h: bootConsumer(fixture, platform), nav: fixture.navigation() };
}
function touch(h: ReturnType<typeof bootConsumer>, node: FakeNode | undefined) {
  assert.ok(node);
  for (const event of ['topTouchStart', 'topTouchEnd']) {
    const point = { identifier: 1, pageX: 1, pageY: 1 };
    h.fabric.emit(node, event, {
      ...point,
      changedTouches: [point],
      touches: event === 'topTouchEnd' ? [] : [point],
    });
  }
  h.clock.flushMicrotasks();
}
function id(h: ReturnType<typeof bootConsumer>, name: string) {
  return h.nodes().find((node) => node.props['testID'] === name);
}
function classes(h: ReturnType<typeof bootConsumer>, name: string) {
  return h.nodes().filter((node) => node.instanceHandle.classes?.has(name));
}
// Fabric textAlign is relative to layout direction (see the inherited text-direction suite).
// Compare the original screen's physical alignment, while also requiring the native RTL props.
function physicalTextAlign(node: FakeNode): unknown {
  const align = node.props['textAlign'];
  if (node.props['direction'] !== 'rtl') return align;
  return align === 'left' ? 'right' : align === 'right' ? 'left' : align;
}
for (const platform of ['ios', 'android'] as const) {
  for (const [path, expected] of [
    ['/regressions', 'Nothing is pushed. Failures: 0'],
    ['/regressions/header', 'Hide the header'],
    ['/regressions/item/8', 'Item 8'],
    ['/regressions/modal', 'A modal with no stack'],
    ['/regressions/text', 'This text never changes'],
    ['/regressions/hidden-modal', 'Taps: 0'],
    ['/regressions/defer', 'Waiting for a press'],
    ['/regressions/dates', 'UTC 14:30'],
    ['/regressions/rtl', 'latin, no alignment'],
  ] as const) {
    test(`isolated ${platform} ${path} mounts and releases its actual screen`, async (t) => {
      const { fixture, h, nav } = boot(platform);
      t.after(() => h.root.dispose());
      assert.equal(await nav.reset(path), true);
      h.finish();
      assert.ok(h.renderedText().includes(expected));
      assert.deepEqual(fixture.errors, []);
      h.root.dispose();
      assert.equal(h.nodes().length, 0);
    });
  }
}

for (const platform of ['ios', 'android'] as const) {
  test(`isolated ${platform} hidden-modal interaction assertions`, async (t) => {
    const { fixture, h, nav } = boot(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/regressions/hidden-modal');
    h.finish();
    touch(h, id(h, 'hidden-modal-tap'));
    assert.match(h.renderedText(), /Taps: 1/);
    const modal = () => h.nodes().find((node) => node.instanceHandle.name === 'modal')!;
    assert.equal(modal(), undefined);
    touch(h, id(h, 'hidden-modal-show'));
    assert.equal(modal().props['visible'], true);
    const shown = modal();
    touch(h, id(h, 'hidden-modal-close'));
    if (platform === 'ios') {
      assert.ok(modal(), 'iOS retains its native host until dismissal completes');
      assert.equal(modal().props['visible'], false);
    }
    h.fabric.emit(shown, 'topDismiss');
    h.clock.flushMicrotasks();
    assert.equal(modal(), undefined);
    assert.match(h.renderedText(), /Dismissals: 1/);
    assert.deepEqual(fixture.errors, []);
  });
  test(`isolated ${platform} defer interaction assertions`, async (t) => {
    const { fixture, h, nav } = boot(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/regressions/defer');
    h.finish();
    assert.ok(!id(h, 'defer-interaction'));
    assert.ok(!id(h, 'defer-viewport'));
    touch(h, id(h, 'defer-press'));
    assert.ok(id(h, 'defer-interaction'));
    const hover = classes(h, 'hint').find((node) => text(node) === 'Hover or press here')!;
    h.fabric.emit(hover, 'topPointerEnter');
    h.clock.flushMicrotasks();
    assert.ok(id(h, 'defer-hover'));
    const scroll = id(h, 'defer-scroll')!;
    const placeholder = classes(h, 'hint').find(
      (node) => text(node) === 'Scrolled into view loads this',
    )!;
    const target = h
      .nodes()
      .find((node) => node.children.some((child) => child.tag === placeholder.tag))!;
    h.fabric.emit(scroll, 'topLayout', { layout: { x: 0, y: 0, width: 402, height: 800 } });
    h.fabric.emit(target, 'topLayout', { layout: { x: 0, y: 1800, width: 300, height: 30 } });
    h.clock.flushMicrotasks();
    assert.ok(!id(h, 'defer-viewport'));
    h.fabric.emit(scroll, 'topScroll', {
      contentOffset: { x: 0, y: 1100 },
      layoutMeasurement: { width: 402, height: 800 },
    });
    h.clock.flushMicrotasks();
    assert.ok(id(h, 'defer-viewport'));
    assert.deepEqual(fixture.errors, []);
  });
  test(`isolated ${platform} dates interaction assertions`, async (t) => {
    const { fixture, h, nav } = boot(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/regressions/dates');
    h.finish();
    assert.equal(text(id(h, 'date-utc')!), 'UTC 14:30');
    assert.equal(text(id(h, 'date-five')!), '+0500 19:30');
    assert.equal(text(id(h, 'date-est')!), 'EST 09:30');
    assert.equal(text(id(h, 'date-intl')!), 'Intl Asia/Tokyo 23:30');
    assert.deepEqual(fixture.errors, []);
  });
  test(`isolated ${platform} rtl interaction assertions`, async (t) => {
    const { fixture, h, nav } = boot(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/regressions/rtl');
    h.finish();
    for (const name of ['rtl-start', 'rtl-end', 'rtl-left']) {
      assert.equal(id(h, name)!.props['direction'], 'rtl');
      assert.equal(id(h, name)!.props['writingDirection'], 'rtl');
    }
    assert.equal(physicalTextAlign(id(h, 'rtl-start')!), 'right');
    assert.equal(physicalTextAlign(id(h, 'rtl-end')!), 'left');
    assert.equal(physicalTextAlign(id(h, 'rtl-left')!), 'left');
    assert.equal(physicalTextAlign(id(h, 'ltr-end')!), 'right');
    assert.deepEqual(fixture.errors, []);
  });
  test(`isolated ${platform} text interaction assertions`, async (t) => {
    const { fixture, h, nav } = boot(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/regressions/text');
    h.finish();
    assert.match(h.renderedText(), /This text never changes/);
    assert.deepEqual(fixture.errors, []);
  });
}

for (const stage of ['tap', 'show', 'close', 'dismiss'] as const) {
  test(`isolated modal ${stage} boundary`, async (t) => {
    const { h, nav } = boot('ios');
    t.after(() => h.root.dispose());
    await nav.reset('/regressions/hidden-modal');
    h.finish();
    touch(h, id(h, 'hidden-modal-tap'));
    assert.match(h.renderedText(), /Taps: 1/);
    if (stage === 'tap') return;
    touch(h, id(h, 'hidden-modal-show'));
    const modal = h.nodes().find((node) => node.instanceHandle.name === 'modal');
    assert.ok(modal);
    assert.equal(modal.props['visible'], true);
    if (stage === 'show') return;
    touch(h, id(h, 'hidden-modal-close'));
    const closing = h.nodes().find((node) => node.instanceHandle.name === 'modal');
    assert.ok(closing);
    assert.equal(closing.props['visible'], false);
    if (stage === 'close') return;
    h.fabric.emit(modal, 'topDismiss');
    h.clock.flushMicrotasks();
    assert.equal(
      h.nodes().find((node) => node.instanceHandle.name === 'modal'),
      undefined,
    );
    assert.match(h.renderedText(), /Dismissals: 1/);
  });
}
