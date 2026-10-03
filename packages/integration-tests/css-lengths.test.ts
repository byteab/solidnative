/**
 * Lengths that cannot be settled at build time, and the one that can.
 *
 * `calc()` with absolute operands folds here. `em`, `vw` and `vh` cannot: they depend on a font
 * size that is only known once the cascade has run, or on a viewport that changes while the app
 * is open. Those become deferred lengths, resolved beside `var()`.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { StyleResolver, type Engine, type StyleTarget } from '@solid-native/fabric';
import { mountSolid } from './css-solid-harness.ts';
import { relativeLengths } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

let mounted: ReturnType<typeof mountSolid> | undefined;
afterEach(() => mounted?.root.dispose());

const declarationsOf = (css: string): Record<string, unknown> =>
  compileCss(`view { ${css} }`).rules[0].declarations;

describe('calc', () => {
  it('folds absolute operands at build time', () => {
    assert.deepEqual(declarationsOf('width: calc(2rem + 4px)'), { width: 36 });
    assert.deepEqual(declarationsOf('width: calc(100px - 10px)'), { width: 90 });
    assert.deepEqual(declarationsOf('width: calc(10px * 3)'), { width: 30 });
    assert.deepEqual(declarationsOf('width: calc(30px / 2)'), { width: 15 });
  });

  it('refuses one that mixes a percentage with a length', () => {
    // Native resolves percentages during layout, so there is nothing here that could fold it and
    // nothing on device that could evaluate it later.
    assert.throws(() => declarationsOf('width: calc(100% - 10px)'), /percentage/i);
  });

  it('folds min(), max() and clamp() over absolute lengths', () => {
    // lightningcss leaves these alone when the units differ, and they were refused outright.
    assert.deepEqual(declarationsOf('width: max(1rem, 2px)'), { width: 16 });
    assert.deepEqual(declarationsOf('width: min(1rem, 20px)'), { width: 16 });
    assert.deepEqual(declarationsOf('width: clamp(1rem, 2px, 3rem)'), { width: 16 });
    assert.deepEqual(declarationsOf('width: clamp(1rem, 40px, 2rem)'), { width: 32 });
  });

  it('refuses min() and friends over a length only the device knows, and says so', () => {
    // `max(1rem, 2vw)` needs the comparison made on device, which is a calc engine there.
    assert.throws(() => declarationsOf('padding: max(1rem, 2vw)'), /max\(\).*device/);
  });

  it('defers a sum of an absolute length and one relative to the viewport or the font', () => {
    // Bootstrap's responsive type is `font-size: calc(1.375rem + 1.5vw)` on every heading and
    // `.fs-*` class. It was refused with a message about percentages, of which it has none.
    const rule = compileCss('view { font-size: calc(1.375rem + 1.5vw) }').rules[0];
    assert.deepEqual(rule.deferred, [
      { props: ['fontSize'], compute: { unit: 'vw', factor: 1.5, offset: 22 } },
    ]);
    const resolver = new StyleResolver(
      compileCss('.a { font-size: calc(1.375rem + 1.5vw) } .b { padding-top: calc(2em - 4px) }'),
      { width: 500, height: 900, colorScheme: 'light' },
    );
    const node = (classes: string[]): StyleTarget => ({
      name: 'view',
      parent: null,
      classes: new Set(classes),
      props: {},
      sheet: null,
      hostSheet: null,
      styleCache: null,
      styleDirty: true,
    });
    // 22 + 1.5% of 500, which is what Chrome computes for the same viewport.
    assert.equal(resolver.resolve(node(['a']), 1).style['fontSize'], 29.5);
    assert.equal(resolver.resolve(node(['b']), 1).style['paddingTop'], 28);
  });

  it('reads vmin as the shorter side of the viewport and vmax as the longer', () => {
    const resolver = new StyleResolver(compileCss('.a { width: 50vmin; height: 50vmax }'), {
      width: 400,
      height: 800,
      colorScheme: 'light',
    });
    const style = resolver.resolve(
      {
        name: 'view',
        parent: null,
        classes: new Set(['a']),
        props: {},
        sheet: null,
        hostSheet: null,
        styleCache: null,
        styleDirty: true,
      },
      1,
    ).style;
    assert.deepEqual([style['width'], style['height']], [200, 400]);
  });

  it('scales such a sum as a whole', () => {
    assert.deepEqual(compileCss('view { width: calc((1vw + 1rem) * 2) }').rules[0].deferred, [
      { props: ['width'], compute: { unit: 'vw', factor: 2, offset: 32 } },
    ]);
  });

  it('refuses a sum of two lengths only the device knows', () => {
    assert.throws(() => declarationsOf('width: calc(1vw + 1em)'), /one relative unit/);
  });
});

describe('viewport and font-relative lengths', () => {
  let engine: Engine;

  const boot = (width: number, height: number) => {
    mounted = mountSolid(relativeLengths(), {
      conditions: { width, height, colorScheme: 'dark' },
    });
    engine = mounted.engine;
  };
  const settle = () => mounted!.settle();

  const byId = (id: string) => mounted!.byId(id);

  it('resolves vw and vh against the viewport', () => {
    boot(400, 800);
    assert.equal(byId('box').props['width'], 200);
    assert.equal(byId('box').props['height'], 80);
  });

  it('follows the viewport when it changes', () => {
    boot(400, 800);
    engine.updateConditions({ width: 1000, height: 500, colorScheme: 'dark' });
    settle();
    assert.equal(byId('box').props['width'], 500);
    assert.equal(byId('box').props['height'], 50);
  });

  it('resolves em against the font size in scope', () => {
    boot(400, 800);
    // The box sets font-size: 20px, so its own 2em padding is 40.
    assert.equal(byId('box').props['paddingTop'], 40);
    // The label inherits 20px and sets none of its own, so its 0.5em margin is 10.
    assert.equal(byId('label').props['marginTop'], 10);
  });

  it('resolves em on font-size itself against the inherited size, not its own', () => {
    boot(400, 800);
    // 1.5em of the inherited 20px, not of the value being computed.
    assert.equal(byId('big').props['fontSize'], 30);
  });

  it('turns an infinite length into the largest one native can paint', () => {
    // `rounded-full` is `calc(infinity * 1px)`, which reaches here as f32's ceiling - 3.4e38.
    // Native cannot paint that and quietly leaves the corners square, which is how a pill button
    // and a round radio ended up as rectangles. What the CSS means is "as round as it goes", and
    // a big finite number is how native says that.
    assert.deepEqual(declarationsOf('border-radius: calc(infinity * 1px);'), {
      borderTopLeftRadius: 9999,
      borderTopRightRadius: 9999,
      borderBottomLeftRadius: 9999,
      borderBottomRightRadius: 9999,
    });
  });

  it('clamps a negative infinity the same way', () => {
    assert.equal(declarationsOf('margin-top: calc(-1 * infinity * 1px);')['marginTop'], -9999);
  });

  it('reads a unitless line-height as a multiple of the font size', () => {
    // `leading-none` is `line-height: 1`, and native wants points. Which points depends on a font
    // size that may be inherited or set by another class, so it is the same deferral `em` uses -
    // which is exactly what a unitless line-height means.
    const rule = compileCss('.a { line-height: 1.5 }', 'unitless').rules[0];
    assert.deepEqual(rule.deferred, [
      { props: ['lineHeight'], compute: { unit: 'em', factor: 1.5 } },
    ]);
  });

  it('reads a percentage line-height as a share of the font size, in points', () => {
    // Fabric reads lineHeight as a number, and dropped the '150%' string it used to be sent. A
    // percentage line-height is of the element's own font size, which is what em means too.
    const rule = compileCss('.a { line-height: 150% }', 'percentage').rules[0];
    assert.deepEqual(rule.declarations, {});
    assert.deepEqual(rule.deferred, [
      { props: ['lineHeight'], compute: { unit: 'em', factor: 1.5 } },
    ]);
    const resolver = new StyleResolver(compileCss('.a { font-size: 20px; line-height: 150% }'), {
      width: 400,
      height: 800,
      colorScheme: 'light',
    });
    const target: StyleTarget = {
      name: 'text',
      parent: null,
      classes: new Set(['a']),
      props: {},
      sheet: null,
      hostSheet: null,
      styleCache: null,
      styleDirty: true,
    };
    assert.equal(resolver.resolve(target, 1).style['lineHeight'], 30);
  });

  it('settles an em or viewport length inside a list or a record, not only at the top', () => {
    // Only a marker a whole prop held was lifted out and settled, so one inside a transform, a
    // shadow or a filter was committed as the marker object, which Fabric drops.
    const resolver = new StyleResolver(
      compileCss(
        '.a { font-size: 10px; transform: translateX(1em) translateY(10vh);' +
          ' box-shadow: 0 0 1em red; filter: blur(0.5em); transform-origin: 1em 2em }',
        'test',
        // blur() is drawn on Android only.
        { platform: 'android' },
      ),
      { width: 400, height: 800, colorScheme: 'light' },
    );
    const target: StyleTarget = {
      name: 'view',
      parent: null,
      classes: new Set(['a']),
      props: {},
      sheet: null,
      hostSheet: null,
      styleCache: null,
      styleDirty: true,
    };
    const style = resolver.resolve(target, 1).style;
    assert.deepEqual(style['transform'], [{ translateX: 10 }, { translateY: 80 }]);
    assert.equal((style['boxShadow'] as { blurRadius: number }[])[0]!.blurRadius, 10);
    assert.deepEqual(style['filter'], [{ blur: 5 }]);
    assert.deepEqual(style['transformOrigin'], [10, 20, 0]);
  });

  it('settles an em against the font size the element ends up with, whichever rule set it', () => {
    // Deferred values were settled in rule order, so an em from an earlier rule was measured
    // against the inherited size, before a later rule's own deferred font-size was known.
    const styleOf = (css: string) => {
      const resolver = new StyleResolver(compileCss(css), {
        width: 400,
        height: 800,
        colorScheme: 'light',
      });
      const target: StyleTarget = {
        name: 'view',
        parent: null,
        classes: new Set(['x', 'y']),
        props: {},
        sheet: null,
        hostSheet: null,
        styleCache: null,
        styleDirty: true,
      };
      return resolver.resolve(target, 1).style;
    };
    const em = styleOf('.x { padding-top: 1em; line-height: 2em } .y { font-size: 2em }');
    assert.deepEqual([em['fontSize'], em['paddingTop'], em['lineHeight']], [32, 32, 64]);
    const token = styleOf(':root { --f: 20px } .x { padding-top: 1em } .y { font-size: var(--f) }');
    assert.deepEqual([token['fontSize'], token['paddingTop']], [20, 20]);
  });

  it('takes a corner radius in em, which is circular like any other one-value radius', () => {
    // The two halves of a corner were compared by identity, and two em markers are two objects,
    // so every em radius was refused as an elliptical corner.
    assert.deepEqual(compileCss('.a { border-top-left-radius: 1em }').rules[0].deferred, [
      { props: ['borderTopLeftRadius'], compute: { unit: 'em', factor: 1 } },
    ]);
    const corners = compileCss('.a { border-radius: 0.5em }').rules[0].deferred;
    assert.equal(corners.length, 4);
    assert.throws(() => compileCss('.a { border-top-left-radius: 1em 2em }'), /elliptical/);
  });

  it('rounds the factor of a deferred length, which arrives as f32 noise', () => {
    // `letter-spacing: 0.1em` is Bootstrap's and Tailwind's tracking, and 0.1 is not an f32.
    assert.deepEqual(compileCss('.a { letter-spacing: 0.1em }', 'em').rules[0].deferred, [
      { props: ['letterSpacing'], compute: { unit: 'em', factor: 0.1 } },
    ]);
    assert.deepEqual(compileCss('.a { width: 33.3vw }', 'vw').rules[0].deferred, [
      { props: ['width'], compute: { unit: 'vw', factor: 33.3 } },
    ]);
  });

  it('reads the line-height in a font shorthand the way the longhand reads it', () => {
    assert.equal(declarationsOf('font: 12px/150% serif')['lineHeight'], 18);
    assert.equal(declarationsOf('font: 12px/1.5 serif')['lineHeight'], 18);
    // The shorthand resets what it leaves out, and line-height: normal is native's own default.
    assert.equal(declarationsOf('font: 12px serif')['lineHeight'], null);
    // A multiple of an em size was multiplied by the size's deferred marker, and committed NaN.
    const rule = compileCss('.a { font: 1.5em/1.5 serif }', 'em').rules[0];
    assert.equal('lineHeight' in rule.declarations, false);
    assert.deepEqual(rule.deferred, [
      { props: ['fontSize'], compute: { unit: 'em', factor: 1.5 } },
      { props: ['lineHeight'], compute: { unit: 'em', factor: 1.5 } },
    ]);
  });
});

describe('a length written with no unit', () => {
  // A browser drops `margin-top: 3`: only 0 may go without a unit. lightningcss reads it as 3px,
  // so Tailwind's `m-[3]` was a 3pt margin on a phone and nothing on the web.
  const refusals = (css: string) => {
    const refused: string[] = [];
    const sheet = compileCss(css, 'unitless', { onUnsupported: (m: string) => refused.push(m) });
    return { refused, rules: sheet.rules };
  };

  it('is refused, and says a length needs a unit', () => {
    for (const declaration of [
      'margin-top: 3',
      'width: 0.35',
      'padding: 0 3',
      'translate: 3 4',
      'gap: 2',
      'transform-origin: 3',
      'background-size: 3',
      'background-position: 3',
      'margin: calc(3 * -1)',
      'inset-inline: 3',
    ]) {
      const { refused } = refusals(`.a { ${declaration} }`);
      assert.equal(refused.length, 1, declaration);
      assert.match(refused[0]!, /needs a unit/, declaration);
    }
  });

  it('still takes a zero, a unitless line-height and a number inside calc()', () => {
    for (const declaration of [
      'margin: 0',
      'line-height: 1.5',
      'width: calc(3 * 2px)',
      'flex: 1',
      'z-index: 3',
      'opacity: 0.5',
    ]) {
      assert.deepEqual(refusals(`.a { ${declaration} }`).refused, [], declaration);
    }
  });

  it('does not read a bare number token as a length either', () => {
    // `translate-x-[3]` is `--tw-translate-x: 3`, read by `translate` on device.
    const { refused, rules } = refusals('.a { --x: 3; translate: var(--x) 0 }');
    assert.deepEqual(refused, []);
    const target = {
      name: 'view',
      parent: null,
      classes: new Set(['a']),
      props: {},
      sheet: null,
      hostSheet: null,
      styleCache: null,
      styleDirty: true,
    };
    const resolver = new StyleResolver({ rules, keyframes: {} } as never, {
      width: 400,
      height: 800,
      colorScheme: 'light',
    });
    assert.equal(resolver.resolve(target as never, 1).style['__translate'], undefined);
  });
});

describe('numbers CSS keeps in range', () => {
  it('clamps an opacity above 1, as a browser does', () => {
    assert.deepEqual(declarationsOf('opacity: 3'), { opacity: 1 });
    assert.deepEqual(declarationsOf('opacity: -1'), { opacity: 0 });
  });

  it('refuses a font weight outside 1 to 1000, which a browser drops', () => {
    assert.throws(() => declarationsOf('font-weight: 0.35'), /font-weight/);
  });
});
