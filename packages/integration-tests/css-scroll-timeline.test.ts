/**
 * Scroll-driven animations: `animation-timeline: scroll()`, played by a scroll view's offset on
 * the native side rather than by the clock.
 *
 * The keyframes become interpolations from the offset, eased by sampling the timing function, fed
 * by the nearest scroll view's scroll events, so a collapsing header or a reading-progress bar
 * follows the finger frame for frame with no JavaScript in between. What native builds is checked
 * here by working the recorded graph out at a given offset, as the device would.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, type EngineNode, type StyleSheet } from '@solidnative/fabric';
import { createFakeFabric } from '@solidnative/testing';
import { recorder } from './native-animated.ts';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

type Config = Record<string, unknown> & { type: string };

/** A view with `classes` inside a scroll view, under `css`, with native animation recorded. */
function scene(css: string, classes = 'a', options: { inScroll?: boolean } = {}) {
  const rec = recorder();
  const fabric = createFakeFabric();
  const errors: unknown[][] = [];
  const engine = new Engine(fabric, 1, {
    globalStyles: compileCss(css) as StyleSheet,
    nativeAnimated: rec.native,
    dev: true,
  });
  const scroll = engine.createElement('scroll-view');
  const view = engine.createElement('view');
  engine.setClasses(view, classes);
  engine.appendChild(engine.root, options.inScroll === false ? view : scroll);
  if (options.inScroll !== false) engine.appendChild(scroll, view);
  const originalError = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    engine.commit();
    engine.commit();
  } finally {
    console.error = originalError;
  }

  /** What native paints on the view at a scroll offset, worked out from the recorded graph. */
  const at = (offset: number) => {
    const configs = new Map<unknown, Config>(
      rec.named('create').map(([, tag, config]) => [tag, config as Config]),
    );
    const live = new Map<unknown, unknown>();
    for (const [name, props, viewTag] of rec.calls) {
      if (name === 'toView') live.set(viewTag, props);
      if (name === 'fromView' && live.get(viewTag) === props) live.delete(viewTag);
    }
    const propsTag = live.get(engine.tagOf(view));
    if (propsTag === undefined) return null;
    const evaluate = (tag: unknown): number => {
      const config = configs.get(tag)!;
      if (config.type === 'value') return offset;
      if (config.type === 'interpolation') {
        const parent = rec.named('connect').find(([, , child]) => child === tag)![1];
        return interpolate(
          evaluate(parent),
          config['inputRange'] as number[],
          config['outputRange'] as number[],
        );
      }
      throw new Error(`no evaluator for ${config.type}`);
    };
    const props = configs.get(propsTag)!;
    const style = configs.get((props['props'] as { style: unknown }).style)!;
    const out: Record<string, unknown> = {};
    for (const [key, tag] of Object.entries(style['style'] as Record<string, unknown>)) {
      if (key !== 'transform') {
        out[key] = round(evaluate(tag));
        continue;
      }
      const transform = configs.get(tag)!;
      out['transform'] = (
        transform['transforms'] as {
          type: string;
          property: string;
          nodeTag?: unknown;
          value?: number;
        }[]
      ).map((entry) => ({
        [entry.property]: round(entry.type === 'animated' ? evaluate(entry.nodeTag) : entry.value!),
      }));
    }
    return out;
  };

  const scrolled = (event: object) => engine.dispatchEvent(scroll, 'topScroll', event);
  return { engine, scroll, view: view as EngineNode, rec, at, scrolled, errors };
}

function interpolate(x: number, input: number[], output: number[]): number {
  if (x <= input[0]!) return output[0]!;
  if (x >= input.at(-1)!) return output.at(-1)!;
  let i = 0;
  while (x > input[i + 1]!) i++;
  const span = input[i + 1]! - input[i]!;
  const t = span === 0 ? 1 : (x - input[i]!) / span;
  return output[i]! + (output[i + 1]! - output[i]!) * t;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

const FADE = '@keyframes fade { from { opacity: 1 } to { opacity: 0 } }';

describe('animation-timeline: scroll(), compiled', () => {
  it('names the axis and the range the spec plays over', () => {
    const [rule] = compileCss(
      `${FADE} .a { animation: fade linear both; animation-timeline: scroll(); animation-range: 0 120px; }`,
    ).rules;
    const spec = rule.declarations.$animation;
    assert.equal(spec.timeline, 'y');
    assert.deepEqual(spec.range, { start: 0, end: 120 });
  });

  it('reads the inline axis as x, and a range as its two longhands', () => {
    const [rule] = compileCss(
      `${FADE} .a { animation: fade linear both; animation-timeline: scroll(nearest inline); animation-range-start: 20px; animation-range-end: 50%; }`,
    ).rules;
    const spec = rule.declarations.$animation;
    assert.equal(spec.timeline, 'x');
    assert.deepEqual(spec.range, { start: 20, end: '50%' });
  });

  it('refuses what native has nothing to drive it by, saying so', () => {
    const refused = (declaration: string) => {
      const reasons: string[] = [];
      compileCss(`${FADE} .a { animation: fade linear both; ${declaration} }`, 'p', {
        onUnsupported: (message: string) => reasons.push(message),
      });
      return reasons.join(' ');
    };
    assert.match(refused('animation-timeline: view();'), /view\(\)/);
    assert.match(refused('animation-timeline: scroll(root);'), /nearest/);
    assert.match(refused('animation-timeline: --hero;'), /named/);
    assert.match(
      refused('animation-timeline: scroll(); animation-range: entry 0% cover 50%;'),
      /view\(\)/,
    );
  });
});

describe('a scroll-driven animation on the native side', () => {
  const css = `${FADE} .a { animation: fade linear both; animation-timeline: scroll(); animation-range: 0 100px; }`;

  it('follows the scroll view offset across its range, and holds past both ends', () => {
    const { at } = scene(css);
    assert.deepEqual(at(0), { opacity: 1 });
    assert.deepEqual(at(50), { opacity: 0.5 });
    assert.deepEqual(at(100), { opacity: 0 });
    assert.deepEqual(at(400), { opacity: 0 });
    assert.deepEqual(at(-60), { opacity: 1 });
  });

  it('is fed by the nearest scroll view, along its axis', () => {
    const { rec, engine, scroll } = scene(css);
    const [, tag, name, mapping] = rec.named('event')[0]!;
    assert.equal(tag, engine.tagOf(scroll));
    assert.equal(name, 'onScroll');
    assert.deepEqual((mapping as { nativeEventPath: string[] }).nativeEventPath, [
      'contentOffset',
      'y',
    ]);
  });

  it('commits the first frame once and leaves the rest to native', () => {
    const { view, engine, scrolled } = scene(css);
    assert.equal(view.committed?.props['opacity'], 1);
    assert.equal(view.committed?.props['collapsable'], false);
    scrolled({
      contentOffset: { x: 0, y: 60 },
      contentSize: { width: 400, height: 2000 },
      layoutMeasurement: { width: 400, height: 800 },
    });
    engine.commit();
    assert.equal(view.committed?.props['opacity'], 1);
  });

  it('eases each segment by its timing function', () => {
    const eased = `${FADE} .a { animation: fade ease-in both; animation-timeline: scroll(); animation-range: 0 100px; }`;
    const opacity = scene(eased).at(50)!['opacity'] as number;
    // ease-in is cubic-bezier(0.42, 0, 1, 1): a third of the way at the halfway mark.
    assert.ok(Math.abs(opacity - (1 - 0.3153)) < 0.01, `${opacity}`);
  });

  it('eases a segment by its own keyframe timing function, over a linear animation', () => {
    // The keyframe's `animation-timing-function` eases the stretch it starts, as on the clock.
    const eased =
      '@keyframes fade { from { opacity: 1; animation-timing-function: ease-in } to { opacity: 0 } }' +
      ' .a { animation: fade linear both; animation-timeline: scroll(); animation-range: 0 100px; }';
    const opacity = scene(eased).at(50)!['opacity'] as number;
    assert.ok(Math.abs(opacity - (1 - 0.3153)) < 0.01, `${opacity}`);
  });

  it('drives transforms: a transform list, and translate, rotate and scale', () => {
    const list = scene(
      '@keyframes shrink { to { transform: translateY(-40px) scale(0.8) } } .a { animation: shrink linear both; animation-timeline: scroll(); animation-range: 0 200px; }',
    );
    assert.deepEqual(list.at(100), {
      transform: [{ translateY: -20 }, { scaleX: 0.9 }, { scaleY: 0.9 }],
    });

    const individual = scene(
      '@keyframes lift { to { translate: 0 -30px; rotate: 90deg; scale: 2 } } .a { animation: lift linear both; animation-timeline: scroll(); animation-range: 0 100px; }',
    );
    assert.deepEqual(individual.at(100), {
      transform: [
        { translateX: 0 },
        { translateY: -30 },
        { rotate: round(Math.PI / 2) },
        { scaleX: 2 },
        { scaleY: 2 },
      ],
    });
  });

  it('with no range, plays over the whole scroll, once the scroll view says how far that is', () => {
    const whole = `${FADE} .a { animation: fade linear both; animation-timeline: scroll(); }`;
    const { at, scrolled } = scene(whole);
    assert.deepEqual(at(0), { opacity: 1 });
    scrolled({
      contentOffset: { x: 0, y: 10 },
      contentSize: { width: 400, height: 1200 },
      layoutMeasurement: { width: 400, height: 800 },
    });
    assert.deepEqual(at(200), { opacity: 0.5 });
    assert.deepEqual(at(400), { opacity: 0 });
  });

  it('reads a percentage of the range as a share of the whole scroll', () => {
    const half = `${FADE} .a { animation: fade linear both; animation-timeline: scroll(); animation-range: 0% 50%; }`;
    const { at, scrolled } = scene(half);
    scrolled({
      contentOffset: { x: 0, y: 0 },
      contentSize: { width: 400, height: 1200 },
      layoutMeasurement: { width: 400, height: 800 },
    });
    assert.deepEqual(at(100), { opacity: 0.5 });
    assert.deepEqual(at(200), { opacity: 0 });
  });

  it('without a fill, shows the resting style outside its range', () => {
    const unfilled = `${FADE} .a { opacity: 0.9; animation: fade linear; animation-timeline: scroll(); animation-range: 100px 200px; }`;
    const { at } = scene(unfilled);
    assert.deepEqual(at(50), { opacity: 0.9 });
    assert.deepEqual(at(150), { opacity: 0.5 });
    assert.deepEqual(at(260), { opacity: 0.9 });
  });

  it('stops when the rule that asked for it no longer applies', () => {
    const { at, engine, view } = scene(css);
    assert.ok(at(0));
    engine.setClasses(view, '');
    engine.commit();
    assert.equal(at(0), null);
  });

  it('outside a scroll view, shows its first frame and says why it does not move', () => {
    const { view, errors } = scene(css, 'a', { inScroll: false });
    assert.equal(view.committed?.props['opacity'], 1);
    assert.match(String(errors.flat().join(' ')), /scroll view/);
  });
});
