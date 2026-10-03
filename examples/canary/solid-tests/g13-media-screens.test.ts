import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignal } from 'solid-js';
import { provideService, Screen } from '@solid-native/device/solid';
import { registerExpoMap, registerExpoUiViews } from '@solid-native/expo/views';
import type { PlayerState } from '@solid-native/expo/solid/player';
import type { FakeNode } from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer, flatten } from './consumer-harness.ts';
import { installMediaMocks, gestures, nativeMock } from './g13-media-native-fixture.ts';
const removeHooks = installMediaMocks();
const { TRACK_PLAYER, TRACKS } = await import('../src/app/player/player-model.solid.ts');
const { playerRoutes } = await import('../src/app/player/routes.solid.ts');
const { rideRoutes } = await import('../src/app/ride/routes.solid.ts');
const { shopRoutes } = await import('../src/app/shop/routes.solid.ts');
const { storyRoutes } = await import('../src/app/stories/routes.solid.ts');
const { photoRoutes } = await import('../src/app/viewer/routes.solid.ts');
const routes = [
  ...playerRoutes,
  ...rideRoutes,
  ...shopRoutes,
  ...storyRoutes,
  ...photoRoutes,
  { path: 'cover', component: () => null },
];
for (const route of routes) if ('lazy' in route) await route.lazy!({} as never);
removeHooks();
type Harness = ReturnType<typeof bootConsumer>;
function byLabel(h: Harness, label: string) {
  const node = h.nodes().find((node) => node.props['accessibilityLabel'] === label);
  assert.ok(node, label);
  return node;
}
function touch(h: Harness, node: FakeNode, type: string) {
  const data = { identifier: 1, pageX: 1, pageY: 1 };
  h.fabric.emit(node, type, {
    ...data,
    changedTouches: [data],
    touches: type === 'topTouchEnd' ? [] : [data],
  });
  h.clock.flushMicrotasks();
}
function press(h: Harness, label: string) {
  const node = byLabel(h, label);
  touch(h, node, 'topTouchStart');
  touch(h, node, 'topTouchEnd');
}
async function settle(h: Harness) {
  for (let i = 0; i < 12; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    h.finish();
  }
}
function audio() {
  const calls: string[] = [];
  const [state, setState] = createSignal<PlayerState>({
    playing: false,
    status: 'readyToPlay',
    currentTime: 0,
    duration: 6,
    muted: false,
    volume: 1,
    ended: false,
  });
  const player = {
    state,
    replace: (source: number) => {
      calls.push(`replace ${source}`);
      setState((s) => ({ ...s, currentTime: 0, ended: false }));
    },
    play: () => {
      calls.push('play');
      setState((s) => ({ ...s, playing: true }));
    },
    pause: () => {
      calls.push('pause');
      setState((s) => ({ ...s, playing: false }));
    },
    seekTo: (value: number) => {
      calls.push(`seek ${value}`);
      setState((s) => ({ ...s, currentTime: value }));
    },
    setVolume: (value: number) => calls.push(`volume ${value}`),
    stop: () => calls.push('stop'),
  };
  return { calls, player, setState };
}
for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} player preserves all records, gradients, audio queue, native volume and owned scrub`, async (t) => {
    const fake = audio(),
      fixture = consumerFixture(
        () => routes,
        [provideService(TRACK_PLAYER, () => () => fake.player)],
      ),
      h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    registerExpoUiViews(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/player');
    h.finish();
    for (const track of TRACKS) byLabel(h, `${track.title} by ${track.artist}`);
    const tile = byLabel(h, 'So What by Miles Davis');
    assert.ok(flatten(tile.children).some((n) => n.props['experimental_backgroundImage']));
    press(h, 'So What by Miles Davis');
    assert.deepEqual(fake.calls, ['replace 1', 'play']);
    byLabel(h, 'Playing');
    fake.setState((s) => ({ ...s, ended: true, playing: false, currentTime: 6 }));
    h.clock.flushMicrotasks();
    byLabel(h, 'Now playing, Naima');
    press(h, 'Now playing, Naima');
    await settle(h);
    assert.equal(
      h
        .nodes()
        .filter((n) => n.viewName === 'RNSScreen')
        .at(-1)!.props['stackPresentation'],
      'pageSheet',
    );
    const scrubber = h.nodes().find((n) => n.props['accessibilityRole'] === 'adjustable')!;
    assert.ok(scrubber);
    h.fabric.emit(scrubber, 'topLayout', { layout: { x: 0, y: 0, width: 200, height: 28 } });
    h.clock.flushMicrotasks();
    const scrub = gestures('Pan')[0]!;
    assert.equal(scrub.config['minDistance'], 0);
    scrub.callbacks['begin']!({ x: 50 });
    h.clock.flushMicrotasks();
    byLabel(h, 'Position, 0:01 of 0:06');
    scrub.callbacks['update']!({ x: 100 });
    scrub.callbacks['finalize']!();
    h.clock.flushMicrotasks();
    assert.equal(fake.calls.at(-1), 'seek 3');
    press(h, 'Next');
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Blue in Green/);
    press(h, 'Repeat');
    assert.equal(
      byLabel(h, 'Repeat').props['accessibilityState'] &&
        (byLabel(h, 'Repeat').props['accessibilityState'] as { checked: boolean }).checked,
      true,
    );
    const slider = h.nodes().find((n) => n.instanceHandle.name === 'ui-slider')!;
    assert.ok(slider);
    h.fabric.emit(slider, 'topValueChanged', { value: 0.4 });
    h.clock.flushMicrotasks();
    assert.equal(fake.calls.at(-1), 'volume 0.4');
    await nav.push('/cover');
    h.finish();
    assert.equal(nativeMock.gestures.size, 0);
    await nav.back();
    h.finish();
    const before = fake.calls.length;
    scrub.callbacks['begin']!({ x: 200 });
    scrub.callbacks['finalize']!();
    assert.equal(fake.calls.length, before);
    h.root.dispose();
    assert.equal(fake.calls.at(-1), 'stop');
    assert.equal(nativeMock.gestures.size, 0);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} player deep link retains empty close path`, async (t) => {
    const fake = audio(),
      fixture = consumerFixture(
        () => routes,
        [provideService(TRACK_PLAYER, () => () => fake.player)],
      ),
      h = bootConsumer(fixture, platform);
    registerExpoUiViews(platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/player/now');
    h.finish();
    assert.match(h.renderedText(), /Nothing is playing/);
    h.press('Close');
    await settle(h);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} ride retains all places, live map, detents, options, driver request and cancellation`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
    const fixture = consumerFixture(() => routes),
      h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    registerExpoMap(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/ride');
    h.finish();
    const map = () => h.nodes().find((n) => 'markers' in n.props)!;
    assert.equal((map().props['markers'] as unknown[]).length, 7);
    const initial = JSON.stringify(map().props['markers']);
    t.mock.timers.tick(1000);
    h.clock.flushMicrotasks();
    assert.notEqual(JSON.stringify(map().props['markers']), initial);
    press(h, 'Where to?');
    await settle(h);
    const sheet = h
      .nodes()
      .filter((n) => n.viewName === 'RNSScreen')
      .at(-1)!;
    assert.deepEqual(sheet.props['sheetAllowedDetents'], [0.35, 0.6, 1]);
    assert.equal(sheet.props['sheetLargestUndimmedDetent'], 0);
    assert.equal(
      h
        .nodes()
        .filter(
          (n) =>
            n.props['accessibilityLabel'] && String(n.props['accessibilityLabel']).includes(', '),
        ).length,
      18,
    );
    h.input('Search destinations', 'nowhere');
    assert.match(h.renderedText(), /No places match/);
    h.input('Search destinations', 'tate', 2);
    press(h, 'Tate Modern, Bankside');
    assert.equal(h.nodes().filter((n) => n.props['accessibilityRole'] === 'radio').length, 3);
    assert.equal((map().props['polylines'] as unknown[]).length, 1);
    const comfort = h
      .nodes()
      .find((n) => String(n.props['accessibilityLabel']).startsWith('Comfort, £'))!;
    touch(h, comfort, 'topTouchStart');
    touch(h, comfort, 'topTouchEnd');
    h.press('Request ');
    assert.match(h.renderedText(), /Finding a driver/);
    t.mock.timers.tick(1999);
    h.clock.flushMicrotasks();
    assert.doesNotMatch(h.renderedText(), /Tom is on the way/);
    t.mock.timers.tick(1);
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Tom is on the way/);
    assert.match(h.renderedText(), /Kia Niro/);
    h.press('Cancel ride');
    await settle(h);
    byLabel(h, 'Where to?');
    h.root.dispose();
    t.mock.timers.tick(10000);
    assert.equal(h.nodes().length, 0);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} shop preserves six products, size gating, shared basket, stable steppers and delivery`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const frames = new Map<number, FrameRequestCallback>();
    let next = 0;
    const oldRequest = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame'),
      oldCancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
    Object.assign(globalThis, {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frames.set(++next, callback);
        return next;
      },
      cancelAnimationFrame: (id: number) => {
        frames.delete(id);
      },
    });
    t.after(() => {
      for (const [name, descriptor] of [
        ['requestAnimationFrame', oldRequest],
        ['cancelAnimationFrame', oldCancel],
      ] as const) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    });
    const fixture = consumerFixture(() => routes),
      h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/shop');
    h.finish();
    assert.equal(
      h.nodes().filter((n) => String(n.props['accessibilityLabel']).includes(' out of 5')).length,
      6,
    );
    press(h, 'Trail Runner 3, £119, was £145');
    await settle(h);
    press(h, 'Choose a size');
    assert.equal(
      byLabel(h, 'Choose a size').props['accessibilityState'] &&
        (byLabel(h, 'Choose a size').props['accessibilityState'] as { disabled: boolean }).disabled,
      true,
    );
    press(h, 'Size 9');
    press(h, 'Add to basket');
    byLabel(h, 'Added to basket');
    t.mock.timers.tick(1600);
    h.clock.flushMicrotasks();
    byLabel(h, 'Add to basket');
    await nav.reset('/shop/p3');
    h.finish();
    press(h, 'Add to basket');
    await nav.present('/shop/basket', { as: 'pageSheet' });
    h.finish();
    assert.match(h.renderedText(), /Free delivery unlocked/);
    const fewerShoe = byLabel(h, 'One fewer Trail Runner 3');
    touch(h, fewerShoe, 'topTouchStart');
    touch(h, fewerShoe, 'topTouchEnd');
    assert.match(h.renderedText(), /£47 away from free delivery/);
    const id = byLabel(h, 'One more Canvas Tote').tag;
    press(h, 'One more Canvas Tote');
    assert.equal(byLabel(h, 'One more Canvas Tote').tag, id);
    press(h, 'One more Canvas Tote');
    byLabel(h, '3 of Canvas Tote');
    assert.match(h.renderedText(), /Free delivery unlocked/);
    press(h, 'One fewer Canvas Tote');
    press(h, 'One fewer Canvas Tote');
    press(h, 'One fewer Canvas Tote');
    assert.match(h.renderedText(), /Your basket is empty/);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} stories retain all slides, seen state, pause, animation events and stale callback ownership`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const fixture = consumerFixture(() => routes),
      h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    const listeners: ((event: unknown) => void)[] = [];
    const original = h.root.engine.setEventListener.bind(h.root.engine);
    h.root.engine.setEventListener = (node, type, callback) => {
      if (type === 'topAnimationend') listeners.push(callback);
      return original(node, type, callback);
    };
    await nav.reset('/stories');
    h.finish();
    for (const name of ['Mei', 'Kofi', 'Ines', 'Tom']) byLabel(h, `${name}, new`);
    press(h, 'Kofi, new');
    await settle(h);
    assert.equal(
      h
        .nodes()
        .filter((n) => n.viewName === 'RNSScreen')
        .at(-1)!.props['stackPresentation'],
      'fullScreenModal',
    );
    byLabel(h, 'New strings');
    const fills = () =>
      h.nodes().filter((n) => n.props['transformOrigin'] !== undefined && n.children.length === 0);
    assert.equal(fills().length, 3);
    const saved = listeners[0]!;
    touch(h, byLabel(h, 'Next'), 'topTouchStart');
    assert.match(h.renderedText(), /Paused/);
    h.fabric.emit(fills()[0]!, 'topAnimationend', { animationName: 'progress' });
    byLabel(h, 'New strings');
    touch(h, byLabel(h, 'Next'), 'topTouchCancel');
    t.mock.timers.tick(140);
    h.clock.flushMicrotasks();
    h.fabric.emit(fills()[0]!, 'topAnimationend', { animationName: 'progress' });
    h.clock.flushMicrotasks();
    byLabel(h, 'Gig on Friday');
    saved({});
    h.clock.flushMicrotasks();
    byLabel(h, 'Gig on Friday');
    press(h, 'Next');
    byLabel(h, 'After party');
    press(h, 'Previous');
    byLabel(h, 'Gig on Friday');
    const swipe = gestures('Pan')[0]!;
    assert.deepEqual(swipe.config, { js: true, activeOffsetY: 14, failOffsetX: [-20, 20] });
    swipe.callbacks['update']!({ translationY: 70 });
    swipe.callbacks['end']!({ translationY: 70, velocityY: 100 });
    h.clock.flushMicrotasks();
    const beforeCover = listeners.at(-2)!;
    await nav.push('/cover');
    h.finish();
    await nav.back();
    h.finish();
    swipe.callbacks['end']!({ translationY: 300, velocityY: 1000 });
    beforeCover({});
    h.clock.flushMicrotasks();
    byLabel(h, 'Gig on Friday');
    press(h, 'Next');
    press(h, 'Next');
    byLabel(h, 'The garden is finally green');
    press(h, 'Close');
    await settle(h);
    byLabel(h, 'Kofi, seen');
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} photo gallery preserves twelve zoom pages, paging reset, rotation and covered gestures`, async (t) => {
    let sizes = { window: { width: 402, height: 874 }, screen: { width: 402, height: 874 } };
    const [size, report] = createSignal(sizes);
    const fixture = consumerFixture(
        () => routes,
        [
          provideService(Screen, () => ({
            window: () => size().window,
            display: () => size().screen,
            orientation: () =>
              size().window.width > size().window.height ? 'landscape' : 'portrait',
            compact: () => size().window.width < 768,
          })),
        ],
      ),
      h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    const commands: { node: FakeNode; name: string; args: unknown[] }[] = [];
    Object.assign(h.fabric, {
      dispatchCommand(node: FakeNode, name: string, args: unknown[]) {
        commands.push({ node, name, args });
      },
    });
    await nav.reset('/photos');
    h.finish();
    assert.equal(
      h.nodes().filter((n) => n.props['accessibilityRole'] === 'imagebutton').length,
      12,
    );
    press(h, 'Photo 4');
    await settle(h);
    assert.match(h.renderedText(), /4 of 12/);
    const pager = () => h.nodes().find((n) => n.props['pagingEnabled'] === true)!;
    const page = (i: number) => h.nodes().find((n) => n.props['nativeID'] === `page-${i}`)!;
    assert.deepEqual(pager().props['contentOffset'], { x: 1206, y: 0 });
    assert.equal(h.nodes().filter((n) => n.props['maximumZoomScale'] === 4).length, 12);
    const target = flatten(page(3).children).find(
      (n) => n.props['collapsable'] === false && gestures('Tap', n.tag).length,
    )!;
    assert.ok(target);
    const tap = gestures('Tap', target.tag)[0]!;
    assert.equal(tap.config['taps'], 2);
    tap.callbacks['end']!({ x: 120, y: 300 });
    h.clock.flushMicrotasks();
    let zoom = commands.filter((c) => c.name === 'zoomToRect');
    assert.equal(zoom.at(-1)!.node.tag, page(3).tag);
    assert.deepEqual(zoom.at(-1)!.args, [
      { x: 53, y: 300 - 874 / 6, width: 134, height: 874 / 3 },
      true,
    ]);
    h.fabric.emit(pager(), 'topMomentumScrollEnd', { contentOffset: { x: 4 * 402, y: 0 } });
    h.clock.flushMicrotasks();
    zoom = commands.filter((c) => c.name === 'zoomToRect');
    assert.equal(
      zoom.at(-1)!.args[1],
      false,
      JSON.stringify({
        commands: commands.map((c) => ({ name: c.name, args: c.args })),
        text: h.renderedText(),
      }),
    );
    assert.match(h.renderedText(), /5 of 12/);
    h.fabric.emit(page(4), 'topScroll', { zoomScale: 2, contentOffset: { x: 0, y: 0 } });
    h.fabric.emit(pager(), 'topMomentumScrollEnd', { contentOffset: { x: 5 * 402, y: 0 } });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /6 of 12/);
    sizes = { window: { width: 874, height: 402 }, screen: sizes.screen };
    report(sizes);
    h.clock.flushMicrotasks();
    assert.deepEqual(pager().props['contentOffset'], { x: 5 * 874, y: 0 });
    assert.equal(page(3).props['width'], 874);
    await nav.push('/cover');
    h.finish();
    assert.equal(nativeMock.gestures.size, 0);
    await nav.back();
    h.finish();
    const before = commands.length;
    tap.callbacks['end']!({ x: 100, y: 100 });
    h.clock.flushMicrotasks();
    assert.equal(commands.length, before);
    h.press('Done');
    await settle(h);
    assert.equal(h.nodes().filter((n) => n.props['maximumZoomScale'] === 4).length, 0);
    assert.deepEqual(fixture.errors, []);
  });
}
test('all eleven paths lazy-load real components and dynamic routes accept direct links', async (t) => {
  const fixture = consumerFixture(
      () => routes,
      [provideService(TRACK_PLAYER, () => () => audio().player)],
    ),
    h = bootConsumer(fixture);
  registerExpoMap('ios');
  registerExpoUiViews('ios');
  t.after(() => h.root.dispose());
  for (const path of [
    '/player',
    '/player/now',
    '/ride',
    '/ride/where',
    '/shop',
    '/shop/basket',
    '/shop/p2',
    '/stories',
    '/stories/view',
    '/photos',
    '/photos/11',
  ]) {
    await fixture.navigation().reset(path);
    h.finish();
    assert.ok(h.nodes().length, path);
  }
  assert.match(h.renderedText(), /12 of 12/);
  assert.deepEqual(fixture.errors, []);
});
