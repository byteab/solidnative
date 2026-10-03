import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Direction, provideService } from '@solid-native/device/solid';
import type { FakeNode } from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { ComponentsPage } from '../src/app/components/components.solid.tsx';
import { ScrollingPage } from '../src/app/lists/scrolling.solid.tsx';
import { ListPage } from '../src/app/lists/list.solid.tsx';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} components retain nested responders, refused values, refs and native events`, async (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
    const fixture = consumerFixture(
      () => [{ path: 'components', component: ComponentsPage }],
      [
        provideService(Direction.SOURCE, () => ({
          current: () => 'ltr',
          subscribe: () => () => {},
        })),
      ],
    );
    const h = bootConsumer(fixture, platform);
    t.after(() => h.root.dispose());
    const commands: { name: string; args: unknown[] }[] = [];
    Object.assign(h.fabric, {
      dispatchCommand(_node: FakeNode, name: string, args: unknown[]) {
        commands.push({ name, args });
      },
    });
    await fixture.navigation().reset('/components');
    h.finish();
    const label = (value: string) => {
      const node = h.nodes().find((node) => node.props['accessibilityLabel'] === value);
      assert.ok(node, value);
      return node;
    };
    const touch = (node: FakeNode, type: string) => {
      const data = { identifier: 1, pageX: 1, pageY: 1 };
      h.fabric.emit(node, type, {
        ...data,
        changedTouches: [data],
        touches: type === 'topTouchEnd' ? [] : [data],
      });
      h.clock.flushMicrotasks();
    };
    for (const value of ['Inner button', 'Outer row', 'Component text press']) {
      const node = label(value);
      touch(node, 'topTouchStart');
      touch(node, 'topTouchEnd');
    }
    assert.match(h.renderedText(), /outer 1 inner 1/);
    assert.match(h.renderedText(), /text presses 1/);
    const held = label('Hold counter');
    touch(held, 'topTouchStart');
    t.mock.timers.tick(510);
    touch(held, 'topTouchEnd');
    assert.match(h.renderedText(), /short 0 long 1/);
    h.fabric.emit(label('Refused switch'), 'topChange', { value: true });
    h.clock.flushMicrotasks();
    assert.ok(
      commands.some(
        (command) =>
          command.name === (platform === 'ios' ? 'setValue' : 'setNativeValue') &&
          command.args[0] === false,
      ),
    );
    h.fabric.emit(label('Plain switch'), 'topChange', { value: true });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /plain switch true/);
    const input = label('Component input');
    assert.equal(input.props['maxLength'], 5);
    h.input('Component input', 'abc');
    for (const event of ['topFocus', 'topBlur', 'topSubmitEditing'])
      h.fabric.emit(input, event, { text: 'abc' });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /typed \[abc\] change \[abc\] focus 1 blur 1 submit 1/);
    h.press('set field');
    assert.equal(label('Component input').props['text'], 'code');
    h.press('clear field');
    assert.equal(label('Component input').props['text'], '');
    h.press('blur field');
    assert.ok(commands.some((command) => command.name === 'blur'));
    const images = h.nodes().filter((node) => node.instanceHandle.name === 'image');
    h.fabric.emit(images[0]!, 'topLoad', { source: { width: 32, height: 48 } });
    h.fabric.emit(images[1]!, 'topError', { error: 'missing' });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /image load \[32x48\] errors 1/);
    h.press('open plain modal');
    const modal = h.nodes().find((node) => node.instanceHandle.name === 'modal')!;
    assert.ok(modal);
    assert.equal(modal.props['animationType'], 'slide');
    for (const event of ['topShow', 'topDismiss', 'topRequestClose']) h.fabric.emit(modal, event);
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /modal show 1 requestClose 1 dismiss 1/);
    assert.ok(!h.nodes().some((node) => node.instanceHandle.name === 'modal'));
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} scrolling preserves nesting, refresh, offsets and cancels covered work`, async (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
    const fixture = consumerFixture(() => [
      { path: 'scrolling', component: ScrollingPage },
      { path: 'cover', component: () => null },
    ]);
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/scrolling');
    h.finish();
    const scrolls = h.nodes().filter((node) => node.instanceHandle.name === 'scroll-view');
    assert.equal(scrolls.length, 7);
    assert.ok(scrolls.some((node) => node.props['pagingEnabled'] === true));
    assert.ok(scrolls.some((node) => node.props['bounces'] === false));
    const offsets = scrolls.find(
      (node) =>
        node.props['scrollEventThrottle'] === 16 && node.instanceHandle.classes?.has('strip'),
    )!;
    h.fabric.emit(offsets, 'topScroll', { contentOffset: { x: 0, y: 46.7 } });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /offset 47px/);
    const refresh = () => h.nodes().find((node) => node.instanceHandle.name === 'refresh-control')!;
    h.fabric.emit(refresh(), 'topRefresh');
    h.clock.flushMicrotasks();
    assert.equal(refresh().props['refreshing'], true);
    t.mock.timers.tick(800);
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /refresh: 1 so far/);
    assert.equal(refresh().props['refreshing'], false);
    h.fabric.emit(refresh(), 'topRefresh');
    h.press('Block JS for 1s');
    await nav.push('/cover');
    h.finish();
    t.mock.timers.tick(1000);
    await nav.back();
    h.finish();
    assert.match(h.renderedText(), /refresh: 1 so far/);
    assert.doesNotMatch(h.renderedText(), /blocking\.\.\./);
    assert.equal(refresh().props['refreshing'], false);
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} list keeps all 1000 variable-height rows reachable through a bounded window`, async (t) => {
    const fixture = consumerFixture(() => [{ path: 'list', component: ListPage }]);
    const h = bootConsumer(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/list');
    h.finish();
    const list = () =>
      h.nodes().find((node) => node.props['accessibilityLabel'] === 'Variable-height rows')!;
    assert.ok(list());
    h.fabric.emit(list(), 'topLayout', { layout: { width: 350, height: 320, x: 0, y: 0 } });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /section 0/);
    h.fabric.emit(list(), 'topScroll', {
      contentOffset: { x: 0, y: 40788 },
      layoutMeasurement: { width: 350, height: 320 },
      contentSize: { width: 350, height: 41200 },
    });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /section 99/);
    assert.match(h.renderedText(), /item 99\.8/);
    assert.ok(
      h.nodes().filter((node) => node.instanceHandle.classes?.has('list-item')).length < 50,
    );
    assert.deepEqual(fixture.errors, []);
  });
}
