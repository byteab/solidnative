/**
 * `light-dark()`: one colour for a light scheme and another for a dark one, written in place.
 *
 * Native has one colour scheme, the app's, which is what `prefers-color-scheme` reads too. So a
 * rule with a `light-dark()` in it is the light rule, and a dark copy of it under that query: every
 * form a colour takes - a literal, a token, a stop in a gradient, a shadow's colour - then works
 * in both, by the paths that already settle it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { StyleResolver, type StyleTarget } from '@solidnative/fabric';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

/** What an element wearing `classes` resolves to, in a scheme and at a width. */
function resolvedStyle(
  css: string,
  classes: string[],
  colorScheme: 'light' | 'dark',
  width = 400,
): Record<string, unknown> {
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
  const root = target(null, []);
  const node = target(root, classes);
  const resolver = new StyleResolver(compileCss(css, 'scheme'), {
    width,
    height: 800,
    colorScheme,
  });
  return resolver.resolve(node, 1).style as Record<string, unknown>;
}

const both = (css: string, classes: string[], width?: number) =>
  (['light', 'dark'] as const).map((scheme) => resolvedStyle(css, classes, scheme, width));

describe('light-dark()', () => {
  it('picks the colour for the scheme', () => {
    const [light, dark] = both('.a { color: light-dark(#111111, #eeeeee); }', ['a']);
    assert.equal(light!['color'], 'rgb(17, 17, 17)');
    assert.equal(dark!['color'], 'rgb(238, 238, 238)');
  });

  it('can be a token, which every var() of it then follows', () => {
    const css = '.a { --surface: light-dark(white, black); background-color: var(--surface); }';
    const [light, dark] = both(css, ['a']);
    assert.equal(light!['backgroundColor'], 'rgb(255, 255, 255)');
    assert.equal(dark!['backgroundColor'], 'rgb(0, 0, 0)');
  });

  it('can have tokens in it, in a shadow', () => {
    const css = '.a { --glow: #3b82f6; box-shadow: 0 2px 4px light-dark(var(--glow), black); }';
    const [light, dark] = both(css, ['a']);
    const colourOf = (style: Record<string, unknown>) =>
      (style['boxShadow'] as { color: string }[])[0]!.color;
    assert.equal(colourOf(light!), 'rgb(59, 130, 246)');
    assert.equal(colourOf(dark!), 'black');
  });

  it('can be in a color-mix(), and be a token with tokens in it', () => {
    const css =
      '.a { --brand: #3b82f6; --ink: light-dark(var(--brand), white);' +
      ' color: color-mix(in srgb, light-dark(var(--ink), black) 50%, white); }';
    const [light, dark] = both(css, ['a']);
    assert.equal(light!['color'], 'rgb(157, 193, 251)');
    assert.equal(dark!['color'], 'rgb(128, 128, 128)');
  });

  it('can have a relative colour on one side and a plain colour on the other', () => {
    const css = '.a { --t: #3b82f6; color: light-dark(oklch(from var(--t) l c h / 0.5), white); }';
    const [light, dark] = both(css, ['a']);
    assert.equal(light!['color'], 'rgba(59, 130, 246, 0.5)');
    assert.equal(dark!['color'], 'white');
  });

  it('can be a stop in a gradient', () => {
    const css = '.a { background-image: linear-gradient(light-dark(white, black), red); }';
    const [light, dark] = both(css, ['a']);
    const first = (style: Record<string, unknown>) =>
      (style['experimental_backgroundImage'] as { colorStops: { color: string }[] }[])[0]!
        .colorStops[0]!.color;
    assert.match(first(light!), /255, 255, 255|white/);
    assert.match(first(dark!), /0, 0, 0|black/);
  });

  it('leaves the declarations beside it alone in the dark', () => {
    const css = '.a { padding: 4px; color: light-dark(red, blue); }';
    const [, dark] = both(css, ['a']);
    assert.equal(dark!['color'], 'rgb(0, 0, 255)');
    assert.equal(dark!['paddingTop'], 4);
  });

  it('keeps its place in the cascade: a later rule still wins in the dark', () => {
    const css = '.a { color: light-dark(red, blue); } .b { color: green; }';
    const [light, dark] = both(css, ['a', 'b']);
    assert.equal(light!['color'], 'rgb(0, 128, 0)');
    assert.equal(dark!['color'], 'rgb(0, 128, 0)');
  });

  it('and an earlier rule still loses', () => {
    const css = '.b { color: green; } .a { color: light-dark(red, blue); }';
    const [, dark] = both(css, ['a', 'b']);
    assert.equal(dark!['color'], 'rgb(0, 0, 255)');
  });

  it('in a media query, answers to both the query and the scheme', () => {
    const css = '@media (min-width: 300px) { .a { color: light-dark(red, blue); } }';
    assert.equal(resolvedStyle(css, ['a'], 'dark', 400)['color'], 'rgb(0, 0, 255)');
    assert.equal(resolvedStyle(css, ['a'], 'dark', 200)['color'], undefined);
    assert.equal(resolvedStyle(css, ['a'], 'light', 400)['color'], 'rgb(255, 0, 0)');
  });
});
