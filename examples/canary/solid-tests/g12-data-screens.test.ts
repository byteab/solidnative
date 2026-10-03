import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solidnative/device/solid';
import { registerExpoUiViews } from '@solidnative/expo/solid';
import { FeedBackend, FeedBackendSource } from '../src/app/feed/feed-backend.solid.ts';
import { FeedPage } from '../src/app/feed/feed.solid.tsx';
import { ChatBackend, ChatBackendSource } from '../src/app/chat/chat-backend.solid.ts';
import { ChatPage } from '../src/app/chat/chat.solid.tsx';
import { Browse } from '../src/app/browse/browse.solid.tsx';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer, flatten } from './consumer-harness.ts';
import type { FakeNode } from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { galleryFixture } from './g12-data-fixture.tsx';
import {
  installNativeMocks,
  nativeMock as native,
  type MockGesture,
} from './g12-data-native-mocks.ts';
const hook = installNativeMocks();
const { InboxPage, INBOX_SWIPES } = await import('../src/app/inbox/inbox.solid.tsx');
hook.deregister();
const visibleText = (h: ReturnType<typeof bootConsumer>) =>
  h
    .nodes()
    .filter((node) => {
      for (let current = node.instanceHandle; current; current = current.parent!) {
        if ((current.props['style'] as { display?: string } | undefined)?.display === 'none')
          return false;
      }
      return true;
    })
    .map((node) => node.props['text'] ?? '')
    .join('');
function bootData(
  fixture: ReturnType<typeof consumerFixture>,
  platform: 'ios' | 'android' = 'ios',
) {
  const h = bootConsumer(fixture, platform);
  const commands: { tag: number; name: string; args: unknown[] }[] = [];
  Object.assign(h.fabric, {
    dispatchCommand(node: FakeNode, name: string, args: unknown[]) {
      commands.push({ tag: node.tag, name, args });
    },
  });
  const pressExact = (label: string) => {
    const node = h.nodes().find(
      (node) =>
        node.instanceHandle.name === 'pressable' &&
        flatten(node.children)
          .map((child) => child.props['text'] ?? '')
          .join('') === label,
    );
    assert.ok(node, label);
    h.press(label, node);
  };
  return { ...h, commands, pressExact };
}
const nested = (gesture: MockGesture): MockGesture[] => [
  gesture,
  ...(gesture.children ?? []).flatMap(nested),
];

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} feed preserves paging, optimistic rows, refresh pills, stress and retained data`, async (t) => {
    const backend = new FeedBackendSource();
    backend.latency = 0;
    const fixture = consumerFixture(
      () => [
        { path: 'feed', component: FeedPage },
        { path: 'cover', component: () => null },
      ],
      [provideService(FeedBackend.SOURCE, () => backend)],
    );
    const h = bootData(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/feed');
    h.finish();
    await h.waitFor(() => h.renderedText().includes('25 posts.'));
    assert.match(h.renderedText(), /p100000/);
    h.press('Like');
    await h.waitFor(() => h.renderedText().includes('Liked'));
    h.press('Edit');
    assert.match(h.renderedText(), /edited 1/);
    const list = h.nodes().find((node) => node.instanceHandle.name === 'scroll-view')!;
    assert.ok(list);
    h.fabric.emit(list, 'topScroll', {
      contentOffset: { x: 0, y: 100 },
      layoutMeasurement: { width: 402, height: 600 },
    });
    h.clock.flushMicrotasks();
    h.press('3 new');
    await h.waitFor(() => h.renderedText().includes('3 new posts'));
    h.press(' new posts');
    assert.ok(h.commands.some((command) => command.name === 'scrollTo'));
    h.press('5,000 posts');
    await h.waitFor(() => /50\d\d posts\./.test(h.renderedText()));
    h.press('Stats');
    assert.match(h.renderedText(), /commits, worst/);
    await fixture.navigation().push('/cover');
    h.finish();
    await fixture.navigation().back();
    h.finish();
    assert.match(h.renderedText(), /50\d\d posts\./);
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} chat preserves controlled composer, fail/retry, keyboard linkage and foreground timers`, async (t) => {
    const backend = new ChatBackendSource();
    backend.latency = 0;
    const fixture = consumerFixture(
      () => [
        { path: 'chat', component: ChatPage },
        { path: 'cover', component: () => null },
      ],
      [provideService(ChatBackend.SOURCE, () => backend)],
    );
    const h = bootData(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/chat');
    h.finish();
    await h.waitFor(() => h.renderedText().includes('No rush.'));
    const input = h.nodes().find((node) => node.props['nativeID'] === 'chat-composer')!;
    assert.ok(input);
    assert.equal(input.props['multiline'], true);
    h.press('Online');
    h.input('Message', 'Hello Sam');
    h.press('Send');
    await h.waitFor(() => h.renderedText().includes('Not delivered. Tap to retry'));
    assert.equal(
      h.nodes().find((node) => node.props['nativeID'] === 'chat-composer')?.props['text'],
      '',
    );
    assert.ok(h.commands.some((command) => command.name === 'focus' && command.tag === input.tag));
    h.press('Offline');
    h.press('Not delivered. Tap to retry');
    await h.waitFor(() => !visibleText(h).includes('Not delivered. Tap to retry'));
    h.press('Sam replies');
    assert.match(h.renderedText(), /Sam is typing/);
    h.press('Live: off');
    await fixture.navigation().push('/cover');
    h.finish();
    await fixture.navigation().back();
    h.finish();
    assert.doesNotMatch(h.renderedText(), /Sam is typing/);
    assert.match(h.renderedText(), /Live: off/);
    assert.match(h.renderedText(), /Hello Sam/);
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} browse preserves132-point albums,24 genres, jump chips, top and refreshed shelf positions`, async (t) => {
    const fixture = consumerFixture(() => [
      { path: 'browse', component: Browse },
      { path: 'search-demo/:id', component: () => null },
    ]);
    const h = bootData(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/browse');
    h.finish();
    for (const label of ['Jazz', 'Gospel', 'Vocal', 'Electronic'])
      assert.ok(h.renderedText().includes(label));
    const shelf = h.nodes().find((node) => node.props['nativeID'] === 'shelf-g0')!;
    assert.ok(shelf);
    const album = h.nodes().find((node) => node.props['nativeID'] === 'card-g0a0')!;
    assert.ok(album);
    assert.equal(
      album.instanceHandle.parent?.props['style'] &&
        (album.instanceHandle.parent.props['style'] as { width: number }).width,
      132,
    );
    h.fabric.emit(shelf, 'topScroll', {
      contentOffset: { x: 528, y: 0 },
      layoutMeasurement: { width: 402, height: 170 },
    });
    h.clock.flushMicrotasks();
    assert.ok(h.nodes().some((node) => node.props['nativeID'] === 'card-g0a4'));
    const outer = h
      .nodes()
      .find((node) => node.instanceHandle.name === 'scroll-view' && !node.props['horizontal'])!;
    h.fabric.emit(outer, 'topScroll', {
      contentOffset: { x: 0, y: 1000 },
      layoutMeasurement: { width: 402, height: 600 },
    });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Top/);
    const heading = h.nodes().find((node) => node.props['nativeID'] === 'row-heading-g4')!;
    assert.equal(
      heading.instanceHandle.parent?.props['style'] &&
        (heading.instanceHandle.parent.props['style'] as { zIndex: number }).zIndex,
      1,
    );
    h.pressExact('Top');
    assert.deepEqual(
      h.commands
        .filter((command) => command.tag === outer.tag && command.name === 'scrollTo')
        .at(-1)?.args,
      [0, 0, true],
    );
    h.fabric.emit(outer, 'topScroll', {
      contentOffset: { x: 0, y: 0 },
      layoutMeasurement: { width: 402, height: 600 },
    });
    h.clock.flushMicrotasks();
    const jazz = () => h.nodes().find((node) => node.props['nativeID'] === 'shelf-g0')!;
    assert.equal(
      h.commands
        .filter((command) => command.tag === jazz().tag && command.name === 'scrollTo')
        .at(-1)?.args[0],
      528,
    );
    const refresh = h.nodes().find((node) => node.instanceHandle.name === 'refresh-control')!;
    assert.ok(refresh);
    h.fabric.emit(refresh, 'topRefresh');
    h.clock.flushMicrotasks();
    await new Promise((resolve) => setTimeout(resolve, 620));
    h.clock.flushMicrotasks();
    assert.match(visibleText(h), /Jazz 5 \(1\)/);
    assert.equal(
      h.commands
        .filter((command) => command.tag === jazz().tag && command.name === 'scrollTo')
        .at(-1)?.args[0],
      528,
    );
    h.press('Jazz 5 (1)');
    await h.waitFor(() => fixture.navigation().transition() !== null);
    h.finish();
    await fixture.navigation().back();
    h.finish();
    assert.equal(
      h.commands
        .filter((command) => command.tag === jazz().tag && command.name === 'scrollTo')
        .at(-1)?.args[0],
      528,
    );
    h.press('Electronic');
    assert.ok(
      (h.commands
        .filter((command) => command.tag === outer.tag && command.name === 'scrollTo')
        .at(-1)?.args[1] as number) > 900,
    );
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} drawn inbox preserves competing gesture thresholds, selection, accessibility and cover cleanup`, async (t) => {
    const fixture = consumerFixture(
      () => [
        { path: 'inbox', component: InboxPage },
        { path: 'search-demo/:id', component: () => null },
        { path: 'cover', component: () => null },
      ],
      [provideService(INBOX_SWIPES, () => 'drawn')],
    );
    const h = bootData(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/inbox');
    h.finish();
    assert.match(h.renderedText(), /Inbox \(103\)/);
    assert.match(h.renderedText(), /Archive \(17\)/);
    const rowGesture = (id: string) => {
      const node = h.nodes().find((node) => node.props['nativeID'] === 'front-' + id)!;
      assert.ok(node, id);
      assert.equal(node.props['collapsable'], false);
      const result = [...native.gestures.values()].find((value) => value.viewTag === node.tag)!;
      assert.ok(result);
      return nested(result.gestureConfig);
    };
    let gestures = rowGesture('m0'),
      pan = gestures.find((g) => g.kind === 'Pan')!;
    assert.equal(pan.activeX, -12);
    assert.equal(pan.failX, 12);
    assert.deepEqual(pan.failY, [-10, 10]);
    assert.equal(pan.blocks?.kind, 'Native');
    assert.equal(gestures.find((g) => g.kind === 'LongPress')?.duration, 400);
    pan.callbacks['change']!({ changeX: -20 } as never);
    pan.callbacks['end']!({ velocityX: 0 } as never);
    native.updates.length = 0;
    for (const mapper of native.mappers.values()) mapper();
    assert.ok(
      native.updates.every((change) => JSON.stringify(change.updates).includes('"translateX":0')),
    );
    pan.callbacks['change']!({ changeX: -100 } as never);
    pan.callbacks['end']!({ velocityX: 0 } as never);
    native.updates.length = 0;
    for (const mapper of native.mappers.values()) mapper();
    assert.ok(
      native.updates.some((change) => JSON.stringify(change.updates).includes('"translateX":-160')),
    );
    gestures.find((g) => g.kind === 'Tap')!.callbacks['end']!();
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Inbox \(103\)/);
    native.updates.length = 0;
    for (const mapper of native.mappers.values()) mapper();
    assert.ok(
      native.updates.every((change) => JSON.stringify(change.updates).includes('"translateX":0')),
    );
    pan.callbacks['change']!({ changeX: -280 } as never);
    pan.callbacks['end']!({ velocityX: 0 } as never);
    native.completions.splice(0).forEach((done) => done());
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Inbox \(102\)/);
    gestures = rowGesture('m1');
    gestures.find((g) => g.kind === 'LongPress')!.callbacks['start']!();
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /1 selected/);
    rowGesture('m2').find((g) => g.kind === 'Tap')!.callbacks['end']!();
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /2 selected/);
    h.press('Archive');
    assert.match(h.renderedText(), /Inbox \(100\)/);
    const accessible = h.nodes().find((node) => node.props['nativeID'] === 'front-m3')!;
    h.fabric.emit(accessible, 'topAccessibilityAction', { actionName: 'archive' });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Inbox \(99\)/);
    const oldTap = rowGesture('m4').find((g) => g.kind === 'Tap')!.callbacks['end']!;
    await fixture.navigation().push('/cover');
    h.finish();
    assert.equal(native.mappers.size, 0);
    assert.equal(native.gestures.size, 0);
    oldTap();
    await fixture.navigation().back();
    h.finish();
    oldTap();
    await Promise.resolve();
    h.finish();
    assert.match(h.renderedText(), /Inbox \(99\)/);
    const flick = rowGesture('m5').find((g) => g.kind === 'Pan')!;
    flick.callbacks['change']!({ changeX: -10 } as never);
    flick.callbacks['end']!({ velocityX: -1600 } as never);
    native.completions.splice(0).forEach((done) => done());
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Inbox \(98\)/);
    h.root.dispose();
    assert.equal(native.mappers.size, 0);
    assert.equal(native.gestures.size, 0);
    assert.deepEqual(fixture.errors, []);
  });
}

test('actual iOS native inbox retains SwiftUI swipe actions, full swipe, folder controls and row navigation', async (t) => {
  registerExpoUiViews('ios');
  const fixture = consumerFixture(() => [
    { path: 'inbox', component: InboxPage },
    { path: 'search-demo/:id', component: () => null },
  ]);
  const h = bootData(fixture);
  t.after(() => h.root.dispose());
  await fixture.navigation().reset('/inbox');
  h.finish();
  const mailRow = h
    .nodes()
    .find(
      (node) =>
        node.instanceHandle.name === 'ui-button' &&
        flatten([node]).some((child) => child.props['text'] === 'Lunch on Friday? 0'),
    )!;
  assert.ok(mailRow);
  h.fabric.emit(mailRow, 'topButtonPress');
  await h.waitFor(() => fixture.navigation().transition() !== null);
  h.finish();
  await fixture.navigation().back();
  h.finish();
  assert.equal(
    h
      .nodes()
      .find(
        (node) =>
          node.instanceHandle.name === 'ui-button' &&
          flatten([node]).some((child) => child.props['text'] === 'Lunch on Friday? 0'),
      )?.tag,
    mailRow.tag,
  );
  const slots = h.nodes().filter((node) => node.instanceHandle.name === 'ui-slot');
  assert.equal(slots.length, 120);
  assert.ok(slots.every((node) => JSON.stringify(node.props).includes('allowsFullSwipe')));
  const action = h
    .nodes()
    .find((node) => node.instanceHandle.name === 'ui-button' && node.props['label'] === 'Archive')!;
  assert.ok(action);
  h.fabric.emit(action, 'topButtonPress');
  h.clock.flushMicrotasks();
  assert.match(h.renderedText(), /Inbox \(102\)/);
  assert.match(h.renderedText(), /Archive \(18\)/);
  h.press('Archive (18)');
  assert.deepEqual(fixture.errors, []);
});

for (const platform of ['ios', 'android'] as const)
  test(`actual ${platform} gallery restores recycled pages and suppresses covered native commands`, async (t) => {
    const gallery = galleryFixture();
    const fixture = consumerFixture(() => [
      { path: 'gallery', component: gallery.Gallery },
      { path: 'cover', component: () => null },
    ]);
    const h = bootData(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/gallery');
    h.finish();
    const frame = h.nodes().find((node) => node.instanceHandle.classes?.has('gallery'))!;
    h.fabric.emit(frame, 'topLayout', { layout: { x: 0, y: 0, width: 300, height: 200 } });
    h.clock.flushMicrotasks();
    h.commands.length = 0;
    gallery.replace('b', 2);
    h.clock.flushMicrotasks();
    assert.deepEqual(
      h.commands.map(({ name, args }) => ({ name, args })),
      [{ name: 'scrollTo', args: [600, 0, false] }],
    );
    assert.match(h.renderedText(), /3\/3/);
    const pager = h.nodes().find((node) => node.instanceHandle.name === 'scroll-view')!;
    h.fabric.emit(pager, 'topMomentumScrollEnd', { contentOffset: { x: 300, y: 0 } });
    h.clock.flushMicrotasks();
    assert.deepEqual(gallery.changes, [1]);
    await fixture.navigation().push('/cover');
    h.finish();
    h.commands.length = 0;
    gallery.replace('c', 1);
    h.clock.flushMicrotasks();
    assert.equal(h.commands.length, 0);
    await fixture.navigation().back();
    h.finish();
    assert.deepEqual(h.commands.at(-1)?.args, [300, 0, false]);
    assert.deepEqual(fixture.errors, []);
  });
