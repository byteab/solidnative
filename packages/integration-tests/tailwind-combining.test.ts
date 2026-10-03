/**
 * Tailwind utilities that combine on one node, built by the real CLI and painted by the engine.
 *
 * Tailwind 4 builds a translate, a shadow or a filter out of custom properties: each utility sets
 * its own slot and reads all of them, so `translate-x-2 translate-y-4` is one translate made of
 * two classes. Only the node knows which classes it wears, so a slot one class sets and another
 * reads has to be answered there. Answered at build time, each class bakes the other's reset into
 * its own value, and whichever the sheet writes last wins outright.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, type StyleSheet } from '@solidnative/fabric';
import { createFakeFabric } from '@solidnative/testing';
import { build, committedProps } from './tailwind-cli.ts';

const require = createRequire(import.meta.url);
const { flattenTailwind } = require('@solidnative/tailwind') as {
  flattenTailwind(css: string): string;
};
const { compileCss } = require('@solidnative/metro/css/compile.cjs') as {
  compileCss(css: string, context: string, options: object): StyleSheet;
};

const CLASSES =
  'translate-x-2 translate-y-4 scale-x-50 scale-y-75 transform rotate-45 ' +
  'shadow-lg ring-2 ring-blue-500 inset-shadow-sm shadow-red-500 text-green-500 ' +
  'brightness-50 android:blur-sm android:grayscale ' +
  'bg-linear-to-r from-red-500 via-blue-500 to-green-500 dark:via-none ' +
  'rotate-x-12 skew-x-6 ios:skew-x-6 translate-x-1/2 -translate-y-full ring-inset ring-offset-2 ring-offset-white ' +
  'text-shadow-xs text-shadow-red-500 android:drop-shadow-lg android:drop-shadow-red-500 ' +
  'space-x-2 space-y-4 space-x-reverse divide-x divide-y-2 divide-red-500 divide-dashed me-6 my-6 ' +
  'border-x-4 border-l-2 border-x-red-500 border-l-blue-500 border-s-2 ' +
  'tabular-nums oldstyle-nums slashed-zero';

describe('Tailwind utilities that combine on one node', () => {
  let sheet: StyleSheet;
  const refused: string[] = [];

  before(() => {
    sheet = compileCss(flattenTailwind(build('native', CLASSES)), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
  });

  /** What a node wearing `classes` is painted with, under a root on the given platform. */
  function paint(classes: string, platform = 'ios', rootClasses = ''): Record<string, unknown> {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet });
    const root = engine.createElement('view');
    const node = engine.createElement('view');
    engine.setClasses(root, `platform-${platform} ${rootClasses}`);
    engine.setClasses(node, classes);
    engine.appendChild(engine.root, root);
    engine.appendChild(root, node);
    engine.commit();
    return committedProps(fabric, node);
  }

  /** What each of three children is painted with, under a parent wearing `classes`. */
  function paintChildren(classes: string, childClasses = ''): Record<string, unknown>[] {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet });
    const root = engine.createElement('view');
    const parent = engine.createElement('view');
    engine.setClasses(root, 'platform-ios');
    engine.setClasses(parent, classes);
    const children = [0, 1, 2].map(() => engine.createElement('view'));
    for (const child of children) {
      engine.setClasses(child, childClasses);
      engine.appendChild(parent, child);
    }
    engine.appendChild(engine.root, root);
    engine.appendChild(root, parent);
    engine.commit();
    return children.map((child) => committedProps(fabric, child));
  }

  const refusedFor = (property: string) =>
    refused.filter((message) => message.includes(`dropped '${property}'`));

  it('moves along both axes when two classes each set one', () => {
    assert.deepEqual(paint('translate-x-2 translate-y-4')['transform'], [
      { translateX: 8 },
      { translateY: 16 },
    ]);
    assert.deepEqual(paint('translate-x-2')['transform'], [{ translateX: 8 }, { translateY: 0 }]);
  });

  it('moves by a fraction of the box, which Tailwind writes as a calc() of a percentage', () => {
    // `translate-x-1/2` is `--tw-translate-x: calc(1/2 * 100%)`. Left for the engine beside
    // another translate class, the slot held a calc() nothing had folded, and it moved nothing.
    assert.deepEqual(paint('translate-x-1/2 -translate-y-full')['transform'], [
      { translateX: '50%' },
      { translateY: '-100%' },
    ]);
  });

  it('scales along both axes when two classes each set one', () => {
    assert.deepEqual(paint('scale-x-50 scale-y-75')['transform'], [
      { scaleX: 0.5 },
      { scaleY: 0.75 },
    ]);
  });

  it('reads the transform class as no transform, rather than refusing it', () => {
    // `transform` on its own is five empty slots, which the web reads as `none`. It exists to be
    // written beside a class that fills a slot, and must not take that class's transform away.
    assert.deepEqual(refusedFor('transform'), []);
    // Nothing, or an empty list when other classes put its slots on device: both are `none`.
    assert.deepEqual(paint('transform')['transform'] ?? [], []);
    assert.deepEqual(paint('transform rotate-45')['transform'], [{ rotate: '45deg' }]);
  });

  it('draws every 3D rotation and skew a node has, each from its own class', () => {
    // Each writes the same five-slot `transform` and fills its own slot. Refused while any of them
    // was in the sheet, since a slot is a whole function rather than a function's argument.
    assert.deepEqual(refusedFor('transform'), []);
    assert.deepEqual(paint('rotate-x-12')['transform'], [{ rotateX: '12deg' }]);
    assert.deepEqual(paint('rotate-x-12 ios:skew-x-6')['transform'], [
      { rotateX: '12deg' },
      { skewX: '6deg' },
    ]);
  });

  it('refuses a skew that can apply on Android, where a view has no skew, and keeps ios:', () => {
    const refusals = refusedFor('--tw-skew-x');
    assert.equal(refusals.length, 1);
    assert.match(refusals[0]!, /skewX\(\) is not drawn on Android/);
    assert.deepEqual(paint('rotate-x-12 skew-x-6')['transform'], [{ rotateX: '12deg' }]);
    assert.deepEqual(paint('rotate-x-12 ios:skew-x-6', 'android')['transform'], [
      { rotateX: '12deg' },
    ]);
  });

  it('keeps the shadow when a ring or an inset shadow is added beside it', () => {
    const lg = paint('shadow-lg')['boxShadow'] as { offsetY: number }[];
    assert.equal(lg.length, 2);

    const ringed = paint('shadow-lg ring-2 ring-blue-500')['boxShadow'] as {
      spreadDistance: number;
    }[];
    assert.deepEqual(
      ringed.map((shadow) => shadow.spreadDistance),
      [2, -3, -4],
      'the ring, then both of the shadow',
    );

    const inset = paint('shadow-lg inset-shadow-sm')['boxShadow'] as { inset: boolean }[];
    assert.deepEqual(
      inset.map((shadow) => shadow.inset),
      [true, false, false],
    );
  });

  it('draws a ring in the colour a ring colour class gives it', () => {
    const [ring] = paint('ring-2 ring-blue-500')['boxShadow'] as { color: string }[];
    assert.equal(ring!.color, 'rgb(43, 127, 255)');
  });

  it('insets a ring with ring-inset', () => {
    // `ring-inset` sets `--tw-ring-inset: inset`, read inside the ring's own shadow token.
    const [ring] = paint('ring-2 ring-blue-500 ring-inset')['boxShadow'] as {
      inset: boolean;
      spreadDistance: number;
    }[];
    assert.equal(ring!.inset, true);
    assert.equal(ring!.spreadDistance, 2);
  });

  it('draws a ring offset from the box, in the offset colour, with the ring beyond it', () => {
    const shadows = paint('ring-2 ring-blue-500 ring-offset-2 ring-offset-white')['boxShadow'] as {
      spreadDistance: number;
      color: string;
    }[];
    assert.deepEqual(
      shadows.map((shadow) => [shadow.spreadDistance, shadow.color]),
      [
        [2, 'rgb(255, 255, 255)'],
        [4, 'rgb(43, 127, 255)'],
      ],
    );
  });

  it("draws a ring with no colour class in the node's own text colour", () => {
    // Tailwind's default ring colour is `currentcolor`, which is the `color` in scope.
    const [ring] = paint('ring-2 text-green-500')['boxShadow'] as { color: string }[];
    assert.equal(ring!.color, 'rgb(0, 201, 80)');
    assert.deepEqual(refusedFor('box-shadow'), []);
  });

  it('draws a shadow in the colour a shadow colour class gives it', () => {
    const shadows = paint('shadow-lg shadow-red-500')['boxShadow'] as { color: string }[];
    assert.equal(shadows.length, 2);
    // Opaque, as on the web: the colour replaces the default's 10% black outright.
    for (const shadow of shadows) assert.equal(shadow.color, 'rgb(251, 44, 54)');
  });

  it('draws a text shadow in the colour a text shadow colour class gives it', () => {
    assert.equal(
      paint('text-shadow-xs text-shadow-red-500')['textShadowColor'],
      'rgb(251, 44, 54)',
    );
    assert.equal(paint('text-shadow-xs')['textShadowColor'], 'rgba(0, 0, 0, 0.2)');
    assert.deepEqual(refusedFor('text-shadow'), []);
  });

  it('draws a drop shadow in the colour a drop shadow colour class gives it', () => {
    const colour = (classes: string) =>
      (paint(classes, 'android')['filter'] as { dropShadow?: { color: string } }[])[0]!.dropShadow!
        .color;
    assert.equal(colour('android:drop-shadow-lg android:drop-shadow-red-500'), 'rgb(251, 44, 54)');
    assert.equal(colour('android:drop-shadow-lg'), 'rgba(0, 0, 0, 0.15)');
  });

  it('draws every filter a node has, not only the last class', () => {
    assert.deepEqual(paint('android:blur-sm android:grayscale', 'android')['filter'], [
      { blur: 8 },
      { grayscale: 1 },
    ]);
    assert.deepEqual(paint('brightness-50 android:grayscale', 'android')['filter'], [
      { brightness: 0.5 },
      { grayscale: 1 },
    ]);
    // iOS draws brightness and nothing Android-only.
    assert.deepEqual(paint('brightness-50 android:grayscale', 'ios')['filter'], [
      { brightness: 0.5 },
    ]);
  });

  it('takes the middle stop back out with via-none under a variant', () => {
    // On the web `via-none` resets what `via-*` set, and matters under a variant, since Tailwind
    // sorts it first: `dark:via-none` gives the dark scheme a two-stop gradient.
    const classes = 'bg-linear-to-r from-red-500 via-blue-500 to-green-500 dark:via-none';
    const stops = (root: string) =>
      (
        paint(classes, 'ios', root)['experimental_backgroundImage'] as {
          colorStops: unknown[];
        }[]
      )[0]!.colorStops.length;
    assert.equal(stops(''), 3);
    assert.equal(stops('dark'), 2);
  });

  it('spaces children apart with space-x and space-y, all but the last', () => {
    const [first, second, last] = paintChildren('space-x-2');
    for (const child of [first!, second!]) {
      assert.equal(child['marginEnd'], 8);
      assert.equal(child['marginStart'], 0);
    }
    assert.equal(last!['marginEnd'], undefined);
    assert.equal(paintChildren('space-y-4')[0]!['marginBottom'], 16);
    assert.deepEqual(
      refused.filter((message) => message.includes('space-')),
      [],
    );
  });

  it('puts the space on the other side with space-x-reverse', () => {
    const [first] = paintChildren('space-x-2 space-x-reverse');
    assert.equal(first!['marginStart'], 8);
    assert.equal(first!['marginEnd'], 0);
  });

  it("gives way to a child's own margin, as the web's zero-specificity rule does", () => {
    assert.equal(paintChildren('space-x-2', 'me-6')[0]!['marginEnd'], 24);
    assert.equal(paintChildren('space-y-4', 'my-6')[0]!['marginBottom'], 24);
  });

  it('draws a divider after every child but the last with divide-x and divide-y', () => {
    const [first, , last] = paintChildren('divide-y-2 divide-red-500 divide-dashed');
    assert.equal(first!['borderBottomWidth'], 2);
    assert.equal(first!['borderTopWidth'], 0);
    assert.equal(first!['borderBottomColor'], 'rgb(251, 44, 54)');
    assert.equal(first!['borderStyle'], 'dashed');
    assert.equal(last!['borderBottomWidth'], undefined);
    assert.equal(paintChildren('divide-x')[0]!['borderEndWidth'], 1);
    assert.deepEqual(
      refused.filter((message) => message.includes('divide-')),
      [],
    );
  });

  it('lets a left or right border override border-x, as a later side does on the web', () => {
    // One value on both inline sides is left and right: a start or end edge would outrank a left
    // one in Yoga, whichever was written last.
    const props = paint('border-x-4 border-l-2 border-x-red-500 border-l-blue-500');
    assert.equal(props['borderLeftWidth'], 2);
    assert.equal(props['borderRightWidth'], 4);
    assert.equal(props['borderLeftColor'], 'rgb(43, 127, 255)');
    assert.equal(props['borderRightColor'], 'rgb(251, 44, 54)');
    assert.equal(paint('border-x-4 border-s-2')['borderStartWidth'], 2);
  });

  it('refuses a numeric variant native lacks, wherever the rule sets its slot', () => {
    const refusals: string[] = [];
    compileCss('.z { font-variant-numeric: var(--z,); --z: slashed-zero }', 'order', {
      onUnsupported: (message: string) => refusals.push(message),
    });
    assert.equal(refusals.length, 1);
    assert.match(refusals[0]!, /'slashed-zero' is not a font variant/);
  });

  it('keeps every numeric variant a node has, not only the last class', () => {
    // Tailwind composes font-variant-numeric out of five slots, as it does a filter.
    assert.deepEqual(paint('tabular-nums oldstyle-nums')['fontVariant'], [
      'oldstyle-nums',
      'tabular-nums',
    ]);
    assert.deepEqual(paint('tabular-nums')['fontVariant'], ['tabular-nums']);
    // One native has no way to ask a font for is still refused, where its class sets it.
    const refusals = refusedFor('font-variant-numeric');
    assert.equal(refusals.length, 1);
    assert.match(refusals[0]!, /'slashed-zero' is not a font variant/);
  });
});
