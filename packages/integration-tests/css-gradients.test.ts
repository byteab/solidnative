/**
 * Gradients, worked out at build time.
 *
 * Fabric takes gradients as a *processed* structure - direction as an angle or a keyword, stops as
 * a processed colour and a position - and only parses a CSS string when `enableNativeCSSParsing`
 * is on, which it is not by default. React Native's own JS parses the string with a stack of
 * regexes on every render. Neither is needed here: the sheet is compiled by a real CSS parser at
 * build time, so what reaches the device is already the structure C++ wants.
 *
 * The target is Fabric's C++, not RN's JS style API. The two disagree, and the C++ is the one
 * this renderer talks to.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { mountSolid } from './css-solid-harness.ts';
import { gradientHost, themedGradient } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

let mounted: ReturnType<typeof mountSolid> | undefined;
afterEach(() => mounted?.root.dispose());

interface Stop {
  color: string;
  position?: string | number;
}
interface Linear {
  type: 'linear-gradient';
  direction: { type: 'angle' | 'keyword'; value: number | string };
  colorStops: Stop[];
}

const gradientsOf = (css: string): (Linear | Record<string, unknown>)[] =>
  compileCss(`view { ${css} }`).rules[0].declarations['experimental_backgroundImage'];

const linear = (css: string) => gradientsOf(css)[0] as Linear;

describe('a linear gradient', () => {
  it('defaults to running down the box, as CSS does', () => {
    // 180 degrees rather than the keyword. Native does *not* take both: its parser knows the
    // four corner keywords and nothing else, so a straight edge has to arrive as an angle. This
    // comment used to say the opposite, which is how the bug lasted.
    assert.deepEqual(linear('background-image: linear-gradient(red, blue)'), {
      type: 'linear-gradient',
      direction: { type: 'angle', value: 180 },
      colorStops: [
        { color: 'rgb(255, 0, 0)', position: null },
        { color: 'rgb(0, 0, 255)', position: null },
      ],
    });
  });

  it('writes a position even when there is none, because Fabric looks for the key', () => {
    // `parseProcessedBackgroundImage` finds `position` before it reads it, and skips a stop that
    // has not got one. A two-stop gradient written without positions would paint nothing.
    for (const stop of linear('background-image: linear-gradient(red, blue)').colorStops) {
      assert.ok('position' in stop, 'every stop carries the key, null or not');
    }
  });

  /**
   * The table is React Native's, in `processBackgroundImage`'s `getDirectionForKeyword`, and it
   * is not the obvious one: a straight edge becomes an **angle**, and only the four corners stay
   * keywords. Native's parser knows those four and nothing else, so `{keyword, 'to right'}` is
   * not a different spelling of the same thing - it is refused, and the whole gradient with it.
   *
   * This test used to assert the keyword, agreeing with the code. Both were wrong, and nothing
   * caught it until a gradient was looked at on a screen.
   */
  it('turns a straight edge into the angle native reads, and keeps corners as keywords', () => {
    const of = (dir: string) =>
      linear(`background-image: linear-gradient(${dir}, red, blue)`).direction;

    assert.deepEqual(of('to top'), { type: 'angle', value: 0 });
    assert.deepEqual(of('to right'), { type: 'angle', value: 90 });
    assert.deepEqual(of('to bottom'), { type: 'angle', value: 180 });
    assert.deepEqual(of('to left'), { type: 'angle', value: 270 });

    assert.deepEqual(of('to bottom right'), { type: 'keyword', value: 'to bottom right' });
    assert.deepEqual(of('to top left'), { type: 'keyword', value: 'to top left' });

    // Corners are named vertical first however they were written, because that is how native's
    // four keywords are spelt.
    assert.deepEqual(of('to right top'), { type: 'keyword', value: 'to top right' });

    // An angle written as one is passed through, and is the default when none is given.
    assert.deepEqual(of('45deg'), { type: 'angle', value: 45 });
    assert.deepEqual(linear('background-image: linear-gradient(red, blue)').direction, {
      type: 'angle',
      value: 180,
    });
  });

  it('takes an angle, in the degrees native measures in', () => {
    assert.deepEqual(linear('background-image: linear-gradient(45deg, red, blue)').direction, {
      type: 'angle',
      value: 45,
    });
    // Every CSS angle unit means the same thing once it is a number.
    assert.equal(
      linear('background-image: linear-gradient(0.25turn, red, blue)').direction.value,
      90,
    );
  });

  it('keeps a stop where the author put it', () => {
    assert.deepEqual(linear('background-image: linear-gradient(red, blue 40%)').colorStops, [
      { color: 'rgb(255, 0, 0)', position: null },
      { color: 'rgb(0, 0, 255)', position: '40%' },
    ]);
    assert.deepEqual(linear('background-image: linear-gradient(red, blue 20px)').colorStops[1], {
      color: 'rgb(0, 0, 255)',
      position: 20,
    });
  });

  it('spells a two-position stop as the two stops it means', () => {
    // `red 0 50%` is a hard band: the same colour at both ends of the range. Native has no room
    // for a second position on one stop, and CSS defines it as exactly this expansion.
    assert.deepEqual(linear('background-image: linear-gradient(red 0 50%, blue)').colorStops, [
      { color: 'rgb(255, 0, 0)', position: 0 },
      { color: 'rgb(255, 0, 0)', position: '50%' },
      { color: 'rgb(0, 0, 255)', position: null },
    ]);
  });

  it('stacks the layers a comma-separated list asks for', () => {
    const layers = gradientsOf(
      'background-image: linear-gradient(red, blue), linear-gradient(green, teal)',
    );
    assert.equal(layers.length, 2);
  });
});

describe('a radial gradient', () => {
  it('carries the shape, the size and the centre native reads', () => {
    assert.deepEqual(gradientsOf('background-image: radial-gradient(red, blue)')[0], {
      type: 'radial-gradient',
      shape: 'ellipse',
      size: 'farthest-corner',
      position: { top: '50%', left: '50%' },
      colorStops: [
        { color: 'rgb(255, 0, 0)', position: null },
        { color: 'rgb(0, 0, 255)', position: null },
      ],
    });
  });

  it('takes a circle, an extent and a centre of its own', () => {
    const gradient = gradientsOf(
      'background-image: radial-gradient(circle closest-side at 30% 40%, red, blue)',
    )[0] as Record<string, unknown>;
    assert.equal(gradient['shape'], 'circle');
    assert.equal(gradient['size'], 'closest-side');
    assert.deepEqual(gradient['position'], { left: '30%', top: '40%' });
  });

  it('measures from the far edge when the author does', () => {
    const gradient = gradientsOf(
      'background-image: radial-gradient(at right bottom, red, blue)',
    )[0] as Record<string, unknown>;
    assert.deepEqual(gradient['position'], { right: 0, bottom: 0 });
  });
});

describe('what a gradient cannot be', () => {
  it('refuses a conic gradient, which native has no shape for', () => {
    assert.throws(() => gradientsOf('background-image: conic-gradient(red, blue)'), /conic/);
  });

  it('refuses a url, because there is no image loader behind this prop', () => {
    assert.throws(() => gradientsOf('background-image: url(cat.png)'), /url/);
  });

  it('still refuses a background shorthand carrying an image', () => {
    assert.throws(() => compileCss('view { background: url(cat.png) }'), /background images/);
  });
});

describe('a gradient on a device', () => {
  it('runs its colours through the host converter, as any other colour is', () => {
    mounted = mountSolid(gradientHost(), {
      processColor: (value) => `processed(${String(value)})`,
    });

    const node = mounted.byId('hero');
    const [gradient] = node.props['experimental_backgroundImage'] as Linear[];
    assert.deepEqual(gradient!.colorStops, [
      { color: 'processed(rgb(255, 0, 0))', position: null },
      { color: 'processed(rgb(0, 0, 255))', position: '60%' },
    ]);
  });
});

describe('a gradient whose colours come from custom properties', () => {
  /** The deferred template a gradient with `var()` stops compiles to. */
  const deferredOf = (css: string) =>
    compileCss(`view { ${css} }`, 'test', { onUnsupported: () => {} }).rules[0].deferred?.[0];

  it('is held as a template, because the stops are not known until a node matches', () => {
    assert.deepEqual(
      deferredOf('background-image: linear-gradient(to right, var(--start), var(--end))'),
      {
        props: ['experimental_backgroundImage'],
        gradient: {
          type: 'linear-gradient',
          direction: { type: 'angle', value: 90 },
          colorStops: [{ reference: '--start' }, { reference: '--end' }],
        },
      },
    );
  });

  it('keeps a position, whether it is written out or deferred too', () => {
    const template = deferredOf(
      'background-image: linear-gradient(var(--start) 10%, var(--end) var(--end-at, 90%))',
    ) as { gradient: { colorStops: unknown[] } };
    assert.deepEqual(template.gradient.colorStops, [
      { reference: '--start', position: '10%' },
      { reference: '--end', positionReference: '--end-at', position: '90%' },
    ]);
  });
});

describe('resolving a gradient template', () => {
  const paint = (globalCss: string) => {
    mounted = mountSolid(themedGradient(), {
      globalStyles: compileCss(globalCss, 'global', { onUnsupported: () => {} }),
    });
    return mounted.byId('themed');
  };

  it('fills the stops in from the cascade', () => {
    const node = paint(':root { --start: red; --middle: green; --end: blue }');
    assert.deepEqual(node.props['experimental_backgroundImage'], [
      {
        type: 'linear-gradient',
        direction: { type: 'angle', value: 90 },
        colorStops: [
          { color: 'rgb(255, 0, 0)', position: null },
          { color: 'rgb(0, 128, 0)', position: '50%' },
          { color: 'rgb(0, 0, 255)', position: null },
        ],
      },
    ]);
  });

  it('drops a stop nothing defined, which is how an optional middle colour disappears', () => {
    // Tailwind's `via-*` is exactly this: one gradient rule, used with and without a middle
    // colour, and the class that supplies one is a different class from the one that paints. A
    // stop with no colour is not a transparent stop; it is not a stop.
    const node = paint(':root { --start: red; --end: blue }');
    const [gradient] = node.props['experimental_backgroundImage'] as { colorStops: unknown[] }[];
    assert.deepEqual(gradient!.colorStops, [
      { color: 'rgb(255, 0, 0)', position: null },
      { color: 'rgb(0, 0, 255)', position: null },
    ]);
  });

  it('paints nothing when there are not two colours to run between', () => {
    const node = paint(':root { --start: red }');
    assert.equal(node.props['experimental_backgroundImage'], undefined);
  });
});

describe('gradient stops', () => {
  const deferredOf = (css: string) => compileCss(`view { ${css} }`, 'test').rules[0].deferred?.[0];

  it('gives a stop with two positions a stop at each', () => {
    assert.deepEqual(
      linear('background-image: linear-gradient(red 10% 20%, blue)').colorStops.map(
        (stop) => stop.position,
      ),
      ['10%', '20%', null],
    );
  });

  it('takes a bare 0 as the position of a var() stop', () => {
    const template = deferredOf('background-image: linear-gradient(var(--a) 0, var(--b))') as {
      gradient: { colorStops: unknown[] };
    };
    assert.deepEqual(template.gradient.colorStops, [
      { reference: '--a', position: 0 },
      { reference: '--b' },
    ]);
  });

  it('refuses a var() gradient with one stop, or a radial one with an explicit radius', () => {
    assert.throws(
      () => deferredOf('background-image: linear-gradient(var(--a))'),
      /at least two colour stops/,
    );
    assert.throws(
      () => deferredOf('background-image: radial-gradient(40px, var(--a), var(--b))'),
      /explicit radius/,
    );
  });

  it('keeps a var() radial gradient s shape, size and centre', () => {
    const declaration = deferredOf(
      'background-image: radial-gradient(circle closest-side at right 20%, var(--a), var(--b))',
    ) as { gradient: Record<string, unknown> };
    assert.equal(declaration!.gradient['shape'], 'circle');
    assert.equal(declaration!.gradient['size'], 'closest-side');
    assert.deepEqual(declaration!.gradient['position'], { right: 0, top: '20%' });
  });
});
