/**
 * `oklch()`, `oklab()`, `lab()` and `lch()`, converted to sRGB at build time.
 *
 * Native reads `rgb()` and nothing wider, so a colour in a perceptual space is converted here with
 * CSS Color 4's formulas, and one outside sRGB is brought into it by CSS Color 4's gamut mapping
 * (section 13.2: reduce OKLCh chroma until clipping is no longer visible). These were refused,
 * with the parser's raw JSON for a message.
 *
 * References:
 * - The sRGB primaries' coordinates are the ones CSS Color 4 and colorjs.io give: red is
 *   `lab(54.29% 80.8 69.89)`, `lch(54.29% 106.84 40.85)`, `oklab(62.8% 0.2249 0.1258)` and
 *   `oklch(62.8% 0.2577 29.23)`; green is `lab(87.82% -79.29 80.99)` and
 *   `oklab(86.64% -0.2339 0.1795)`; blue is `lab(29.57% 68.3 -112.03)` and
 *   `oklab(45.2% -0.0325 -0.3115)`. Rounded to two places, which is worth up to a step in a
 *   channel, so these are compared within one.
 * - A colour inside sRGB is checked against lightningcss, an independent implementation of the
 *   same conversions, lowering it for a browser without `oklch()`: the `rgb()` fallback it prints.
 * - Outside sRGB, lightningcss is not the reference: it gamut-maps by an earlier draft of the
 *   algorithm, without the first step that returns the clipped colour when clipping is already
 *   invisible, and in single precision. Its answers are given beside ours, and are close.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

const colorOf = (value: string): unknown =>
  compileCss(`view { color: ${value} }`).rules[0].declarations['color'];

/** The three channels of an `rgb()`, for comparing within a tolerance. */
const channels = (value: unknown): number[] =>
  (/rgb\((\d+), (\d+), (\d+)\)/.exec(String(value)) ?? []).slice(1).map(Number);

function near(actual: unknown, expected: string, tolerance: number, message?: string): void {
  const [a, b] = [channels(actual), channels(expected)];
  assert.equal(a.length, 3, `${String(actual)} is an rgb()`);
  const apart = Math.max(...a.map((channel, i) => Math.abs(channel - b[i]!)));
  assert.ok(
    apart <= tolerance,
    `${message ?? ''} ${String(actual)} is within ${tolerance} of ${expected}`,
  );
}

describe('colours in the perceptual spaces', () => {
  it('converts the sRGB primaries from all four spaces', () => {
    const primaries: [string, string][] = [
      ['lab(54.29% 80.8 69.89)', 'rgb(255, 0, 0)'],
      ['lch(54.29% 106.84 40.85)', 'rgb(255, 0, 0)'],
      ['oklab(62.8% 0.2249 0.1258)', 'rgb(255, 0, 0)'],
      ['oklch(62.8% 0.2577 29.23)', 'rgb(255, 0, 0)'],
      ['lab(87.82% -79.29 80.99)', 'rgb(0, 255, 0)'],
      ['oklab(86.64% -0.2339 0.1795)', 'rgb(0, 255, 0)'],
      ['lab(29.57% 68.3 -112.03)', 'rgb(0, 0, 255)'],
      ['oklab(45.2% -0.0325 -0.3115)', 'rgb(0, 0, 255)'],
    ];
    for (const [written, expected] of primaries) near(colorOf(written), expected, 1, written);
  });

  it('converts white, black and a grey', () => {
    assert.equal(colorOf('oklch(100% 0 0)'), 'rgb(255, 255, 255)');
    assert.equal(colorOf('lab(0% 0 0)'), 'rgb(0, 0, 0)');
    // lightningcss: oklch(98.5% 0 0) -> #fafafa, lab(50% 0 0) -> #777777.
    assert.equal(colorOf('oklch(98.5% 0 0)'), 'rgb(250, 250, 250)');
    assert.equal(colorOf('lab(50% 0 0)'), 'rgb(119, 119, 119)');
  });

  it('converts colours inside sRGB exactly', () => {
    // lightningcss: #337344, #af9c7c, #856caa, and lch(60% 40 120) -> #7d9a51.
    assert.equal(colorOf('oklch(50% 0.1 150)'), 'rgb(51, 115, 68)');
    assert.equal(colorOf('oklch(70% 0.05 80)'), 'rgb(175, 156, 124)');
    assert.equal(colorOf('lab(50% 20 -30)'), 'rgb(133, 108, 170)');
    assert.equal(colorOf('lch(60% 40 120)'), 'rgb(125, 154, 81)');
  });

  it('clips a colour just outside sRGB, where the clipping cannot be seen', () => {
    // CSS Color 4, 13.2.2: when the clipped colour is within a just-noticeable difference (0.02
    // in OKLab) of the original, the clipped colour is the answer. Tailwind's blue-500 and
    // red-500 are both just outside. lightningcss, without that step, gives #3080ff for the blue.
    assert.equal(colorOf('oklch(62.3% 0.214 259.815)'), 'rgb(43, 127, 255)');
    assert.equal(colorOf('oklch(63.7% 0.237 25.331)'), 'rgb(251, 44, 54)');
  });

  it('reduces the chroma of a colour far outside sRGB, rather than clipping it', () => {
    // Clipping each channel gives rgb(0, 210, 0) and rgb(233, 0, 255): a hue shift the spec's
    // chroma search exists to avoid. lightningcss's draft of the search: #00c30b and #cf6fff.
    const green = colorOf('oklch(70% 0.4 145)');
    assert.equal(green, 'rgb(0, 195, 6)');
    near(green, 'rgb(0, 195, 11)', 5, 'beside lightningcss:');
    const violet = colorOf('lab(60% 100 -100)');
    assert.equal(violet, 'rgb(208, 110, 255)');
    near(violet, 'rgb(207, 111, 255)', 1, 'beside lightningcss:');
  });

  it('keeps the alpha', () => {
    assert.equal(colorOf('oklch(62.8% 0.2577 29.23 / 50%)'), 'rgba(255, 0, 0, 0.5)');
    assert.equal(colorOf('lab(54.29% 80.8 69.89 / 0.25)'), 'rgba(255, 0, 0, 0.25)');
  });

  it('reads a missing component, none, as zero', () => {
    assert.equal(colorOf('oklch(100% none none)'), 'rgb(255, 255, 255)');
    assert.equal(colorOf('oklch(62.8% 0.2577 29.23 / none)'), 'rgba(255, 0, 0, 0)');
  });

  it('folds a color-mix() in those spaces, which lightningcss hands back in the space', () => {
    // lightningcss: color-mix(in oklab, red, blue) -> #8c53a2, inside sRGB; in oklch -> #b600bd,
    // just outside it; in lab, red 30% with transparent -> rgba(255, 0, 0, 0.3).
    assert.equal(colorOf('color-mix(in oklab, red, blue)'), 'rgb(140, 83, 162)');
    assert.equal(colorOf('color-mix(in oklch, red, blue)'), 'rgb(183, 0, 190)');
    assert.equal(colorOf('color-mix(in lab, red 30%, transparent)'), 'rgba(255, 0, 0, 0.3)');
  });

  it('converts them wherever a colour goes, not only in color', () => {
    const declarations = compileCss(`
      view {
        background-color: oklch(62.8% 0.2577 29.23);
        border: 1px solid lab(29.57% 68.3 -112.03);
        box-shadow: 0 1px 2px oklab(45.2% -0.0325 -0.3115);
      }
    `).rules[0].declarations;
    assert.equal(declarations['backgroundColor'], 'rgb(255, 0, 0)');
    assert.equal(declarations['borderTopColor'], 'rgb(0, 0, 255)');
    assert.equal((declarations['boxShadow'] as { color: string }[])[0]!.color, 'rgb(0, 0, 255)');
  });

  it('converts one held in a custom property', () => {
    const sheet = compileCss(':root { --brand: oklch(62.8% 0.2577 29.23) }');
    assert.deepEqual(sheet.rules[0].tokens['--brand'].color, 'rgb(255, 0, 0)');
  });

  it('refuses a space it does not convert in words, not in the parser JSON', () => {
    assert.throws(
      () => colorOf('color(display-p3 1 0 0)'),
      (error: Error) => /display-p3/.test(error.message) && !/[{"]/.test(error.message),
    );
    // lightningcss folds an hsl() to rgb itself, unless it has a none in it.
    assert.throws(() => colorOf('hsl(none 100% 50%)'), /'none' component/);
  });
});

describe('a missing alpha', () => {
  // CSS Color 4 treats a `none` component as zero where a value is needed, so a colour whose
  // alpha is `none` is transparent. lightningcss hands it over as NaN, which reached native as
  // `rgba(255, 0, 0, NaN)` and drew nothing predictable.
  it('is transparent', () => {
    assert.equal(colorOf('rgb(255 0 0 / none)'), 'rgba(255, 0, 0, 0)');
    assert.equal(
      colorOf('oklch(62.8% 0.2577 29.23 / none)'),
      colorOf('oklch(62.8% 0.2577 29.23 / 0)'),
    );
  });
});

describe('a missing component', () => {
  it('reads none as zero, so a lab() with no lightness is black rather than NaN', () => {
    assert.equal(colorOf('lab(none 20 30)'), 'rgb(0, 0, 0)');
  });
});
