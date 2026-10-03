import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import { installNativeMocks, nativeMock as native } from './g9-native-mocks.ts';
import { Gestures } from '../src/app/gestures/gestures.solid.tsx';
const hook = installNativeMocks();
const { WorkletsPage } = await import('../src/app/gestures/worklets.solid.tsx');
const { NativeGesturesPage } = await import('../src/app/gestures/native-gestures.solid.tsx');
const { AnimationPage } = await import('../src/app/components/animation.solid.tsx');
hook.deregister();

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} worklet scroll mappings suspend while covered and rebind on return`, async (t) => {
    const fixture = consumerFixture(() => [
      { path: 'worklets', component: WorkletsPage },
      { path: 'cover', component: () => null },
    ]);
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/worklets');
    h.finish();
    assert.equal(native.mappers.size, 2);
    assert.equal(native.events.size, 1);
    assert.match(h.renderedText(), /row 23/);
    const scroll = [...native.events.values()][0]!;
    scroll.callback({ contentOffset: { y: 120 } } as never);
    native.updates.length = 0;
    for (const mapper of native.mappers.values()) mapper();
    assert.ok(native.updates.some((change) => change.updates['opacity'] === 0.35));
    h.press('run');
    const cancellations = native.cancelled.length;
    h.press('block the JS thread');
    await nav.push('/cover');
    h.finish();
    assert.equal(native.mappers.size, 0);
    assert.equal(native.events.size, 0);
    assert.ok(native.cancelled.length > cancellations);
    await nav.back();
    h.finish();
    assert.equal(native.mappers.size, 2);
    assert.equal(native.events.size, 1);
    assert.match(h.renderedText(), /a busy loop, no timers/);
    h.root.dispose();
    assert.equal(native.mappers.size, 0);
    assert.equal(native.events.size, 0);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} native gestures keep noncollapsable targets and cancel covered callbacks`, async (t) => {
    const fixture = consumerFixture(() => [
      { path: 'native-gestures', component: NativeGesturesPage },
      { path: 'cover', component: () => null },
    ]);
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/native-gestures');
    h.finish();
    assert.equal(native.gestures.size, 4);
    assert.equal(native.mappers.size, 2);
    for (const gesture of native.gestures.values())
      assert.equal(
        h.nodes().find((node) => node.tag === gesture.viewTag)?.props['collapsable'],
        false,
      );
    const tap = [...native.gestures.values()].filter((g) => g.gestureConfig.kind === 'Tap').at(-1)!
      .gestureConfig.callbacks['end']!;
    tap();
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Taps: 1/);
    const pan = [...native.gestures.values()].find((g) => g.gestureConfig.kind === 'Pan')!;
    pan.gestureConfig.callbacks['change']!({ changeX: 15, changeY: -6 } as never);
    native.updates.length = 0;
    for (const mapper of native.mappers.values()) mapper();
    assert.ok(
      native.updates.some((change) => JSON.stringify(change.updates).includes('"translateX":15')),
    );
    await nav.push('/cover');
    h.finish();
    assert.equal(native.gestures.size, 0);
    assert.equal(native.mappers.size, 0);
    tap();
    await nav.back();
    h.finish();
    assert.match(h.renderedText(), /Taps: 1/);
    h.root.dispose();
    tap();
    assert.equal(native.gestures.size, 0);
    assert.equal(native.mappers.size, 0);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} animation preserves driver selection, presence and retained cancellation`, async (t) => {
    native.animations.length = 0;
    const fixture = consumerFixture(() => [
      { path: 'animation', component: AnimationPage },
      { path: 'cover', component: () => null },
    ]);
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/animation');
    h.finish();
    assert.equal(native.graphs.size, 2);
    h.press('run both');
    assert.deepEqual(
      native.animations.map((a) => a.config['useNativeDriver']),
      [true, false],
    );
    assert.ok(native.animations.every((a) => a.config['duration'] === 4000));
    h.press('toggle the class');
    assert.ok(h.nodes().some((n) => n.instanceHandle.classes?.has('on')));
    h.press('remove the row');
    assert.match(h.renderedText(), /enter and leave/);
    h.press('bring it back');
    assert.equal(h.nodes().filter((n) => n.props['text'] === 'enter and leave').length, 1);
    await nav.push('/cover');
    h.finish();
    assert.equal(native.graphs.size, 0);
    assert.ok(native.animations.every((a) => a.stopped));
    await nav.back();
    h.finish();
    assert.equal(native.graphs.size, 2);
    h.root.dispose();
    assert.equal(native.graphs.size, 0);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} responder slider uses page deltas and capture lock`, async (t) => {
    const fixture = consumerFixture(() => [{ path: 'gestures', component: Gestures }]);
    const h = bootConsumer(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/gestures');
    h.finish();
    h.press('tap me (pressable)');
    assert.match(h.renderedText(), /taps: 1 - last: pressable/);
    const slider = h.nodes().find((n) => n.props['accessibilityRole'] === 'adjustable')!;
    h.fabric.emit(slider, 'topLayout', { layout: { x: 0, y: 0, width: 200, height: 36 } });
    const touch = (type: string, pageX: number) =>
      h.fabric.emit(slider, type, {
        identifier: 2,
        pageX,
        pageY: 10,
        changedTouches: [{ identifier: 2, pageX, pageY: 10 }],
        touches: type === 'topTouchEnd' ? [] : [{ identifier: 2, pageX, pageY: 10 }],
      });
    touch('topTouchStart', 50);
    touch('topTouchMove', 100);
    touch('topTouchEnd', 100);
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /slider: 0.60/);
    h.press('capture OFF');
    touch('topTouchStart', 50);
    touch('topTouchMove', 190);
    touch('topTouchEnd', 190);
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /slider: 0.60/);
    h.root.dispose();
    assert.deepEqual(fixture.errors, []);
  });
}
