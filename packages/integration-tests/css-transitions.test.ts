/**
 * CSS transitions, the build-time half.
 *
 * React Native has no CSS animation of any kind: `transitionProperty` appears nowhere in its
 * JavaScript, and `enableNativeCSSParsing` is about parsing values rather than animating them.
 * So a transition is compiled to a spec the engine reads, and the engine drives it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, interpolate, type StyleSheet } from '@solidnative/fabric';
import { createFakeFabric, type FakeFabricNode } from '@solidnative/testing';

const require = createRequire(import.meta.url);
const flatten = (n: FakeFabricNode[]): FakeFabricNode[] =>
  n.flatMap((x) => [x, ...flatten(x.children)]);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

const declarationsOf = (css: string): Record<string, unknown> =>
  compileCss(`view { ${css} }`).rules[0].declarations;

const transitionOf = (css: string) =>
  declarationsOf(css)['$transition'] as Record<
    string,
    { duration: number; delay: number; easing: number[] }
  >;

describe('compiling a transition', () => {
  it('keys the spec by the React Native prop the property compiles to', () => {
    const spec = transitionOf('transition: background-color 200ms;');
    assert.deepEqual(Object.keys(spec), ['backgroundColor']);
    assert.equal(spec['backgroundColor']!.duration, 200);
  });

  it('reads durations and delays in both units, in milliseconds', () => {
    const spec = transitionOf('transition: opacity 1s linear 0.25s;');
    assert.equal(spec['opacity']!.duration, 1000);
    assert.equal(spec['opacity']!.delay, 250);
  });

  it('takes every property in the list', () => {
    const spec = transitionOf('transition: opacity 200ms, width 300ms;');
    assert.deepEqual(Object.keys(spec).sort(), ['opacity', 'width']);
    assert.equal(spec['width']!.duration, 300);
  });

  /** The engine has no CSS keywords in it, so easing arrives as the curve itself. */
  it('resolves a timing keyword to its bezier, and defaults to ease', () => {
    assert.deepEqual(
      transitionOf('transition: opacity 1s linear;')['opacity']!.easing,
      [0, 0, 1, 1],
    );
    assert.deepEqual(
      transitionOf('transition: opacity 1s ease-in-out;')['opacity']!.easing,
      [0.42, 0, 0.58, 1],
    );
    assert.deepEqual(
      transitionOf('transition: opacity 1s;')['opacity']!.easing,
      [0.25, 0.1, 0.25, 1],
    );
  });

  it('uses the curves CSS defines for ease-in and ease-out', () => {
    assert.deepEqual(
      transitionOf('transition: opacity 1s ease-in;')['opacity']!.easing,
      [0.42, 0, 1, 1],
    );
    assert.deepEqual(
      transitionOf('transition: opacity 1s ease-out;')['opacity']!.easing,
      [0, 0, 0.58, 1],
    );
  });

  it('keys a logical property by the React Native prop it becomes', () => {
    assert.deepEqual(Object.keys(transitionOf('transition: inset-inline-start 1s;')), ['start']);
  });

  it('passes an explicit cubic-bezier through', () => {
    const easing = transitionOf('transition: opacity 1s cubic-bezier(0.2, 0, 0.3, 1);')['opacity']!
      .easing;
    assert.equal(easing.length, 4);
    assert.ok(Math.abs(easing[0]! - 0.2) < 1e-6);
    assert.ok(Math.abs(easing[3]! - 1) < 1e-6);
  });

  it('keeps `all`, which the engine reads as "any property that changed"', () => {
    assert.deepEqual(Object.keys(transitionOf('transition: all 120ms;')), ['all']);
  });

  it('refuses a step function rather than approximating it', () => {
    assert.throws(
      () => declarationsOf('transition: opacity 1s steps(4, end);'),
      /steps/,
      'a step easing is not a curve, and pretending otherwise animates the wrong thing',
    );
  });

  it('reads the longhands, which is the only form Tailwind emits', () => {
    // `transition-colors` and every other `transition-*` utility compile to these three, never to
    // the shorthand, so refusing them meant refusing the whole utility family.
    const spec = transitionOf(
      'transition-property: opacity; transition-duration: 200ms; ' +
        'transition-timing-function: linear; transition-delay: 50ms;',
    );
    assert.deepEqual(Object.keys(spec), ['opacity']);
    assert.equal(spec['opacity']!.duration, 200);
    assert.equal(spec['opacity']!.delay, 50);
    assert.deepEqual(spec['opacity']!.easing, [0, 0, 1, 1]);
  });

  it('repeats a shorter list to the length of the property list, as the spec says', () => {
    // This is the rule the shorthand let us avoid implementing, and the reason the longhands were
    // refused. Two durations across three properties means the third gets the first again.
    const spec = transitionOf(
      'transition-property: opacity, width, height; transition-duration: 100ms, 200ms;',
    );
    assert.equal(spec['opacity']!.duration, 100);
    assert.equal(spec['width']!.duration, 200);
    assert.equal(spec['height']!.duration, 100, 'the list cycles rather than running out');
  });

  it('defaults the parts that were not given', () => {
    const spec = transitionOf('transition-property: opacity;');
    assert.equal(spec['opacity']!.duration, 0);
    assert.equal(spec['opacity']!.delay, 0);
    assert.deepEqual(spec['opacity']!.easing, [0.25, 0.1, 0.25, 1], 'ease, as CSS says');
  });

  it('keeps timing written without a property, for the rule that names one', () => {
    // On the web `.transition` and `.duration-700` on one element run for 700ms: the longhands
    // cascade one at a time, so a rule can set a duration for a property list another rule
    // names. Tailwind's `duration-*`, `ease-*` and `delay-*` are all written this way.
    assert.deepEqual(
      declarationsOf(
        'transition-duration: 200ms; transition-timing-function: linear; transition-delay: 1s;',
      ),
      { $transitionDuration: 200, $transitionEasing: [0, 0, 1, 1], $transitionDelay: 1000 },
    );
  });

  it('writes each part a transition rule sets as its own longhand too', () => {
    // A shorthand writes all four longhands, so a duration from a weaker rule no longer applies,
    // and a stronger rule that writes only the properties still has this one's timing.
    assert.deepEqual(
      Object.entries(declarationsOf('transition: opacity 1s;')).filter(
        ([key]) => key.startsWith('$transition') && key !== '$transition',
      ),
      [
        ['$transitionDuration', 1000],
        ['$transitionEasing', [0.25, 0.1, 0.25, 1]],
        ['$transitionDelay', 0],
      ],
    );
    // A list pairs with this rule's own properties, so it replaces a weaker part and no more.
    assert.equal(
      declarationsOf('transition-property: opacity, color; transition-duration: 1s, 2s;')[
        '$transitionDuration'
      ],
      null,
    );
    // `transition-property` alone writes only itself, and leaves the others to the cascade.
    assert.deepEqual(Object.keys(declarationsOf('transition-property: opacity;')), ['$transition']);
  });

  it('refuses a timing list written without a property list to size it', () => {
    // Which entry of the list goes with which property depends on a property list in another
    // rule, and the compiled spec no longer knows the order. Tailwind never writes one.
    assert.throws(() => declarationsOf('transition-duration: 100ms, 200ms;'), /list/);
  });

  it('lets the longhands and the shorthand share a rule, last one winning', () => {
    const spec = transitionOf('transition: opacity 1s; transition-duration: 200ms;');
    assert.equal(spec['opacity']!.duration, 200);
  });

  it('resets the longhands with a shorthand written after them', () => {
    const spec = transitionOf('transition-duration: 200ms; transition: opacity 1s;');
    assert.equal(spec['opacity']!.duration, 1000);
  });

  it('lets a longhand after the shorthand set a part back to zero', () => {
    // A zero delay is still a value. Treating it as absent kept the shorthand's 500ms.
    const spec = transitionOf('transition: opacity 1s 500ms; transition-delay: 0s;');
    assert.equal(spec['opacity']!.delay, 0);
    assert.equal(
      transitionOf('transition: opacity 1s; transition-duration: 0s;')['opacity']!.duration,
      0,
    );
  });

  it("pairs a later transition-property with the shorthand's timing", () => {
    const spec = transitionOf('transition: opacity 1s linear; transition-property: width;');
    assert.deepEqual(Object.keys(spec), ['width']);
    assert.equal(spec['width']!.duration, 1000);
    assert.deepEqual(spec['width']!.easing, [0, 0, 1, 1]);
  });

  it('reads the individual transform properties, which is what Tailwind writes', () => {
    // `translate-x-4` is `translate: 1rem 0`, not `transform: translateX(1rem)`. Native has no
    // such property, only the list, so each is kept under a key of its own and the engine builds
    // the list from them - and a switch thumb styled with Tailwind does not move at all without
    // this. See css-individual-transforms.test.ts for how they combine.
    assert.deepEqual(declarationsOf('translate: 0.875rem 0;')['__translate'], [
      { translateX: 14 },
      { translateY: 0 },
    ]);
    assert.deepEqual(declarationsOf('scale: 1.5;')['__scale'], [{ scaleX: 1.5 }, { scaleY: 1.5 }]);
    assert.deepEqual(declarationsOf('rotate: 45deg;')['__rotate'], [{ rotate: '45deg' }]);
  });

  it('reads none on an individual transform as no operation at all', () => {
    // Tailwind's `scale-none` and `rotate-none`. They used to crash the compiler outright, with a
    // TypeError onUnsupported could not catch, which took the whole Tailwind build down; and
    // `translate: none` added two empty operations, which makes Fabric discard the whole list.
    // It is null, which is no operation but still a value, so it overrides a weaker rule's.
    for (const [none, key] of [
      ['scale', '__scale'],
      ['rotate', '__rotate'],
      ['translate', '__translate'],
    ]) {
      assert.deepEqual(declarationsOf(`${none}: none`), { [key]: null });
    }
  });

  it('rotates about the axis a rotate names, not always about z', () => {
    // `rotate: x 45deg` compiled to a flat `rotate`, turning the element the wrong way silently.
    assert.deepEqual(declarationsOf('rotate: x 45deg;')['__rotate'], [{ rotateX: '45deg' }]);
    assert.deepEqual(declarationsOf('rotate: y 45deg;')['__rotate'], [{ rotateY: '45deg' }]);
    assert.deepEqual(declarationsOf('rotate: z 45deg;')['__rotate'], [{ rotate: '45deg' }]);
    assert.throws(() => declarationsOf('rotate: 1 1 0 45deg;'), /axis/);
  });

  it('rounds the curve, which arrives as f32 noise', () => {
    // `cubic-bezier(.4, 0, .2, 1)` is what Tailwind writes on every transition utility, and it
    // reaches here as 0.4000000059604645. Unrounded it ships that way in every bundle.
    assert.deepEqual(
      transitionOf('transition: opacity 1s cubic-bezier(0.4, 0, 0.2, 1);')['opacity']!.easing,
      [0.4, 0, 0.2, 1],
    );
  });

  it('leaves custom properties out, since nothing here can animate one', () => {
    // Tailwind's `transition-colors` lists four gradient slots among its properties. They are
    // custom properties, the engine animates native props, and carrying them is bundle weight.
    const spec = transitionOf(
      'transition-property: opacity, --tw-gradient-from; transition-duration: 100ms;',
    );
    assert.deepEqual(Object.keys(spec), ['opacity']);
  });

  it('keeps `all` through the longhand form too', () => {
    assert.deepEqual(Object.keys(transitionOf('transition-property: all;')), ['all']);
  });

  it('keys a shorthand by every prop it compiles to', () => {
    // `transition-colors` names `border-color`, and `padding` is how a transition on spacing is
    // written. Each compiles to one prop per side, and a spec keyed `padding` matched none.
    const keys = (css: string) => Object.keys(transitionOf(css)).sort();
    assert.deepEqual(keys('transition: padding 1s;'), [
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
    ]);
    assert.deepEqual(keys('transition: border-color 1s;'), [
      'borderBottomColor',
      'borderLeftColor',
      'borderRightColor',
      'borderTopColor',
    ]);
    assert.deepEqual(keys('transition: background 1s;'), ['backgroundColor']);
    assert.deepEqual(keys('transition: gap 1s;'), ['columnGap', 'rowGap']);
    assert.deepEqual(keys('transition: inset 1s;'), ['bottom', 'left', 'right', 'top']);
    assert.equal(transitionOf('transition: margin 250ms;')['marginTop']!.duration, 250);
  });
});

/**
 * The runtime half. The engine owns the clock so a test can step it exactly; on a device the
 * platform pumps it from `requestAnimationFrame`.
 */
describe('running a transition', () => {
  const sheet = (css: string) => compileCss(css) as StyleSheet;

  /** A node with a stylesheet attached, and a clock the test drives. */
  function scene(css: string) {
    let now = 1000;
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, {
      globalStyles: sheet(css),
      now: () => now,
    });
    const view = engine.createElement('view');
    engine.appendChild(engine.root, view);
    engine.commit();

    const painted = (prop: string) =>
      engine.tagOf(view) !== null ? flatten(fabric.committed)[0]!.props[prop] : undefined;

    return {
      engine,
      view,
      painted,
      /** Move the clock and let the engine catch up, the way a frame would. */
      tick(ms: number) {
        now += ms;
        const more = engine.advanceAnimations();
        engine.commit();
        return more;
      },
      classes(value: string) {
        engine.setClasses(view, value);
        engine.commit();
      },
    };
  }

  const css = `
    view { opacity: 1; background-color: rgb(0, 0, 0); width: 10px; transition: opacity 100ms linear, background-color 100ms linear; }
    view.faded { opacity: 0; background-color: rgb(100, 200, 40); width: 50px; }
  `;

  it('does not animate what is there on the first commit', () => {
    const s = scene(css);
    assert.equal(s.painted('opacity'), 1, 'the starting value, not a transition from nothing');
    assert.equal(s.engine.animating, false);
  });

  it('holds the old value when the class lands, rather than jumping', () => {
    const s = scene(css);
    s.classes('faded');
    assert.equal(s.painted('opacity'), 1, 'still the old value on the commit that changed it');
    assert.equal(s.engine.animating, true);
  });

  it('interpolates towards the new value and lands exactly on it', () => {
    const s = scene(css);
    s.classes('faded');

    assert.equal(s.tick(50), true, 'still running');
    assert.equal(s.painted('opacity'), 0.5, 'halfway, on a linear curve');

    assert.equal(s.tick(50), false, 'and done');
    assert.equal(s.painted('opacity'), 0, 'exactly the target, not an interpolated near-miss');
    assert.equal(s.engine.animating, false);
  });

  it('changes a value it cannot interpolate at once, rather than at the end', () => {
    // Tailwind's `transition` and `transition-all` both cover `display`. A discrete value does not
    // transition on the web, so `hidden` hides at once; holding it for the duration left the
    // element on screen and then made it vanish.
    const s = scene(`
      view { display: flex; flex-direction: row; transition: all 100ms linear; }
      view.gone { display: none; flex-direction: column; }
    `);
    s.classes('gone');
    assert.equal(s.painted('display'), 'none');
    assert.equal(s.painted('flexDirection'), 'column');
    assert.equal(s.engine.animating, false);
  });

  it('transitions every side a shorthand names', () => {
    const s = scene(`
      view { padding: 0; transition: padding 100ms linear; }
      view.open { padding: 20px; }
    `);
    s.classes('open');
    s.tick(50);
    assert.equal(s.painted('paddingTop'), 10, 'halfway');
    assert.equal(s.painted('paddingLeft'), 10);
  });

  it('interpolates a percentage, which is how a bar fills up', () => {
    // A progress indicator's width is a percentage of a track whose size nothing here knows, so
    // the value that changes is a string. Without this it snapped from one width to the next and
    // `transition-all` on it did nothing at all.
    assert.equal(interpolate('0%', '100%', 0.25), '25%');
    assert.equal(interpolate('20%', '40%', 0.5), '30%');
  });

  it('slides a percentage width through the engine, which is what a progress bar is', () => {
    // End to end rather than through `interpolate` alone: the width arrives as a string from the
    // cascade, the transition machinery has to recognise it as something it can move, and the
    // value painted halfway has to be a percentage the native side will accept.
    const s = scene(`
      view { width: 0%; transition: width 100ms linear; }
      view.filled { width: 80%; }
    `);
    s.classes('filled');
    assert.equal(s.painted('width'), '0%', 'holds the old value on the commit that changed it');

    s.tick(50);
    assert.equal(s.painted('width'), '40%', 'halfway');

    s.tick(50);
    assert.equal(s.painted('width'), '80%', 'and lands exactly on it');
  });

  it('leaves a percentage and a number alone rather than guessing', () => {
    // They are not on the same scale, and stepping is what CSS does when it cannot interpolate.
    assert.equal(interpolate('50%', 100, 0.5), '50%');
  });

  it('interpolates colours, which is what most transitions are for', () => {
    const s = scene(css);
    s.classes('faded');
    s.tick(50);
    assert.equal(s.painted('backgroundColor'), 'rgba(50, 100, 20, 1)');
  });

  it('interpolates a named colour the same way, not step, on either end', () => {
    // The compiler resolves every named colour in a stylesheet at build time, so this is for the
    // rarer case: a template binding a keyword straight into a style, which reaches here as the
    // word itself rather than as the rgb() the CSS compiler would have already turned it into.
    assert.equal(interpolate('red', 'blue', 0.5), 'rgba(128, 0, 128, 1)');
    assert.equal(interpolate('white', 'rgb(0, 0, 0)', 0.5), 'rgba(128, 128, 128, 1)');
    assert.equal(interpolate('rebeccapurple', 'rebeccapurple', 0.5), 'rgba(102, 51, 153, 1)');
  });

  it('steps a word that is not a real CSS colour, rather than guessing', () => {
    assert.equal(interpolate('bloo', 'rgb(0, 0, 0)', 0.5), 'bloo');
  });

  it('jumps to auto rather than pinning the old value for the duration', () => {
    // `transition: height` on a section that opens to a height nothing has measured yet. CSS does
    // not animate to or from `auto` either, and the alternative here is worse than not animating:
    // there is no value between `0` and "however tall this turns out to be", so the interpolation
    // fell through to holding `0` - and a section that opens to nothing reads as broken, not as
    // unanimated. It stayed that way on a phone, because clearing a height also stops the layout
    // that would have corrected it.
    const s = scene(`view { transition: height 100ms linear; }`);
    s.engine.setProp(s.view, 'height', 0);
    s.engine.commit();
    s.engine.setProp(s.view, 'height', null);
    s.engine.commit();

    assert.equal(s.painted('height'), null, 'auto immediately');
    assert.equal(s.engine.animating, false, 'and nothing left running');
  });

  it('jumps away from auto the same way', () => {
    const s = scene(`view { transition: height 100ms linear; }`);
    s.engine.setProp(s.view, 'height', 40);
    s.engine.commit();
    assert.equal(s.painted('height'), 40, 'not interpolated from a value that was never a number');
  });

  it('animates normally once both ends are real, which is the second open', () => {
    // The point of keeping the transition: the height is only unknown the first time.
    const s = scene(`view { transition: height 100ms linear; }`);
    s.engine.setProp(s.view, 'height', 0);
    s.engine.commit();
    s.engine.setProp(s.view, 'height', 80);
    s.engine.commit();
    s.tick(50);
    assert.equal(s.painted('height'), 40);
  });

  it('leaves a property with no transition to jump', () => {
    const s = scene(css);
    s.classes('faded');
    assert.equal(s.painted('width'), 50, 'width was not in the transition list');
  });

  it('never sends the spec itself to native', () => {
    const s = scene(css);
    assert.equal(s.painted('transition'), undefined);
  });

  it('waits out the delay on the old value, then runs for the whole duration', () => {
    const s = scene(
      `view { opacity: 1; transition: opacity 100ms linear 50ms; } view.faded { opacity: 0; }`,
    );
    s.classes('faded');
    assert.equal(s.tick(25), true, 'still waiting, which is still animating');
    assert.equal(s.painted('opacity'), 1);
    assert.equal(s.tick(75), true);
    assert.equal(s.painted('opacity'), 0.5, 'halfway through the duration, after the delay');
    assert.equal(s.tick(50), false);
    assert.equal(s.painted('opacity'), 0);
  });

  it('takes its timing from another rule that sets only the timing', () => {
    // `transition duration-200 ease-linear delay-50`: four classes, one transition.
    const s = scene(
      `view { opacity: 1; transition: opacity 1s ease; }
       view.timed { transition-duration: 200ms; transition-timing-function: linear; transition-delay: 50ms; }
       view.faded { opacity: 0; }`,
    );
    s.classes('timed');
    s.classes('timed faded');
    s.tick(50);
    assert.equal(s.tick(100), true);
    assert.equal(s.painted('opacity'), 0.5, 'halfway through 200ms, linear, after the delay');
    assert.equal(s.tick(100), false);
    assert.equal(s.painted('opacity'), 0);
  });

  it('lets a stronger transition rule reset timing a weaker rule set', () => {
    const s = scene(
      `view { opacity: 1; }
       view.timed { transition-duration: 200ms; }
       view.timed.own { transition: opacity 400ms linear; }
       view.own.faded { opacity: 0; }`,
    );
    s.classes('timed own');
    s.classes('timed own faded');
    s.tick(200);
    assert.equal(s.painted('opacity'), 0.5, 'its own 400ms, not the 200ms beneath it');
  });

  it("keeps a weaker rule's timing when a stronger one names only the properties", () => {
    // The longhands cascade one at a time: the stronger rule's list, the weaker rule's timing.
    const s = scene(
      `view { opacity: 1; }
       view.slow { transition-property: opacity; transition-duration: 400ms; transition-timing-function: linear; }
       view.slow.named { transition-property: opacity, background-color; }
       view.faded { opacity: 0; }`,
    );
    s.classes('slow named');
    s.classes('slow named faded');
    s.tick(200);
    assert.equal(s.painted('opacity'), 0.5, "the weaker rule's 400ms linear, not no transition");
  });

  it('never sends the separate timing to native', () => {
    const s = scene(
      `view { opacity: 1; transition: opacity 1s; } view.timed { transition-duration: 2s; }`,
    );
    s.classes('timed');
    assert.equal(s.painted('$transitionDuration'), undefined);
  });

  it('jumps straight to the new value when the duration is zero', () => {
    const s = scene(`view { opacity: 1; transition: opacity 0s; } view.faded { opacity: 0; }`);
    s.classes('faded');
    assert.equal(s.painted('opacity'), 0);
    assert.equal(s.engine.animating, false);
  });

  it('announces its end with the property that finished', () => {
    const s = scene(css);
    const ended: unknown[] = [];
    s.engine.setEventListener(s.view, 'topTransitionend', (event) =>
      ended.push((event as { propertyName: string }).propertyName),
    );
    s.classes('faded');
    s.tick(50);
    assert.deepEqual(ended, []);
    s.tick(50);
    assert.deepEqual(ended.sort(), ['backgroundColor', 'opacity']);
  });

  // What a framework's leave hook needs is the engine knowing it is mid-transition.
  it('reports itself as running only until it lands', () => {
    const s = scene(css);
    s.classes('faded');
    s.tick(50);
    assert.equal(s.engine.animating, true);
    s.tick(50);
    assert.equal(s.engine.animating, false);
  });

  it('stops animating a node destroyed mid-flight', () => {
    const s = scene(css);
    s.classes('faded');
    assert.equal(s.engine.animating, true);
    s.engine.removeChild(s.engine.root, s.view);
    s.engine.destroyNode(s.view);
    assert.equal(s.engine.animating, false, 'no frame loop for a node that is gone');
  });

  it('redirects mid-flight from wherever it had got to', () => {
    const s = scene(css);
    s.classes('faded');
    s.tick(50);
    s.classes('');

    assert.equal(s.painted('opacity'), 0.5, 'no jump when the target changes');
    s.tick(50);
    assert.equal(s.painted('opacity'), 0.75, 'halfway back from where it was, not from 0');
  });

  it('reads `all` as whatever changed', () => {
    const s = scene(`
      view { opacity: 1; transition: all 100ms linear; }
      view.faded { opacity: 0; }
    `);
    s.classes('faded');
    s.tick(50);
    assert.equal(s.painted('opacity'), 0.5);
  });
});

/**
 * Transforms, which are the one style value worth interpolating that is not a number.
 *
 * They arrive as RN's list of single-key operations - `[{ translateX: 180 }]` - so the general
 * "numbers and colours, everything else is discrete" rule left them stepping to the end value and
 * snapping. On screen that is a box sitting still for the whole duration and then arriving, which
 * reads as a transition that does not work rather than one that is not interpolating.
 */
/**
 * The same thing through the engine, which is where it matters: a class toggled on, a transform
 * appearing, and the box moving rather than waiting out the duration and arriving.
 */
describe('transitioning a transform', () => {
  it('slides rather than snapping when a class adds one', () => {
    let now = 1000;
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, {
      globalStyles: compileCss(`
        view { transition: transform 100ms linear }
        view.moved { transform: translateX(180px) }
      `) as never,
      now: () => now,
    });
    const view = engine.createElement('view');
    engine.appendChild(engine.root, view);
    engine.commit();

    const painted = () => flatten(fabric.committed)[0]?.props['transform'];

    engine.setClasses(view, 'moved');
    engine.commit();

    const tick = (ms: number) => {
      now += ms;
      engine.advanceAnimations();
      engine.commit();
    };

    tick(50);
    assert.deepEqual(painted(), [{ translateX: 90 }], 'halfway, not still at rest');
    tick(50);
    assert.deepEqual(painted(), [{ translateX: 180 }], 'and it arrives');

    // And back again. A transform going away is the same journey in reverse, so it has to ease
    // rather than snap: `none` beside a list of operations means each of them at rest.
    engine.setClasses(view, '');
    engine.commit();
    tick(50);
    assert.deepEqual(painted(), [{ translateX: 90 }], 'halfway home');
  });
});

describe('interpolating a transform', () => {
  it('eases toward none, an empty list, as it does toward no transform at all', () => {
    // `animate-bounce`'s 50% keyframe is `transform: none`. Read as a list of another length, the
    // bounce held its top frame and jumped to the bottom, where it should fall.
    assert.deepEqual(interpolate([{ translateY: 20 }], [], 0.5), [{ translateY: 10 }]);
  });

  it('eases a percentage toward none in its own unit', () => {
    assert.deepEqual(interpolate([{ translateY: '-25%' }], [], 0.5), [{ translateY: '-12.5%' }]);
    assert.deepEqual(interpolate([], [{ rotate: '1turn' }], 0.5), [{ rotate: '0.5turn' }]);
  });

  it('moves each operation, matched by position and name', () => {
    assert.deepEqual(interpolate([{ translateX: 0 }], [{ translateX: 180 }], 0.5), [
      { translateX: 90 },
    ]);
    assert.deepEqual(interpolate([{ scale: 0.8 }], [{ scale: 1.2 }], 0.5), [{ scale: 1 }]);
  });

  it('interpolates an angle, keeping the unit it was written in', () => {
    assert.deepEqual(interpolate([{ rotate: '0deg' }], [{ rotate: '90deg' }], 0.5), [
      { rotate: '45deg' },
    ]);
  });

  it('starts from the identity when there was no transform at all', () => {
    // `.slider { }` to `.slider-end { transform: translateX(180px) }` is the ordinary case, and
    // CSS treats the missing one as `none` rather than as a reason not to animate.
    assert.deepEqual(interpolate(undefined, [{ translateX: 180 }], 0.5), [{ translateX: 90 }]);
    assert.deepEqual(interpolate(undefined, [{ scale: 2 }], 0.5), [{ scale: 1.5 }]);
    assert.deepEqual(interpolate(undefined, [{ rotate: '90deg' }], 0.5), [{ rotate: '45deg' }]);
  });

  it('handles several operations at once, in order', () => {
    assert.deepEqual(
      interpolate([{ translateX: 0 }, { scale: 1 }], [{ translateX: 100 }, { scale: 2 }], 0.5),
      [{ translateX: 50 }, { scale: 1.5 }],
    );
  });

  it('keeps a fraction of a degree rather than rounding it away', () => {
    assert.deepEqual(interpolate([{ rotate: '0deg' }], [{ rotate: '1deg' }], 0.25), [
      { rotate: '0.25deg' },
    ]);
  });

  it('steps between two angles in different units rather than mixing them', () => {
    assert.deepEqual(interpolate([{ rotate: '0deg' }], [{ rotate: '1rad' }], 0.5), [
      { rotate: '0deg' },
    ]);
  });

  it('steps when the list it leaves has more operations than the one it goes to', () => {
    const from = [{ translateX: 0 }, { scale: 2 }];
    assert.deepEqual(interpolate(from, [{ translateX: 10 }], 0.5), from);
  });

  it('steps when the two lists are not the same shape, as CSS does', () => {
    // Different operations cannot be blended without decomposing a matrix, which is a great deal
    // of arithmetic for a case an author can always write out. Stepping is what CSS falls back to.
    const from = [{ translateX: 0 }];
    const to = [{ scale: 2 }];
    assert.deepEqual(interpolate(from, to, 0.5), from);
    assert.deepEqual(interpolate(from, to, 1), to);
  });
});

describe('interpolating a colour', () => {
  it('eases the alpha along with the channels', () => {
    assert.equal(interpolate('rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)', 0.5), 'rgba(0, 0, 0, 0.5)');
  });

  it('reads the alpha of a four- and an eight-digit hex colour as a fraction', () => {
    assert.equal(interpolate('#f008', '#f008', 0), 'rgba(255, 0, 0, 0.533)');
    assert.equal(interpolate('#ff000080', '#ff000080', 0), 'rgba(255, 0, 0, 0.502)');
  });
});
