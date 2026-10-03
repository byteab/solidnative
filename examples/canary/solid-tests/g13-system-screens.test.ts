import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ColorScheme,
  Direction,
  Accessibility,
  provideService,
  type ServiceBinding,
} from '@solidnative/device/solid';
import { registerExpoUiViews } from '@solidnative/expo/views';
import { Brightness } from '@solidnative/expo/solid/brightness';
import { settingsRoutes } from '../src/app/settings/routes.solid.ts';
import { walletRoutes } from '../src/app/wallet/routes.solid.ts';
import { worldRoutes } from '../src/app/world/routes.solid.ts';
import { stressRoutes } from '../src/app/stress/routes.solid.ts';
import { regressionRoutes } from '../src/app/navigation/regressions-routes.solid.ts';
import { systemFixture as consumerFixture } from './g13-system-fixture.tsx';
import { bootConsumer, flatten } from './consumer-harness.ts';
import type { FakeNode } from '../../../packages/platform/solid-tests/fake-fabric.ts';
const routes = [
  ...settingsRoutes,
  ...walletRoutes,
  ...worldRoutes,
  ...stressRoutes,
  ...regressionRoutes,
  { path: 'cover', component: () => null },
];
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
      provideService(Brightness.SOURCE, () => null),
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
function label(h: ReturnType<typeof bootConsumer>, name: string) {
  return h.nodes().find((node) => node.props['accessibilityLabel'] === name);
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
  test(`actual ${platform} settings retain grouped rows/search/service across routes and scheme/brightness/native controls`, async (t) => {
    const asked: (string | null)[] = [],
      levels: number[] = [],
      restored: string[] = [];
    const { fixture, h, nav } = boot(platform, [
      provideService(ColorScheme.SOURCE, () => ({
        current: () => 'light',
        subscribe: () => () => {},
        set: (scheme) => {
          asked.push(scheme);
        },
      })),
      provideService(Brightness.SOURCE, () => ({
        get: async () => 0.4,
        set: async (level) => {
          levels.push(level);
        },
        restore: async () => {
          restored.push('restore');
        },
      })),
    ]);
    t.after(() => h.root.dispose());
    await nav.reset('/settings');
    h.finish();
    assert.equal(classes(h, 'tile').length, 12);
    assert.equal(classes(h, 'avatar').length, 1);
    assert.ok(label(h, 'Wi-Fi, Morgan Home'));
    touch(h, label(h, 'Airplane Mode'));
    assert.ok(label(h, 'Wi-Fi, Off'));
    assert.deepEqual(label(h, 'Airplane Mode')!.props['accessibilityState'], { checked: true });
    const search =
      h.nodes().find((node) => node.instanceHandle.name === 'native-search-bar') ??
      h.nodes().find((node) => node.viewName === 'RNSSearchBar');
    assert.ok(search);
    h.fabric.emit(search, 'topChangeText', { text: 'dark mode' });
    h.clock.flushMicrotasks();
    assert.equal(classes(h, 'tile').length, 1);
    assert.match(h.renderedText(), /Display & Brightness/);
    h.fabric.emit(search, 'topChangeText', { text: 'nonesuch' });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /No results for “nonesuch”/);
    await nav.push('/settings/wifi');
    h.finish();
    touch(h, label(h, 'Cafe Nero Guest, 2 bars'));
    assert.ok(label(h, 'Cafe Nero Guest, connected'));
    const wifi = label(h, 'Wi-Fi')!;
    h.fabric.emit(wifi, 'topChange', { value: false });
    h.clock.flushMicrotasks();
    assert.equal(classes(h, 'bars').length, 0);
    await nav.push('/settings/display');
    h.finish();
    touch(h, label(h, 'Dark'));
    assert.deepEqual(asked, ['dark']);
    h.fabric.emit(label(h, 'Automatic')!, 'topChange', { value: true });
    h.clock.flushMicrotasks();
    assert.deepEqual(asked, ['dark', null]);
    const sliders = h.nodes().filter((node) => node.instanceHandle.name === 'ui-slider');
    assert.equal(sliders.length, 2);
    h.fabric.emit(sliders[0]!, 'topValueChanged', { value: 0.75 });
    h.fabric.emit(sliders[0]!, 'topValueChanged', { value: 0.6 });
    h.fabric.emit(sliders[1]!, 'topValueChanged', { value: 6 });
    h.fabric.emit(label(h, 'Bold Text')!, 'topChange', { value: true });
    h.clock.flushMicrotasks();
    assert.equal(classes(h, 'preview')[0]!.props['fontSize'], 24);
    assert.equal(classes(h, 'preview')[0]!.props['fontWeight'], '700');
    await h.waitFor(() => levels.includes(0.6));
    assert.equal(restored.length, 0);
    await nav.back();
    h.finish();
    await h.waitFor(() => restored.length === 1);
    await nav.reset('/settings/general');
    h.finish();
    assert.ok(label(h, 'Available, 131.4 GB'));
    assert.equal(classes(h, 'row').length, 7);
    await nav.reset('/settings/privacy');
    h.finish();
    assert.match(h.renderedText(), /Privacy & SecurityNothing to set here in the canary\./);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} wallet retains all cards/activity, currency/chart/reveal/paging and sticky hero structure`, async (t) => {
    const { fixture, h, nav } = boot(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/wallet');
    h.finish();
    assert.equal(classes(h, 'card').length, 3);
    assert.equal(classes(h, 'row').length, 11);
    assert.equal(classes(h, 'column').length, 7);
    assert.equal(classes(h, 'legend-row').length, 4);
    assert.equal((h.renderedText().match(/£11,093\.11/g) ?? []).length, 2);
    touch(h, label(h, 'EUR'));
    assert.equal((h.renderedText().match(/€12,978\.94/g) ?? []).length, 2);
    assert.ok(label(h, 'Borough Market, -€21.53'));
    touch(h, label(h, 'Show card number'));
    assert.match(h.renderedText(), /4000 1234 5678 4821/);
    touch(h, label(h, 'Hide card number'));
    assert.doesNotMatch(h.renderedText(), /4000 1234/);
    touch(h, classes(h, 'column')[5]);
    assert.match(text(classes(h, 'panel-note')[0]!), /€7\.60$/);
    const cards = classes(h, 'cards').find((node) => node.instanceHandle.name === 'scroll-view')!;
    h.fabric.emit(cards, 'topMomentumScrollEnd', { contentOffset: { x: 628, y: 0 } });
    h.clock.flushMicrotasks();
    assert.equal(text(classes(h, 'compact-title')[0]!), 'Saver');
    await nav.push('/cover');
    h.finish();
    await nav.back();
    h.finish();
    assert.ok(label(h, 'EUR')!.props['accessibilityState']);
    assert.equal(text(classes(h, 'compact-title')[0]!), 'Saver');
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} world retains seven locale cards, six scripts, RTL, plural steps and screen-reader actions`, async (t) => {
    const spoken: string[] = [];
    const { fixture, h, nav } = boot(platform, [
      provideService(Accessibility.SOURCE, () => ({
        current: () => ({
          screenReader: false,
          reduceMotion: false,
          boldText: false,
          fontScale: 1,
        }),
        subscribe: () => () => {},
        announce: (message) => {
          spoken.push(message);
        },
      })),
    ]);
    t.after(() => h.root.dispose());
    await nav.reset('/world');
    h.finish();
    assert.equal(classes(h, 'locale').length, 7);
    assert.equal(classes(h, 'script').length, 6);
    assert.equal(classes(h, 'rtl').length, 2);
    assert.ok(classes(h, 'rtl').every((node) => node.props['direction'] === 'rtl'));
    assert.match(h.renderedText(), /٣ رسائل جديدة/);
    touch(h, label(h, 'More'));
    assert.match(h.renderedText(), /4 new messages/);
    h.fabric.emit(label(h, '4 messages')!, 'topAccessibilityAction', { actionName: 'decrement' });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /3 new messages/);
    touch(h, label(h, 'Save draft'));
    assert.equal(classes(h, 'status')[0]!.props['accessibilityLiveRegion'], 'polite');
    assert.deepEqual(spoken, ['Saved once']);
    touch(h, label(h, 'Save draft'));
    assert.deepEqual(spoken, ['Saved once', 'Saved 2 times']);
    h.fabric.emit(
      label(h, 'Invoice from Kiln, Not flagged, in the inbox')!,
      'topAccessibilityAction',
      { actionName: 'flag' },
    );
    h.clock.flushMicrotasks();
    h.fabric.emit(label(h, 'Invoice from Kiln, Flagged, in the inbox')!, 'topAccessibilityAction', {
      actionName: 'archive',
    });
    h.clock.flushMicrotasks();
    assert.ok(label(h, 'Invoice from Kiln, Flagged, archived'));
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} regression routes preserve conditional headers, deep detail stacks, modal inheritance and failed mount cleanup`, async (t) => {
    const { h, nav } = boot(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/regressions');
    h.finish();
    assert.equal(classes(h, 'card').length, 9);
    touch(h, id(h, 'open-header'));
    await h.waitFor(() => !!id(h, 'toggle-header'));
    h.finish();
    touch(h, id(h, 'toggle-header'));
    assert.equal(
      h
        .nodes()
        .filter(
          (node) =>
            node.viewName === 'RNSScreenStackHeaderConfig' &&
            node.props['title'] === 'Header shown',
        ).length,
      0,
    );
    touch(h, id(h, 'toggle-header'));
    assert.equal(
      h
        .nodes()
        .filter(
          (node) =>
            node.viewName === 'RNSScreenStackHeaderConfig' &&
            node.props['title'] === 'Header shown',
        ).length,
      1,
    );
    await nav.reset('/regressions/item/8?source=deep');
    h.finish();
    assert.match(h.renderedText(), /Item 8/);
    touch(h, id(h, 'next-item'));
    await h.waitFor(() => h.renderedText().includes('Item 9'));
    h.finish();
    await nav.back();
    h.finish();
    assert.match(h.renderedText(), /Item 8/);
    await nav.reset('/regressions');
    h.finish();
    touch(h, id(h, 'open-modal'));
    await h.waitFor(() => !!id(h, 'modal-push'));
    h.finish();
    touch(h, id(h, 'modal-push'));
    await h.waitFor(() => h.renderedText().includes('Item 1'));
    h.finish();
    assert.equal(nav.entries().at(-1)?.owner.node.props['stackPresentation'], 'modal');
    await nav.back();
    h.finish();
    assert.ok(id(h, 'modal-close'));
    await nav.reset('/regressions');
    h.finish();
    const intervals = new Set<ReturnType<typeof setInterval>>();
    const originalSet = globalThis.setInterval,
      originalClear = globalThis.clearInterval;
    t.mock.method(globalThis, 'setInterval', ((...args: Parameters<typeof setInterval>) => {
      const handle = originalSet(...args);
      intervals.add(handle);
      return handle;
    }) as typeof setInterval);
    t.mock.method(globalThis, 'clearInterval', ((handle: ReturnType<typeof setInterval>) => {
      intervals.delete(handle);
      originalClear(handle);
    }) as typeof clearInterval);
    touch(h, id(h, 'open-broken'));
    await h.waitFor(() => h.renderedText().includes('Failures: 1'));
    assert.equal(intervals.size, 0);
    assert.equal(nav.entries().length, 1);
    assert.ok(id(h, 'open-header'));
  });
  test(`actual ${platform} regression hidden modal/defer/date/RTL and static content preserve behavior`, async (t) => {
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
    await nav.reset('/regressions/dates');
    h.finish();
    assert.equal(text(id(h, 'date-utc')!), 'UTC 14:30');
    assert.equal(text(id(h, 'date-five')!), '+0500 19:30');
    assert.equal(text(id(h, 'date-est')!), 'EST 09:30');
    assert.equal(text(id(h, 'date-intl')!), 'Intl Asia/Tokyo 23:30');
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
    await nav.reset('/regressions/text');
    h.finish();
    assert.match(h.renderedText(), /This text never changes/);
    assert.deepEqual(fixture.errors, []);
  });
}
