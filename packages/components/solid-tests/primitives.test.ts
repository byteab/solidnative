import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solidnative/platform/solid';
import {
  primitiveFixture,
  ownershipFixture,
  pressCallbackFixture,
  lazyPressFixture,
} from './compiled-fixture.tsx';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
function boot() {
  const fixture = primitiveFixture(),
    fabric = createFakeFabric(),
    clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.Scene);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((entry) => entry.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };
  const touch = (id: string, type: string, x = 1, y = 1) =>
    fabric.emit(find(id), type, {
      identifier: 1,
      pageX: x,
      pageY: y,
      changedTouches: [{ identifier: 1, pageX: x, pageY: y }],
      touches:
        type === 'topTouchEnd' || type === 'topTouchCancel'
          ? []
          : [{ identifier: 1, pageX: x, pageY: y }],
    });
  return { fixture, fabric, clock, root, find, touch };
}

test('compiled primitives map identity/accessibility defaults, nested native text and prop removals', () => {
  const { root, fixture, find, clock } = boot();
  assert.equal(find('container').props['nativeID'], 'identity');
  assert.equal(find('container').props['accessibilityLabel'], 'explicit');
  assert.equal(find('paragraph').viewName, 'Paragraph');
  assert.equal(find('nested').viewName, 'VirtualText');
  assert.equal(find('paragraph').props['accessible'], true);
  assert.equal(find('button').props['accessible'], true);
  assert.equal(find('button').props['focusable'], true);
  fixture.setExplicit(undefined);
  clock.flushMicrotasks();
  assert.equal(find('container').props['accessibilityLabel'], 'alias');
  fixture.setLabel(undefined);
  fixture.setDisabled(true);
  clock.flushMicrotasks();
  assert.equal(find('container').props['accessibilityLabel'] ?? undefined, undefined);
  assert.equal(find('container').props['importantForAccessibility'], 'no-hide-descendants');
  assert.deepEqual(find('button').props['accessibilityState'], { disabled: true });
  assert.equal(find('container').props['aria-label'], undefined);
  fixture.setDisabled(false);
  clock.flushMicrotasks();
  assert.equal(find('container').props['importantForAccessibility'] ?? undefined, undefined);
  root.dispose();
});

test('real responder arbitration presses only the nested winner and exposes pressed state', () => {
  const { root, fixture, touch, clock, find, fabric } = boot();
  touch('button', 'topTouchStart');
  clock.flushMicrotasks();
  assert.equal(find('button').props['opacity'], 0.5);
  touch('button', 'topTouchEnd');
  clock.flushMicrotasks();
  assert.equal(find('button').props['opacity'], 1);
  assert.deepEqual(fixture.calls, ['in', 'out', 'press']);
  assert.ok(fabric.responderCalls.some((call) => call.active));
  touch('inner', 'topTouchStart');
  touch('inner', 'topTouchEnd');
  assert.deepEqual(fixture.calls, ['in', 'out', 'press', 'inner']);
  fixture.setDisabled(true);
  touch('button', 'topTouchStart');
  touch('button', 'topTouchEnd');
  assert.equal(fixture.calls.length, 4);
  root.dispose();
});

test('press cancellation uses fallback distance, measured retention, native cancellation and mid-gesture disabled', () => {
  const { root, fixture, touch, fabric, find } = boot();
  touch('button', 'topTouchStart');
  touch('button', 'topTouchMove', 100);
  touch('button', 'topTouchEnd', 100);
  assert.deepEqual(fixture.calls, ['in', 'out']);
  fabric.emit(find('button'), 'topLayout', { layout: { x: 0, y: 0, width: 100, height: 40 } });
  touch('button', 'topTouchStart');
  touch('button', 'topTouchMove', 80);
  touch('button', 'topTouchEnd', 80);
  assert.deepEqual(fixture.calls.slice(2), ['in', 'out', 'press']);
  touch('button', 'topTouchStart');
  touch('button', 'topTouchCancel');
  assert.deepEqual(fixture.calls.slice(5), ['in', 'out']);
  touch('button', 'topTouchStart');
  fixture.setDisabled(true);
  touch('button', 'topTouchEnd');
  assert.deepEqual(fixture.calls.slice(7), ['in', 'out']);
  root.dispose();
});

test('long press suppresses press, quick release beats delay, and disposal cancels timers', async () => {
  const { root, fixture, touch, clock } = boot();
  fixture.setLong(true);
  touch('button', 'topTouchStart');
  await new Promise((resolve) => setTimeout(resolve, 15));
  touch('button', 'topTouchEnd');
  assert.deepEqual(fixture.calls, ['in', 'long', 'out']);
  fixture.setLong(false);
  fixture.setDelay(100);
  touch('button', 'topTouchStart');
  touch('button', 'topTouchEnd');
  assert.deepEqual(fixture.calls.slice(3), ['in', 'out', 'press']);
  fixture.setDelay(5);
  touch('button', 'topTouchStart');
  fixture.setVisible(false);
  clock.flushMicrotasks();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(fixture.calls.length, 6);
  root.dispose();
});

test('typed refs cancel queued work when the owner disappears', () => {
  const { root, fixture, clock } = boot();
  let measurements = 0;
  fixture.ref().measure(() => measurements++);
  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.equal(measurements, 0);
  assert.equal(fixture.ref().node.parent, null);
  fixture.ref().measure(() => measurements++);
  clock.flushMicrotasks();
  assert.equal(measurements, 0);
  root.dispose();
});

test('child getters are evaluated once and plain labels acquire press resources only on opt-in', () => {
  const fixture = ownershipFixture(),
    fabric = createFakeFabric(),
    clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.Scene);
  const find = () =>
    flatten(fabric.roots.get(1) ?? []).find((node) => node.props['testID'] === 'optional-press')!;
  assert.equal(fixture.counts.mount, 1);
  assert.equal(find().props['onLayout'], undefined);
  assert.equal(find().props['onPointerEnter'], undefined);
  assert.equal(find().props['onPointerLeave'], undefined);
  const touch = (type: string) =>
    fabric.emit(find(), type, {
      identifier: 1,
      pageX: 1,
      pageY: 1,
      changedTouches: [{ identifier: 1 }],
      touches: type === 'topTouchEnd' ? [] : [{ identifier: 1 }],
    });
  touch('topTouchStart');
  touch('topTouchEnd');
  assert.equal(fabric.responderCalls.length, 0);
  fixture.setOpacity(0.5);
  clock.flushMicrotasks();
  assert.deepEqual(fixture.counts, { mount: 1, cleanup: 0, press: 0 });
  fixture.setPressable(true);
  clock.flushMicrotasks();
  assert.equal(find().props['onLayout'], true);
  touch('topTouchStart');
  touch('topTouchEnd');
  clock.flushMicrotasks();
  assert.equal(fixture.counts.press, 1);
  fixture.setPressable(false);
  clock.flushMicrotasks();
  assert.equal(find().instanceHandle.listeners?.get('topLayout')?.size, 0);
  touch('topTouchStart');
  touch('topTouchEnd');
  assert.equal(fixture.counts.press, 1);
  root.dispose();
  assert.equal(fixture.counts.cleanup, 1);
});

test('replacing a text press callback during a gesture preserves press state and calls the new handler', () => {
  const fixture = pressCallbackFixture(),
    fabric = createFakeFabric(),
    clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.Scene);
  const node = () => fabric.roots.get(1)![0]!;
  fabric.emit(node(), 'topTouchStart', {
    identifier: 1,
    pageX: 1,
    pageY: 1,
    changedTouches: [{ identifier: 1 }],
    touches: [{ identifier: 1 }],
  });
  fixture.replace();
  clock.flushMicrotasks();
  assert.equal(node().props['isHighlighted'], true);
  fabric.emit(node(), 'topTouchEnd', {
    identifier: 1,
    pageX: 1,
    pageY: 1,
    changedTouches: [{ identifier: 1 }],
    touches: [],
  });
  assert.deepEqual(fixture.calls, ['in', 'out', 'new']);
  root.dispose();
});

test('a plain Text creates no press machinery until a press callback arrives', () => {
  const fixture = lazyPressFixture(),
    fabric = createFakeFabric(),
    clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.Scene);
  const node = () => fabric.roots.get(1)![0]!;
  const touch = (type: string) =>
    fabric.emit(node(), type, {
      identifier: 1,
      pageX: 1,
      pageY: 1,
      changedTouches: [{ identifier: 1 }],
      touches: type === 'topTouchEnd' ? [] : [{ identifier: 1 }],
    });
  const plain = fixture.computations();
  assert.equal(node().props['isPressable'], undefined);
  assert.equal(node().instanceHandle.listeners?.get('topLayout'), undefined);
  fixture.gainPress();
  clock.flushMicrotasks();
  // The press machinery: its enabled memo, the responder effect and the disable effect.
  assert.equal(fixture.computations(), plain + 3);
  assert.equal(node().props['isPressable'], true);
  touch('topTouchStart');
  touch('topTouchEnd');
  clock.flushMicrotasks();
  assert.equal(fixture.counts.press, 1);
  fixture.dropPress();
  clock.flushMicrotasks();
  assert.equal(fixture.computations(), plain);
  assert.equal(node().instanceHandle.listeners?.get('topLayout')?.size, 0);
  touch('topTouchStart');
  touch('topTouchEnd');
  assert.equal(fixture.counts.press, 1);
  root.dispose();
});
