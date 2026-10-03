/**
 * A view moved by a scroll on the native side: what the engine asks React Native's animated module
 * to build, checked against a fake that records it, since none of it runs outside a device.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine, pinnedRange, type NativeAnimated } from '@solid-native/fabric';
import { createFakeFabric } from '@solid-native/testing';
import { recorder } from './native-animated.ts';

function scene(native: NativeAnimated | null) {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1, { nativeAnimated: native });
  const scroll = engine.createElement('scroll-view');
  const header = engine.createElement('view');
  engine.appendChild(engine.root, scroll);
  engine.appendChild(scroll, header);
  return { engine, scroll, header };
}

describe('a view driven by a scroll on the native side', () => {
  it('feeds the scroll offset through an interpolation into the view translate', () => {
    const { native, named } = recorder();
    const { engine, scroll, header } = scene(native);
    engine.commit();
    engine.driveByScroll(header, scroll, 'y', pinnedRange(100, 300));

    const [, scrollTag, eventName, mapping] = named('event')[0]!;
    assert.equal(scrollTag, engine.tagOf(scroll));
    assert.equal(eventName, 'onScroll');
    assert.deepEqual((mapping as { nativeEventPath: string[] }).nativeEventPath, [
      'contentOffset',
      'y',
    ]);

    const configs = named('create').map((call) => call[2] as { type: string });
    assert.deepEqual(
      configs.map((config) => config.type),
      ['value', 'interpolation', 'transform', 'style', 'props'],
    );
    // RN's props node on iOS takes its values from a style node, and ignores a transform node
    // wired to it directly, as `Animated` never does.
    const [style, props] = configs.slice(3);
    assert.deepEqual(style, { type: 'style', style: { transform: 3 } });
    assert.deepEqual(props, { type: 'props', props: { style: 4 } });
    assert.deepEqual(configs[1], {
      type: 'interpolation',
      inputRange: [100, 300],
      outputRange: [0, 200],
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    assert.equal(named('toView')[0]![2], engine.tagOf(header));
    assert.ok(named('flush').length > 0, 'and sends it now, not on some later tick');
  });

  it('keeps the view it drives from being flattened away, as Animated does', () => {
    // Fabric flattens a view that only lays out, and native animation has no view to move then.
    const { native } = recorder();
    const { engine, scroll, header } = scene(native);
    engine.driveByScroll(header, scroll, 'y', pinnedRange(0));
    engine.commit();
    assert.equal(header.committed?.props['collapsable'], false);
  });

  it('waits for both views to be committed before it connects', () => {
    const { native, named } = recorder();
    const { engine, scroll, header } = scene(native);
    engine.driveByScroll(header, scroll, 'y', pinnedRange(0, 50));
    assert.equal(named('toView').length, 0, 'nothing has a view tag yet');
    engine.commit();
    assert.equal(named('toView').length, 1);
  });

  it('keeps a static transform beside the driven translate, as a flipped list needs', () => {
    const { native, named } = recorder();
    const { engine, scroll, header } = scene(native);
    engine.commit();
    engine.driveByScroll(header, scroll, 'x', pinnedRange(0), [{ scaleX: -1 }]);
    const transform = named('create')
      .map((call) => call[2] as { type: string; transforms?: unknown[] })
      .find((config) => config.type === 'transform')!;
    assert.deepEqual(transform.transforms, [
      { type: 'animated', property: 'translateX', nodeTag: 2 },
      { type: 'static', property: 'scaleX', value: -1 },
    ]);
  });

  it('shares one offset per scroll view, and lets it go with the last view it drives', () => {
    const { native, named } = recorder();
    const { engine, scroll, header } = scene(native);
    const second = engine.createElement('view');
    engine.appendChild(scroll, second);
    engine.commit();
    const one = engine.driveByScroll(header, scroll, 'y', pinnedRange(0, 50))!;
    const two = engine.driveByScroll(second, scroll, 'y', pinnedRange(50, 100))!;
    assert.equal(named('event').length, 1, 'one scroll event mapping');

    one.stop();
    assert.equal(named('removeEvent').length, 0, 'still driving the second');
    two.stop();
    assert.equal(named('removeEvent').length, 1);
    assert.equal(named('fromView').length, 2);
  });

  it('rebuilds the interpolation for a new range, and does nothing for the same one', () => {
    const { native, named } = recorder();
    const { engine, scroll, header } = scene(native);
    engine.commit();
    const drive = engine.driveByScroll(header, scroll, 'y', pinnedRange(0, 50))!;
    drive.update(pinnedRange(0, 50));
    assert.equal(named('fromView').length, 0);
    drive.update(pinnedRange(10, 60));
    assert.equal(named('fromView').length, 1);
    const interpolations = named('create')
      .map((call) => call[2] as { type: string; inputRange?: number[] })
      .filter((config) => config.type === 'interpolation');
    assert.deepEqual(interpolations.at(-1)!.inputRange, [10, 60]);
  });

  it('is not offered without a native module, so the caller moves the view itself', () => {
    const { engine, scroll, header } = scene(null);
    assert.equal(engine.drivesScroll, false);
    assert.equal(engine.driveByScroll(header, scroll, 'y', pinnedRange(0)), null);
  });
});

describe('a view driven by another native event', () => {
  it('feeds each of the events it names through the same value', () => {
    const { native, named } = recorder();
    const { engine, scroll: source, header: bar } = scene(native);
    engine.commit();
    engine.driveByEvent(
      bar,
      source,
      { events: ['onKeyboardMove', 'onKeyboardMoveInteractive'], path: ['height'] },
      'translateY',
      { input: [34, 10034], output: [0, -10000] },
    );
    const mappings = named('event').map(([, tag, name, mapping]) => [
      tag,
      name,
      (mapping as { nativeEventPath: string[]; animatedValueTag: number }).nativeEventPath,
      (mapping as { animatedValueTag: number }).animatedValueTag,
    ]);
    assert.deepEqual(
      mappings.map((m) => m.slice(0, 3)),
      [
        [engine.tagOf(source), 'onKeyboardMove', ['height']],
        [engine.tagOf(source), 'onKeyboardMoveInteractive', ['height']],
      ],
    );
    assert.equal(mappings[0]![3], mappings[1]![3], 'one value, fed by both');
    const transform = named('create')
      .map((call) => call[2] as { type: string; transforms?: { property: string }[] })
      .find((config) => config.type === 'transform')!;
    assert.equal(transform.transforms![0]!.property, 'translateY');
  });

  it('keeps a scroll offset and a keyboard height from the same view apart', () => {
    const { native, named } = recorder();
    const { engine, scroll, header } = scene(native);
    engine.commit();
    engine.driveByScroll(header, scroll, 'y', pinnedRange(0));
    const lifted = engine.driveByEvent(
      header,
      scroll,
      { events: ['onKeyboardMove'], path: ['height'] },
      'translateY',
      { input: [0, 1], output: [0, -1] },
    )!;
    assert.equal(named('event').length, 2);
    lifted.stop();
    assert.deepEqual(
      named('removeEvent').map((call) => call[2]),
      ['onKeyboardMove'],
    );
  });
});

describe('a driven view shifted by a value JavaScript sets', () => {
  it('adds the shift to the driven translate, and sets it without rebuilding', () => {
    const { native, named } = recorder();
    const { engine, scroll: source, header: view } = scene(native);
    engine.commit();
    const drive = engine.driveByEvent(
      view,
      source,
      { events: ['onKeyboardMove'], path: ['height'] },
      'translateY',
      { input: [0, 100], output: [0, -100] },
      [],
      40,
    )!;
    const configs = new Map(named('create').map(([, tag, config]) => [tag, config]));
    const sum = [...configs].find(([, config]) => (config as { type: string }).type === 'addition');
    assert.ok(sum, 'an addition node');
    const [interpolation, shift] = (sum[1] as { input: number[] }).input;
    assert.equal((configs.get(interpolation) as { type: string }).type, 'interpolation');
    assert.deepEqual(configs.get(shift), { type: 'value', value: 40, offset: 0 });
    const transform = [...configs.values()].find(
      (config) => (config as { type: string }).type === 'transform',
    ) as { transforms: { nodeTag: number }[] };
    assert.equal(transform.transforms[0]!.nodeTag, sum[0]);

    drive.shift(12);
    assert.deepEqual(named('set').at(-1)!.slice(1), [shift, 12]);
    assert.equal(named('fromView').length, 0, 'nothing rebuilt');
  });
});

describe('the range a pinned view moves through', () => {
  it('holds still until its start, follows the scroll, and stops where the next pushes it off', () => {
    assert.deepEqual(pinnedRange(100, 300), { input: [100, 300], output: [0, 200] });
  });

  it('follows the scroll for good when nothing comes after it', () => {
    const range = pinnedRange(40);
    assert.deepEqual(
      range.input.map((v, i) => v - range.output[i]!),
      [40, 40],
    );
  });
});
