import assert from 'node:assert/strict';
import { createNativeRoot } from '@solidnative/platform/solid';
import { registerPlatformComponents } from '@solidnative/fabric';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { canaryStyles } from '../src/app/global-styles.solid.ts';
import type { consumerFixture } from './consumer-fixture.tsx';
export const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

export function bootConsumer(
  fixture: ReturnType<typeof consumerFixture>,
  platform: 'ios' | 'android' = 'ios',
) {
  registerPlatformComponents(platform);
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
  root.render(fixture.Scene);
  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  const renderedText = () =>
    nodes()
      .filter((node) => node.props['text'] !== undefined)
      .map((node) => node.props['text'])
      .join('');
  const propsText = () => JSON.stringify(nodes().map((node) => node.props));
  function finish() {
    for (let count = 0; count < 6; count++) {
      clock.flushMicrotasks();
      for (const stack of nodes().filter((node) => node.viewName === 'RNSScreenStack'))
        fabric.emit(stack, 'topFinishTransitioning');
    }
    clock.flushMicrotasks();
  }
  function press(label: string, scope?: FakeNode) {
    const node = (scope ? flatten([scope]) : nodes()).find(
      (node) =>
        node.instanceHandle.name === 'pressable' &&
        JSON.stringify(flatten(node.children).map((child) => child.props)).includes(label),
    );
    assert.ok(node, label);
    for (const type of ['topTouchStart', 'topTouchEnd']) {
      const touch = { identifier: 1, pageX: 1, pageY: 1 };
      fabric.emit(node, type, {
        ...touch,
        changedTouches: [touch],
        touches: type === 'topTouchEnd' ? [] : [touch],
      });
    }
    clock.flushMicrotasks();
  }
  function input(label: string, text: string, eventCount = 1) {
    const node = nodes().find((node) => node.props['accessibilityLabel'] === label);
    assert.ok(node, label);
    fabric.emit(node, 'topChange', { text, eventCount });
    clock.flushMicrotasks();
  }
  async function waitFor(predicate: () => boolean) {
    for (let count = 0; count < 100; count++) {
      clock.flushMicrotasks();
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.ok(predicate(), 'consumer operation did not settle');
  }
  return { fabric, clock, root, nodes, propsText, renderedText, finish, press, input, waitFor };
}
