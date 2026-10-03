/**
 * `color-mix()` with a `var()` in it, worked out on device: in a colour property, in a gradient's
 * stops and in a shadow's colour.
 *
 * A bound custom property is how a list themes each row - a cover's colour, a label's tint - and a
 * design system mixes from it for the lighter and darker shades beside it. The token's value is
 * only known on device, so the mix has to be too, with the named space's own arithmetic: `in
 * oklch` and `in srgb` give different colours, and a naive blend would be wrong in a way nobody
 * would think to check. So every mix here is checked against lightningcss's own answer for the
 * same colours written literally, which is what a browser paints.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { StyleResolver, type StyleTarget } from '@solid-native/fabric';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

/** What an element wearing `classes` under a root wearing `rootClasses` resolves to. */
function resolvedStyle(css: string, classes: string[], rootClasses: string[] = []) {
  const target = (name: string, parent: StyleTarget | null, own: string[]): StyleTarget => ({
    name,
    parent,
    classes: new Set(own),
    props: {},
    sheet: null,
    hostSheet: null,
    styleCache: null,
    styleDirty: true,
  });
  const root = target('view', null, rootClasses);
  const node = target('view', root, classes);
  const resolver = new StyleResolver(compileCss(css, 'mix'), {
    width: 400,
    height: 800,
    colorScheme: 'light',
  });
  return resolver.resolve(node, 1).style as Record<string, unknown>;
}

/** A colour string as channels and an alpha, for comparing with room for rounding. */
function channels(colour: unknown): [number, number, number, number] {
  const match = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(String(colour));
  assert.ok(match, `a colour, not ${String(colour)}`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 1)];
}

function assertSameColour(actual: unknown, expected: unknown, what: string) {
  const [a, b] = [channels(actual), channels(expected)];
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(a[i]! - b[i]!) <= 1,
      `${what}: ${String(actual)} is not ${String(expected)}`,
    );
  }
  assert.ok(Math.abs(a[3] - b[3]) <= 0.01, `${what}: alpha of ${String(actual)}`);
}

/** lightningcss's own mix of the same colours written literally. */
function literalMix(mix: string): unknown {
  return compileCss(`.a { color: ${mix} }`, 'literal').rules[0].declarations['color'];
}

describe('color-mix with a token, on device', () => {
  const cases: [space: string, token: string, partner: string][] = [
    ['srgb', '#1d4ed8', 'white'],
    ['oklab', '#0f766e', 'white'],
    ['oklch', '#1d4ed8', 'white'],
    ['oklch', 'rgb(255, 0, 0)', 'rgb(0, 0, 255)'],
    ['lab', '#7c3aed', 'rgb(200, 160, 40)'],
    ['lch', '#15803d', 'rgb(200, 30, 90)'],
    ['hsl', '#c2410c', 'rgb(20, 40, 200)'],
    ['hwb', '#334155', 'rgb(255, 200, 0)'],
  ];

  it('treats an achromatic colour s hue as missing, as a browser does', () => {
    // CSS Color 4 makes the hue of black, white and every grey powerless, and a powerless hue is
    // missing when mixing, so it takes the other colour's. lightningcss 1.33 keeps a hue for pure
    // black and for a near-white in lch, and folds these literal mixes differently; the values
    // here are what Chromium paints for them.
    const mixed = (token: string, mix: string) =>
      resolvedStyle(`.theme { --x: ${token} } .a { color: ${mix} }`, ['a'], ['theme'])['color'];
    assertSameColour(
      mixed('#be123c', 'color-mix(in oklch, var(--x) 70%, black)'),
      'rgb(117, 7, 33)',
      'with black',
    );
    assertSameColour(
      mixed('#15803d', 'color-mix(in lch, var(--x) 70%, rgb(250, 250, 250))'),
      'rgb(102, 164, 115)',
      'with a near-white',
    );
  });

  for (const [space, token, partner] of cases) {
    it(`mixes in ${space} as the literal mix would: ${token} with ${partner}`, () => {
      const style = resolvedStyle(
        `.theme { --x: ${token} } .a { color: color-mix(in ${space}, var(--x) 70%, ${partner}) }`,
        ['a'],
        ['theme'],
      );
      assertSameColour(
        style['color'],
        literalMix(`color-mix(in ${space}, ${token} 70%, ${partner})`),
        space,
      );
    });
  }

  it('reads percentages as CSS does: missing, one-sided, and summing under 100', () => {
    const style = (mix: string) =>
      resolvedStyle(`.theme { --x: #1d4ed8 } .a { color: ${mix} }`, ['a'], ['theme'])['color'];
    for (const [withVar, literal] of [
      ['color-mix(in oklch, var(--x), white)', 'color-mix(in oklch, #1d4ed8, white)'],
      ['color-mix(in oklch, var(--x), white 20%)', 'color-mix(in oklch, #1d4ed8, white 20%)'],
      ['color-mix(in srgb, var(--x) 30%, white 30%)', 'color-mix(in srgb, #1d4ed8 30%, white 30%)'],
    ] as const) {
      assertSameColour(style(withVar), literalMix(literal), withVar);
    }
  });

  it('mixes a translucent token with its alpha premultiplied, as CSS does', () => {
    const style = resolvedStyle(
      '.theme { --x: rgba(0, 128, 0, 0.5) } .a { color: color-mix(in oklab, var(--x) 40%, white) }',
      ['a'],
      ['theme'],
    );
    assertSameColour(
      style['color'],
      literalMix('color-mix(in oklab, rgba(0, 128, 0, 0.5) 40%, white)'),
      'translucent',
    );
  });

  it('mixes two tokens', () => {
    const style = resolvedStyle(
      '.theme { --a: #1d4ed8; --b: #be123c } .a { background-color: color-mix(in oklch, var(--a), var(--b)) }',
      ['a'],
      ['theme'],
    );
    assertSameColour(
      style['backgroundColor'],
      literalMix('color-mix(in oklch, #1d4ed8, #be123c)'),
      'two tokens',
    );
  });

  it('follows the token to where it is redefined, so a row can theme its own shades', () => {
    const css =
      '.theme { --x: #1d4ed8 } .row { --x: #be123c } .a { color: color-mix(in oklch, var(--x) 70%, white) }';
    assertSameColour(
      resolvedStyle(css, ['a', 'row'], ['theme'])['color'],
      literalMix('color-mix(in oklch, #be123c 70%, white)'),
      'redefined',
    );
  });

  it('paints nothing, and says why, when the token is not defined anywhere', () => {
    const style = resolvedStyle('.a { color: color-mix(in oklch, var(--nowhere) 70%, white) }', [
      'a',
    ]);
    assert.equal(style['color'], undefined);
  });
});

describe('gradients with tokens in their stops', () => {
  const stopsOf = (style: Record<string, unknown>) =>
    (
      style['experimental_backgroundImage'] as { colorStops: { color: unknown }[] }[] | undefined
    )?.[0]?.colorStops;

  it('fills in a stop that mixes from a token, beside a plain token stop and a literal one', () => {
    const style = resolvedStyle(
      `.theme { --cover: #1d4ed8 }
       .a { background-image: linear-gradient(160deg, color-mix(in oklch, var(--cover) 70%, white), var(--cover) 55%, rgb(0, 0, 0)) }`,
      ['a'],
      ['theme'],
    );
    const stops = stopsOf(style);
    assert.equal(stops?.length, 3);
    assertSameColour(
      stops![0]!.color,
      literalMix('color-mix(in oklch, #1d4ed8 70%, white)'),
      'mixed stop',
    );
    assertSameColour(stops![1]!.color, 'rgb(29, 78, 216)', 'token stop');
    assertSameColour(stops![2]!.color, 'rgb(0, 0, 0)', 'literal stop');
    const image = style['experimental_backgroundImage'] as { direction: unknown }[];
    assert.deepEqual(image[0]!.direction, { type: 'angle', value: 160 });
  });

  it('paints every layer of a layered background, each with its stops filled in', () => {
    const style = resolvedStyle(
      `.theme { --cover: #1d4ed8 }
       .a { background-image: radial-gradient(circle at 50% 18%, color-mix(in oklch, var(--cover) 75%, white) 0%, transparent 60%), linear-gradient(180deg, var(--cover), black 75%) }`,
      ['a'],
      ['theme'],
    );
    const layers = style['experimental_backgroundImage'] as {
      type: string;
      colorStops: { color: unknown }[];
    }[];
    assert.deepEqual(
      layers.map((layer) => layer.type),
      ['radial-gradient', 'linear-gradient'],
    );
    assertSameColour(layers[1]!.colorStops[0]!.color, 'rgb(29, 78, 216)', 'second layer token');
  });

  it('keeps a radial gradient s shape with its stops filled in', () => {
    const style = resolvedStyle(
      `.theme { --cover: #7c3aed }
       .a { background-image: radial-gradient(circle at 50% 18%, color-mix(in oklch, var(--cover) 75%, white) 0%, transparent 60%) }`,
      ['a'],
      ['theme'],
    );
    const image = style['experimental_backgroundImage'] as {
      type: string;
      shape: string;
      colorStops: { position: unknown }[];
    }[];
    assert.equal(image[0]!.type, 'radial-gradient');
    assert.equal(image[0]!.shape, 'circle');
    assert.deepEqual(
      image[0]!.colorStops.map((stop) => stop.position),
      ['0%', '60%'],
    );
  });
});

describe('shadows with a token in their colour', () => {
  it('fills in a shadow colour that mixes from a token, beside a literal shadow', () => {
    const style = resolvedStyle(
      `.theme { --cover: #1d4ed8 }
       .a { box-shadow: 0 14px 24px -10px color-mix(in oklch, var(--cover) 80%, transparent), 0 1px 0 red }`,
      ['a'],
      ['theme'],
    );
    const shadows = style['boxShadow'] as Record<string, unknown>[];
    assert.equal(shadows.length, 2);
    assert.deepEqual(
      { ...shadows[0], color: undefined },
      {
        offsetX: 0,
        offsetY: 14,
        blurRadius: 24,
        spreadDistance: -10,
        color: undefined,
        inset: false,
      },
    );
    assertSameColour(shadows[0]!['color'], 'rgba(29, 78, 216, 0.8)', 'faded token');
    assert.equal(shadows[1]!['offsetY'], 1);
  });

  it('keeps inset, and takes a plain token as the colour', () => {
    const style = resolvedStyle(
      '.theme { --ring: #be123c } .a { box-shadow: inset 0 0 0 2px var(--ring) }',
      ['a'],
      ['theme'],
    );
    const [shadow] = style['boxShadow'] as Record<string, unknown>[];
    assert.equal(shadow!['inset'], true);
    assert.equal(shadow!['spreadDistance'], 2);
    assertSameColour(shadow!['color'], 'rgb(190, 18, 60)', 'token colour');
  });
});

describe('the shadows design systems write, with tokens in them', () => {
  const shadowsOf = (css: string, tokens: string) =>
    resolvedStyle(`.theme { ${tokens} } .a { box-shadow: ${css} }`, ['a'], ['theme'])[
      'boxShadow'
    ] as Record<string, unknown>[] | undefined;

  it('takes a colour whose channels are a token, as a Bootstrap focus ring does', () => {
    const [ring] = shadowsOf(
      '0 0 0 0.25rem rgba(var(--bs-success-rgb), 0.25)',
      '--bs-success-rgb: 25, 135, 84',
    )!;
    assert.equal(ring!['spreadDistance'], 4);
    assertSameColour(ring!['color'], 'rgba(25, 135, 84, 0.25)', 'channels');
  });

  it('takes a token as a length, and arithmetic around one', () => {
    const [ring] = shadowsOf('0 0 0 var(--w) var(--c)', '--w: 3px; --c: #be123c')!;
    assert.equal(ring!['spreadDistance'], 3);
    const [edge] = shadowsOf('inset 0 calc(-1 * var(--bw)) 0 var(--bc)', '--bw: 2px; --bc: black')!;
    assert.equal(edge!['offsetY'], -2);
    assert.equal(edge!['inset'], true);
  });

  it('splices a whole shadow token into a list, and uses its fallback when it is not set', () => {
    const shadows = shadowsOf(
      'var(--hover, 0 0 0 rgba(0, 0, 0, 0)), 0 0 0 var(--w) var(--focus)',
      '--w: 2px; --focus: #1d4ed8',
    )!;
    // The fallback is a shadow nobody can see, which is dropped as the compiler drops one.
    assert.equal(shadows.length, 1, 'the ring alone');
    assert.equal(shadows[0]!['spreadDistance'], 2);
    const themed = resolvedStyle(
      '.theme { --hover: 0 4px 8px rgba(0, 0, 0, 0.2); --w: 2px; --focus: red } .a { box-shadow: var(--hover, 0 0 0 rgba(0, 0, 0, 0)), 0 0 0 var(--w) var(--focus) }',
      ['a'],
      ['theme'],
    )['boxShadow'] as Record<string, unknown>[];
    assert.equal(themed.length, 2);
    assert.equal(themed[0]!['offsetY'], 4, 'the token s own shadow');
  });

  it('reads a shadow token whose colour is another token', () => {
    // Tailwind's `ring-2` sets `--tw-ring-shadow: 0 0 0 2px var(--tw-ring-color, ...)`, and
    // `ring-blue-500` sets the colour from a class of its own.
    const shadows = resolvedStyle(
      '.ring { --ring: 0 0 0 2px var(--ring-colour, #000); box-shadow: var(--ring) } ' +
        '.blue { --ring-colour: rgb(0, 0, 255) }',
      ['ring', 'blue'],
    )['boxShadow'] as Record<string, unknown>[];
    assert.equal(shadows.length, 1);
    assert.equal(shadows[0]!['spreadDistance'], 2);
    assert.equal(shadows[0]!['color'], 'rgb(0, 0, 255)');
  });

  it('insets a shadow from a token that is the word inset or nothing', () => {
    // `--tw-ring-shadow: var(--tw-ring-inset,) 0 0 0 2px ...`, and `ring-inset` sets the word.
    const css =
      '.ring { --ring: var(--ring-inset,) 0 0 0 2px rgb(0, 0, 255); box-shadow: var(--ring) } ' +
      '.in { --ring-inset: inset }';
    const inset = (classes: string[]) =>
      (resolvedStyle(css, classes)['boxShadow'] as Record<string, unknown>[])[0]!['inset'];
    assert.equal(inset(['ring', 'in']), true);
    assert.equal(inset(['ring']), false);
  });

  it('takes an empty-fallback token as the colour when the shadow has no other', () => {
    // `var(--x,)` is inset-or-nothing in Tailwind's ring, which has a colour of its own. A shadow
    // with no other colour term is coloured by it, as a browser reads it: read as inset, a red
    // shadow came out black. What the token holds decides, since either can be written there.
    const css =
      '.s { box-shadow: var(--colour,) 0 0 4px 2px } .red { --colour: red } .in { --colour: inset }';
    const shadow = (classes: string[]) =>
      (resolvedStyle(css, classes)['boxShadow'] as Record<string, unknown>[])[0]!;
    assert.equal(shadow(['s', 'red'])['color'], 'rgb(255, 0, 0)');
    assert.equal(shadow(['s', 'red'])['inset'], false);
    assert.equal(shadow(['s', 'in'])['inset'], true);
  });

  it('takes currentcolor from a colour the node sets from a token, whatever the order', () => {
    // Both are settled on device. The colour has to be settled first, or the shadow reads the
    // inherited one, or black, where a browser uses the node's own.
    for (const css of [
      '.ring { box-shadow: 0 0 0 2px var(--ring-colour, currentcolor) } .green { --c: rgb(0, 128, 0); color: var(--c) }',
      '.green { --c: rgb(0, 128, 0); color: var(--c) } .ring { box-shadow: 0 0 0 2px var(--ring-colour, currentcolor) }',
    ]) {
      const shadow = resolvedStyle(css, ['ring', 'green'])['boxShadow'] as Record<
        string,
        unknown
      >[];
      assert.equal(shadow[0]!['color'], 'rgb(0, 128, 0)', css);
    }
  });

  it("takes a currentcolor fallback in a shadow as the node's own colour", () => {
    // Tailwind's default ring colour. The colour in scope is the node's own, else inherited.
    const css =
      '.ring { box-shadow: 0 0 0 2px var(--ring-colour, currentcolor) } .green { color: rgb(0, 128, 0) }';
    const own = resolvedStyle(css, ['ring', 'green'])['boxShadow'] as Record<string, unknown>[];
    assert.equal(own[0]!['color'], 'rgb(0, 128, 0)');
    const inherited = resolvedStyle(css, ['ring'], ['green'])['boxShadow'] as Record<
      string,
      unknown
    >[];
    assert.equal(inherited[0]!['color'], 'rgb(0, 128, 0)');
    const none = resolvedStyle(css, ['ring'])['boxShadow'] as Record<string, unknown>[];
    assert.equal(none[0]!['color'], 'black', 'the initial colour');
  });

  it('takes an hsla() of tokens as the colour, as Bulma writes its shadows', () => {
    const [shadow] = shadowsOf(
      '0px 0.0625em 0.125em hsla(var(--h), var(--s), var(--l), 0.1)',
      '--h: 221; --s: 14%; --l: 4%',
    )!;
    assert.ok(shadow, 'a shadow, not a dropped declaration');
    const [, , , alpha] = channels(shadow!['color']);
    assert.equal(alpha, 0.1);
  });
});
