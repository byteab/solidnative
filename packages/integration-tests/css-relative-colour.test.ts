/**
 * Relative colours with a `var()` in them, worked out on device: `oklch(from var(--brand) l c h /
 * 0.2)`, the way a design system derives a tint, a hover shade or a translucent ring from one
 * token.
 *
 * The origin is converted into the function's space, each channel keyword stands for its number
 * there, and the channels written - keywords, numbers, `calc()` of them - make the new colour. The
 * expected colours are what Chromium paints for the same declarations, except where a colour falls
 * outside sRGB: Chromium clips, and this engine maps into the gamut as CSS Color 4 says, as it
 * does for `color-mix()`, so there the expectation is the build's own answer for the literal.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { StyleResolver, type StyleTarget } from '@solid-native/fabric';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

function resolvedStyle(css: string): Record<string, unknown> {
  const target = (parent: StyleTarget | null, own: string[]): StyleTarget => ({
    name: 'view',
    parent,
    classes: new Set(own),
    props: {},
    sheet: null,
    hostSheet: null,
    styleCache: null,
    styleDirty: true,
  });
  const node = target(target(null, []), ['a']);
  const resolver = new StyleResolver(compileCss(css, 'relative'), {
    width: 400,
    height: 800,
    colorScheme: 'light',
  });
  return resolver.resolve(node, 1).style as Record<string, unknown>;
}

const colourOf = (token: string, expression: string) =>
  resolvedStyle(`.a { --t: ${token}; color: ${expression}; }`)['color'];

/** [origin token, relative colour, what Chromium paints]. */
const CHROMIUM: readonly [string, string, string][] = [
  ['#3b82f6', 'oklch(from var(--t) l c h / 0.2)', 'rgba(59, 130, 246, 0.2)'],
  ['#3b82f6', 'oklch(from var(--t) calc(l + 0.1) calc(c * 0.6) h)', 'rgb(123, 166, 236)'],
  ['#3b82f6', 'rgb(from var(--t) r g b / 50%)', 'rgba(59, 130, 246, 0.5)'],
  ['#3b82f6', 'hsl(from var(--t) h s calc(l - 20))', 'rgb(9, 79, 194)'],
  [
    'rgba(59, 130, 246, 0.8)',
    'lab(from var(--t) l a b / calc(alpha * 0.5))',
    'rgba(59, 130, 246, 0.4)',
  ],
  ['#3b82f6', 'oklab(from var(--t) l calc(a * -1) b)', 'rgb(117, 115, 244)'],
  ['#3b82f6', 'hwb(from var(--t) h calc(w + 20) b)', 'rgb(110, 162, 246)'],
  ['#e11d48', 'rgb(from var(--missing, #e11d48) r g calc(b + 100))', 'rgb(225, 29, 172)'],
  ['#3b82f6', 'oklch(from color-mix(in srgb, var(--t) 50%, white) l c h)', 'rgb(157, 193, 251)'],
  ['#808080', 'hsl(from var(--t) calc(h + 30) 50% l)', 'rgb(191, 128, 64)'],
  ['#3b82f6', 'oklch(from var(--t) calc((l + 0.1) * 0.5) c h)', 'rgb(0, 46, 157)'],
  ['#3b82f6', 'oklch(from var(--t) calc(l + 0.05) calc(c * 0.5) 0.4turn)', 'rgb(114, 165, 113)'],
];

/**
 * The same colour to within one step of a channel: a channel that lands on exactly half a step,
 * as a grey's does, rounds up here and down in Chromium's painter. The alpha must match exactly.
 */
function assertPainted(actual: unknown, expected: string): void {
  const channels = (colour: string) => colour.match(/[\d.]+/g)!.map(Number);
  const [got, want] = [channels(String(actual)), channels(expected)];
  assert.equal(got.length, want.length, `${actual} is not ${expected}`);
  got.slice(0, 3).forEach((channel, i) => {
    assert.ok(Math.abs(channel - want[i]!) <= 1, `${actual} is not ${expected}`);
  });
  assert.equal(got[3], want[3], `${actual} has not the alpha of ${expected}`);
}

describe('relative colours from a token', () => {
  for (const [token, expression, painted] of CHROMIUM) {
    it(`${expression} from ${token}`, () => {
      assertPainted(colourOf(token, expression), painted);
    });
  }

  it('maps a colour outside sRGB into it, as the build does the same colour written out', () => {
    const literal = compileCss('.a { color: oklch(0.95 0.487997 259.821); }', 'literal').rules[0]
      .declarations.color;
    assert.equal(colourOf('#3b82f6', 'oklch(from var(--t) 0.95 calc(c + 0.3) h)'), literal);
  });

  it('works in a shadow and in a gradient stop', () => {
    const style = resolvedStyle(
      '.a { --t: #3b82f6;' +
        ' box-shadow: 0 4px 8px oklch(from var(--t) l c h / 0.4);' +
        ' background-image: linear-gradient(oklch(from var(--t) calc(l + 0.1) calc(c * 0.6) h), var(--t)); }',
    );
    assert.equal((style['boxShadow'] as { color: string }[])[0]!.color, 'rgba(59, 130, 246, 0.4)');
    const stops = (
      style['experimental_backgroundImage'] as { colorStops: { color: string }[] }[]
    )[0]!.colorStops;
    assert.equal(stops[0]!.color, 'rgb(123, 166, 236)');
  });

  it('is not painted when its token is not set and has no fallback', () => {
    assert.equal(
      resolvedStyle('.a { color: oklch(from var(--nothing) l c h); }')['color'],
      undefined,
    );
  });

  it('refuses a channel that adds a percentage or an angle to a keyword, which CSS does not allow', () => {
    for (const expression of [
      'oklch(from var(--t) calc(l - 10%) c h)',
      'lch(from var(--t) l c calc(h + 90deg))',
    ]) {
      assert.throws(() => compileCss(`.a { --t: red; color: ${expression}; }`, 'bad'), /relative/);
    }
  });
});
