import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignal } from 'solid-js';
import { registerPlatformComponents, type EngineNode } from '@solidnative/fabric';
import { createNativeRoot } from '@solidnative/platform/solid';
import { ScrollView } from '../src/solid/scroll-view.ts';
import { View } from '../src/solid/primitive.ts';
import { createFakeFabric, createClock } from '../../platform/solid-tests/fake-fabric.ts';

test('sticky ScrollView retains original indices, geometry, reactive release and cleanup on both platforms', () => {
  for (const platform of ['ios', 'android'] as const) {
    registerPlatformComponents(platform);
    const fabric = createFakeFabric(),
      clock = createClock();
    const root = createNativeRoot({ fabric, clock, rootTag: 1 });
    const [indices, setIndices] = createSignal<readonly number[]>([1]);
    let scroll!: EngineNode, header!: EngineNode;
    root.render(() =>
      ScrollView({
        ref: (value) => {
          scroll = value.node as EngineNode;
        },
        get stickyHeaderIndices() {
          return indices();
        },
        scrollEventThrottle: 32,
        get children() {
          return [
            View({}),
            View({
              ref: (value) => {
                header = value.node as EngineNode;
              },
            }),
          ];
        },
      }),
    );
    clock.flushMicrotasks();
    assert.equal(scroll.props['scrollEventThrottle'], 1);
    assert.equal(header.props['zIndex'], 10);
    root.engine.dispatchEvent(header, 'topLayout', {
      layout: { x: 0, y: 80, width: 100, height: 40 },
    });
    root.engine.dispatchEvent(scroll, 'topScroll', { contentOffset: { x: 0, y: 120 } });
    assert.deepEqual(header.props['transform'], [{ translateY: 40 }]);
    setIndices([]);
    clock.flushMicrotasks();
    assert.equal(scroll.props['scrollEventThrottle'], 32);
    assert.equal(header.props['zIndex'], undefined);
    assert.equal(header.props['transform'], undefined);
    root.dispose();
    clock.flushMicrotasks();
  }
});
