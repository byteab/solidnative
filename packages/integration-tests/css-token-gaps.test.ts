/**
 * Three places a token goes in the stylesheets design systems ship, which each read on device:
 * a `text-shadow` coloured by one, `flex: var(--grow)`, and a radial gradient centred at one.
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
  const resolver = new StyleResolver(compileCss(css, 'gaps'), {
    width: 400,
    height: 800,
    colorScheme: 'light',
  });
  return resolver.resolve(node, 1).style as Record<string, unknown>;
}

describe('a token of the wrong kind', () => {
  // A browser drops a declaration whose var() substitutes to the wrong type: `translate` needs a
  // length, and `30deg` is not one. Reading the token's number instead moved the box 30 points.
  it('does not read an angle as a length', () => {
    assert.equal(
      resolvedStyle('.a { --x: 30deg; translate: var(--x) 0 }')['__translate'],
      undefined,
    );
  });

  it('does not read a length as a scale factor', () => {
    assert.equal(resolvedStyle('.a { --s: 13px; scale: var(--s) }')['__scale'], undefined);
  });

  it('does not read an angle as a scale factor', () => {
    assert.equal(resolvedStyle('.a { --s: 30deg; scale: var(--s) }')['__scale'], undefined);
  });

  it('still reads a zero as a length, which CSS allows unitless', () => {
    assert.deepEqual(resolvedStyle('.a { --x: 0; translate: var(--x) 4px }')['__translate'], [
      { translateX: 0 },
      { translateY: 4 },
    ]);
  });
});

describe('text-shadow with tokens', () => {
  it('takes its colour from a token', () => {
    const style = resolvedStyle('.a { --glow: #3b82f6; text-shadow: 0 1px 2px var(--glow); }');
    assert.deepEqual(style['textShadowOffset'], { width: 0, height: 1 });
    assert.equal(style['textShadowRadius'], 2);
    assert.equal(style['textShadowColor'], 'rgb(59, 130, 246)');
  });

  it('takes a length and a mixed colour from tokens too', () => {
    const style = resolvedStyle(
      '.a { --lift: 3px; --ink: #000000; text-shadow: 0 var(--lift) 6px color-mix(in srgb, var(--ink) 50%, white); }',
    );
    assert.deepEqual(style['textShadowOffset'], { width: 0, height: 3 });
    assert.equal(style['textShadowRadius'], 6);
    assert.equal(style['textShadowColor'], 'rgb(128, 128, 128)');
  });

  it('refuses a whole text-shadow in one token, with a reason, rather than crashing', () => {
    // Tailwind's `text-shadow-(--x)`. Native's text shadow is three props, and a token is read in
    // one form, so the parts have to be written out.
    const dropped: string[] = [];
    compileCss('.a { text-shadow: var(--x) }', 't', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /dropped 'text-shadow'.*write its parts out/);
  });

  it('is not written when its colour token is not set', () => {
    const style = resolvedStyle('.a { text-shadow: 0 1px 2px var(--nothing); }');
    assert.equal(style['textShadowColor'], undefined);
  });
});

describe('flex with a token', () => {
  it('grows by the token, as flex: <number> does', () => {
    const style = resolvedStyle('.a { --grow: 2; flex: var(--grow); }');
    assert.equal(style['flexGrow'], 2);
    assert.equal(style['flexShrink'], 1);
    assert.equal(style['flexBasis'], '0%');
  });

  it("takes flex's initial value when the token is not set, as the web does", () => {
    // `flex-(--x)` with no --x is invalid at computed-value time, and such a property takes its
    // initial value, `0 1 auto`, whatever a weaker rule set. Left out, Yoga's own shrink of 0
    // applied, and a row that shrank on the web did not on a phone.
    const style = resolvedStyle('.a { flex: var(--missing); }');
    assert.equal(style['flexGrow'], 0);
    assert.equal(style['flexShrink'], 1);
    assert.equal(style['flexBasis'], 'auto');
    const over = resolvedStyle('.a { flex: 1; } .a.a { flex: var(--missing); }');
    assert.equal(over['flexGrow'], 0);
  });

  it('lets a longhand written after flex: var() win, as the cascade does', () => {
    // The shrink the shorthand stands for is settled on device; a later static flex-shrink in the
    // same rule, or a stronger rule, still has the last word, as on the web.
    assert.equal(
      resolvedStyle('.a { --g: 2; flex: var(--g); flex-shrink: 0; }')['flexShrink'],
      0,
      'later in the same rule',
    );
    assert.equal(
      resolvedStyle('.a { --g: 2; flex: var(--g); } .a.a { flex-shrink: 0; }')['flexShrink'],
      0,
      'a stronger rule',
    );
    assert.equal(
      resolvedStyle('.a { flex-shrink: 0; flex: var(--g, 2); }')['flexShrink'],
      1,
      'the shorthand written after it',
    );
  });

  it('gives each flex longhand its initial value when its token is not set', () => {
    assert.equal(resolvedStyle('.a { flex-shrink: var(--missing); }')['flexShrink'], 1);
    assert.equal(resolvedStyle('.a { flex-grow: var(--missing); }')['flexGrow'], 0);
    assert.equal(resolvedStyle('.a { flex-basis: var(--missing); }')['flexBasis'], 'auto');
    assert.equal(resolvedStyle('.a { --s: 0; flex-shrink: var(--s); }')['flexShrink'], 0);
  });
});

describe('a radial gradient centred at a token', () => {
  it('reads the position from the token', () => {
    const style = resolvedStyle(
      '.a { --x: 20%; background-image: radial-gradient(circle at var(--x) 30%, red, blue); }',
    );
    const [gradient] = style['experimental_backgroundImage'] as { position: unknown }[];
    assert.deepEqual(gradient!.position, { left: '20%', top: '30%' });
  });

  it('falls back to what is written beside the var()', () => {
    const style = resolvedStyle(
      '.a { background-image: radial-gradient(circle at var(--x, 10%) bottom, red, blue); }',
    );
    const [gradient] = style['experimental_backgroundImage'] as { position: unknown }[];
    assert.deepEqual(gradient!.position, { left: '10%', bottom: 0 });
  });
});

describe('a gradient stop that is a token with a fallback', () => {
  it('paints the fallback when the token is not set', () => {
    const style = resolvedStyle(
      '.a { background-image: linear-gradient(red, var(--tint, blue)); }',
    );
    const [gradient] = style['experimental_backgroundImage'] as {
      colorStops: { color: string }[];
    }[];
    assert.deepEqual(
      gradient!.colorStops.map((stop) => stop.color),
      ['red', 'blue'],
    );
  });
});

describe('a logical border side with a token in it', () => {
  it('draws the start side in the token colour', () => {
    const style = resolvedStyle(
      '.a { --accent: #ff0000; border-inline-start: 4px solid var(--accent); }',
    );
    assert.equal(style['borderStartWidth'], 4);
    assert.equal(style['borderStartColor'], 'rgb(255, 0, 0)');
  });

  it('draws both block sides in it', () => {
    const style = resolvedStyle('.a { --rule: #0000ff; border-block: 1px solid var(--rule); }');
    assert.equal(style['borderTopColor'], 'rgb(0, 0, 255)');
    assert.equal(style['borderBottomColor'], 'rgb(0, 0, 255)');
    assert.equal(style['borderBottomWidth'], 1);
  });
});

describe('the direction a flex box lays out in', () => {
  // Every node is a column, on native and in @solid-native/web's reset alike, so one class string lays
  // out the same on both hosts: `display: flex` does not make a row, as it does in a plain browser.
  // A row is written, as `flex-row`. See components/layout.md.
  const direction = (css: string, classes = ['a']) => {
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
    const resolver = new StyleResolver(compileCss(css, 'flex'), {
      width: 400,
      height: 800,
      colorScheme: 'light',
    });
    return resolver.resolve(target(target(null, []), classes), 1).style['flexDirection'];
  };

  it('keeps a flex box a column, as every node on both hosts is', () => {
    assert.equal(direction('.a { display: flex }'), undefined);
    assert.equal(direction('.a { display: inline-flex }'), undefined);
  });

  it('lays out in a row where a row is written', () => {
    assert.equal(direction('.a { display: flex; flex-direction: row }'), 'row');
  });
});

describe('a border style that draws no border', () => {
  // `border-style: none` and `hidden` make every border width 0 on the web, whatever set the
  // width. Compiled to widths of 0, a width from a later rule - `border-hidden border-x` - drew.
  const style = (css: string, classes: string[]) => {
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
    const resolver = new StyleResolver(compileCss(css, 'border'), {
      width: 400,
      height: 800,
      colorScheme: 'light',
    });
    return resolver.resolve(target(target(null, []), classes), 1).style;
  };

  it('zeroes a width a later rule sets', () => {
    const resolved = style(
      '.hidden-b { border-style: hidden } .x { border-left-width: 2px; border-right-width: 2px }',
      ['hidden-b', 'x'],
    );
    assert.equal(resolved['borderLeftWidth'], 0);
    assert.equal(resolved['borderRightWidth'], 0);
  });

  it('draws again once a later rule gives it a style', () => {
    const resolved = style(
      '.n { border-style: none } .s { border-style: solid; border-width: 2px }',
      ['n', 's'],
    );
    assert.equal(resolved['borderTopWidth'] ?? resolved['borderWidth'], 2);
  });
});
