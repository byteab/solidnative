/**
 * Tailwind's CSS, made into CSS this engine can compile.
 *
 * Tailwind emits for a browser: cascade layers, `@property`, feature detection, pseudo-element
 * resets, `oklch()` colours, and a spacing scale built out of `calc(var(--spacing) * n)`. None of
 * that survives contact with a renderer that has no CSS parser on device, so a build step flattens
 * it first. What it must *not* do is change what the declarations mean.
 *
 * The last test is the one that matters: real output from the Tailwind CLI, through the flattener,
 * through the engine's own compiler, asserting the styles a phone would actually get.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { StyleSheet } from '../fabric/src/css.ts';

const require = createRequire(import.meta.url);
const { flattenTailwind } = require('@solid-native/tailwind') as {
  flattenTailwind(css: string): string;
};
const { compileCss } = require('@solid-native/metro/css/compile.cjs') as {
  compileCss(
    source: string,
    context?: string,
    options?: { onUnsupported?: (message: string) => void },
  ): StyleSheet;
};

/** The declarations a class ends up with, as the engine would apply them. */
function stylesFor(css: string, className: string): Record<string, unknown> {
  const sheet = compileCss(flattenTailwind(css), 'tailwind', { onUnsupported: () => {} });
  const rule = sheet.rules.find((r) =>
    r.compounds.some((compound) => compound.classes.includes(className)),
  );
  return (rule?.declarations ?? {}) as Record<string, unknown>;
}

describe('flattening Tailwind for the engine', () => {
  it('does not fold a calc() of two kinds of value, even when one is zero', () => {
    // Chrome drops `calc(0deg + 4px)` and `calc(0 + 4px)`: an angle, or a number, beside a length.
    for (const value of ['calc(0deg + 4px)', 'calc(0 + 4px)', 'calc(4px - 0ms)']) {
      assert.doesNotMatch(flattenTailwind(`.a { margin-top: ${value} }`), /margin-top: 4px/, value);
    }
    // A zero length beside a percentage is still the percentage.
    assert.match(flattenTailwind('.a { width: calc(0px + 50%) }'), /width: 50%/);
  });

  it('keeps a comma inside an attribute value when it splits a selector list', () => {
    // An arbitrary variant can match an attribute holding a comma: `[&[data-x="1,2"]]:p-4`.
    const out = flattenTailwind(
      `.a[data-x="1,2"], .b[data-y='3,4'], .c::placeholder { color: red }`,
    );
    assert.match(out, /\.a\[data-x="1,2"\]/);
    assert.match(out, /\.b\[data-y=["']3,4["']\]/);
  });

  it('unwraps cascade layers and drops the statement that orders them', () => {
    const out = flattenTailwind('@layer theme, utilities;\n@layer utilities { .a { flex: 1 } }');
    assert.doesNotMatch(out, /@layer/);
    assert.match(out, /\.a/);
  });

  it('unwraps feature detection, which is asking about a browser', () => {
    const out = flattenTailwind('@supports (color: red) { .a { flex: 1 } }');
    assert.doesNotMatch(out, /@supports/);
    assert.match(out, /\.a/);
  });

  it("keeps a @property's initial value, which is where a default comes from", () => {
    const css = `
      @property --tw-offset { syntax: "*"; initial-value: 12px }
      .a { margin-top: var(--tw-offset) }
    `;
    const out = flattenTailwind(css);
    assert.doesNotMatch(out, /@property/);
    assert.match(out, /margin-top:\s*12px/, 'the default was substituted, not dropped');
  });

  it('drops a per-side border style of solid, which native has no word for', () => {
    // React Native has one `borderStyle` for the whole box, and solid is already its default, so
    // Tailwind's `border-t` means its width and nothing else. Anything but solid is left for the
    // compiler to refuse out loud, because the app asked for something that cannot happen.
    const css = `
      @property --tw-border-style { syntax: "*"; initial-value: solid }
      .border-t { border-top-style: var(--tw-border-style); border-top-width: 1px }
    `;
    assert.deepEqual(stylesFor(css, 'border-t'), { borderTopWidth: 1 });
  });

  it('draws the logical border utilities, border-y and border-x among them', () => {
    // Tailwind writes these with the logical properties, `border-block-width` for `border-y`. The
    // width was not mapped, so `border-y` drew nothing, and the style warned on every one of them.
    const css = `
      @property --tw-border-style { syntax: "*"; initial-value: solid }
      .border-y { border-block-style: var(--tw-border-style); border-block-width: 1px }
      .border-bs { border-block-start-style: var(--tw-border-style); border-block-start-width: 1px }
      .border-be { border-block-end-style: var(--tw-border-style); border-block-end-width: 1px }
      .border-x { border-inline-style: var(--tw-border-style); border-inline-width: 1px }
      .border-s { border-inline-start-style: var(--tw-border-style); border-inline-start-width: 1px }
    `;
    const refused: string[] = [];
    compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.deepEqual(refused, []);
    assert.deepEqual(stylesFor(css, 'border-y'), { borderTopWidth: 1, borderBottomWidth: 1 });
    assert.deepEqual(stylesFor(css, 'border-bs'), { borderTopWidth: 1 });
    assert.deepEqual(stylesFor(css, 'border-be'), { borderBottomWidth: 1 });
    assert.deepEqual(stylesFor(css, 'border-x'), { borderLeftWidth: 1, borderRightWidth: 1 });
    assert.deepEqual(stylesFor(css, 'border-s'), { borderStartWidth: 1 });
  });

  it('drops an important per-side border style of solid too', () => {
    // `border-t-2!` and the important divide utilities mark the side style important. It is still
    // only solid, so the flattener drops the declaration, importance and all; kept, the compiler
    // would refuse it with a warning on every important border.
    const refused: string[] = [];
    compileCss(
      flattenTailwind(
        '@property --tw-border-style { syntax: "*"; initial-value: solid }\n' +
          '.border-t-2\\! { border-top-style: var(--tw-border-style) !important; ' +
          'border-top-width: 2px !important }',
      ),
      'tailwind',
      { onUnsupported: (message) => refused.push(message) },
    );
    assert.deepEqual(refused, []);
  });

  it('folds the arithmetic Tailwind writes for a negative integer', () => {
    // `-z-10` is `z-index: calc(10 * -1)` and `-order-1` is `order: calc(1 * -1)`. lightningcss
    // folds a calc() of lengths but leaves one of plain numbers, which the compiler refuses.
    const css = '.-z-10 { z-index: calc(10 * -1) }\n.-order-1 { order: calc(1 * -1) }';
    assert.equal(stylesFor(css, '-z-10')['zIndex'], -10);
    assert.doesNotMatch(flattenTailwind(css), /calc/);
  });

  it('drops pseudo-element selectors and keeps the rest of the list', () => {
    const out = flattenTailwind('.a, ::before, .b { flex: 1 }');
    assert.doesNotMatch(out, /::before/);
    assert.match(out, /\.a/);
    assert.match(out, /\.b/);
  });

  it('reads an escaped comma in a class name as part of it, not as a list', () => {
    // `placeholder-[rgb(10,20,30)]` is `.placeholder-\\[rgb\\(10\\,20\\,30\\)\\]::placeholder`.
    // Split at every comma, its halves were invalid selectors, and the whole build threw.
    const refused: string[] = [];
    const css = '.a-\\[rgb\\(1\\,2\\,3\\)\\]::placeholder { color: red }\n.b { flex: 1 }';
    const sheet = compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.equal(sheet.rules.length, 1, '.b');
    assert.equal(refused.length, 1, 'the placeholder rule, refused as one');
  });

  it('leaves a rule that is only pseudo-elements for the compiler to refuse out loud', () => {
    // `placeholder:text-gray-400` and `before:` are classes an app asked for. Dropped here, they
    // did nothing with nothing to say so; the compiler says why pseudo-elements are not supported.
    const refused: string[] = [];
    compileCss(flattenTailwind('.x::placeholder { color: red }\n.a { flex: 1 }'), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.equal(refused.length, 1);
    assert.match(refused[0]!, /pseudo-elements like ::before are never supported/);
  });

  it('resolves the theme variables and folds the arithmetic they were in', () => {
    // The spacing scale is the whole layout surface, and it is `calc(var(--spacing) * n)` for
    // every value of n. A device has no CSS parser, so this has to be a number by build time.
    const css = ':root { --spacing: 0.25rem } .p-4 { padding: calc(var(--spacing) * 4) }';
    assert.deepEqual(stylesFor(css, 'p-4'), {
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
    });
  });

  it('takes a fallback with commas of its own whole, rather than splitting it', () => {
    assert.match(flattenTailwind('.a { color: var(--missing, rgb(1, 2, 3)); }'), /color: #010203/);
  });

  it('lowers oklch, which native cannot parse', () => {
    const css = ':root { --c: oklch(62.3% 0.214 259.815) } .bg { background-color: var(--c) }';
    const { backgroundColor } = stylesFor(css, 'bg');
    assert.match(String(backgroundColor), /^rgb\(/, 'a colour native understands');
  });

  it('gives every palette colour the sRGB the compiler gives the same oklch()', () => {
    // Two converters disagreed. The flattener let lightningcss lower `oklch()`, which gamut-maps
    // by an older draft of CSS Color 4 and in single precision; the compiler converts it by the
    // current one. Most of the palette came out a step or more apart, and red-600 nine, so
    // `bg-red-600` and `color: var(--color-red-600)` in a component were different reds.
    const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
    const palette = [...theme.matchAll(/(--color-[\w-]+):\s*(oklch\([^)]*\))/g)];
    assert.ok(palette.length > 200, 'the whole palette was read');
    const apart: string[] = [];
    for (const [, name, value] of palette) {
      const direct = compileCss(`.a { color: ${value} }`).rules[0]!.declarations['color'];
      const flattened = stylesFor(`.a { color: ${value} }`, 'a')['color'];
      if (direct !== flattened) apart.push(`${name}: ${String(flattened)}, not ${String(direct)}`);
    }
    assert.deepEqual(apart, []);
  });

  it('leaves the media range syntax alone, rather than lowering it into a "not" query', () => {
    // `fold()` targets Chrome 90 so it can fold calc(), and
    // that target used to lower everything else the way an old Chrome would too - including
    // Tailwind's own `(width < 500px)` breakpoint queries, which came out as `not (min-width:
    // 500px)`. The compiler refuses a `not` media query outright (see css-media.test.ts), so every
    // `max-*` breakpoint and container query compiled to nothing. compile.cjs's own `flatten()`
    // hit the same thing for nesting and fixed it by narrowing what gets lowered rather than
    // lowering for a target; this is the same fix for the other function that had it.
    const out = flattenTailwind('@media (width < 500px) { .max-sm\\:flex { display: flex } }');
    assert.doesNotMatch(out, /\bnot\s*\(/, 'the range syntax should reach the compiler as written');
    assert.match(out, /width\s*<\s*500px/);
  });

  it('leaves a themed token for the cascade rather than picking one of its values', () => {
    // A design system defines its palette twice: once under `:root` and once under `.dark`.
    // Substituting either one paints that palette in both themes, and the failure is invisible -
    // the app renders, in the wrong colours, with nothing in the bundle to say why. The engine
    // has a cascade and resolves `var()` per node, so the reference has to survive to it.
    const out = flattenTailwind(
      ':root { --primary: rgb(1, 1, 1) }\n' +
        '.dark { --primary: rgb(9, 9, 9) }\n' +
        '.bg { background-color: var(--primary) }',
    );
    assert.match(out, /background-color: var\(--primary\)/);
  });

  it('still substitutes a token that only ever has one value', () => {
    const out = flattenTailwind(
      ':root { --brand: rgb(1, 1, 1) }\n.bg { background-color: var(--brand) }',
    );
    assert.doesNotMatch(out, /var\(--brand\)/);
  });

  it('leaves a value the device supplies for the device to resolve', () => {
    // The safe-area insets are not knowable at build time and the fallback is not the answer:
    // collapsing `var(--safe-area-inset-bottom, 0px)` to `0px` here would be a layout that always
    // sits under the home indicator, with nothing to see in the output that says why.
    const out = flattenTailwind('.pb { padding-bottom: var(--safe-area-inset-bottom, 0px) }');
    assert.match(out, /var\(--safe-area-inset-bottom, 0px\)/);
  });

  it('keeps the arithmetic around one, folding everything but the unknown', () => {
    // `pb-safe-4` is `the inset, plus the padding this design wanted`. The spacing half folds at
    // build time; the inset half cannot, and the compiler understands the sum that is left.
    const css =
      ':root { --spacing: 0.25rem }\n' +
      '.pb { padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + calc(var(--spacing) * 4)) }';
    const sheet = compileCss(flattenTailwind(css), 'tailwind', { onUnsupported: () => {} });
    const rule = sheet.rules.find((r) => r.compounds.some((c) => c.classes.includes('pb')));
    assert.deepEqual(rule?.deferred, [
      {
        props: ['paddingBottom'],
        kind: 'length',
        reference: '--safe-area-inset-bottom',
        adjust: { offset: 16 },
        fallback: 0,
      },
    ]);
  });

  it('reads an important gradient direction without its importance', () => {
    // `bg-linear-to-r!` marks its `--tw-gradient-position` important too. Read into the gradient
    // with it, the direction becomes `to right !important,` and lightningcss refuses the sheet.
    const out = flattenTailwind(
      '.bg-linear-to-r\\! { --tw-gradient-position: to right in oklab !important; ' +
        'background-image: linear-gradient(var(--tw-gradient-stops)) !important }',
    );
    assert.match(out, /linear-gradient\(\s*to right,/);
  });

  it('rewrites a gradient composed out of custom properties into one with holes in it', () => {
    // Tailwind builds a gradient across three classes: one says which way it runs, one gives the
    // first colour, one gives the last. It joins them with `--tw-gradient-stops`, a *string* the
    // browser assembles at paint time - which needs a CSS parser exactly where there is none.
    // The stops go back where they came from, as references the cascade fills in per node.
    const out = flattenTailwind(
      '.bg-linear-to-r { --tw-gradient-position: to right in oklab; ' +
        'background-image: linear-gradient(var(--tw-gradient-stops)) }',
    );
    assert.match(out, /linear-gradient\(\s*to right,/, 'the direction, read off its own rule');
    assert.doesNotMatch(out, /--tw-gradient-stops/, 'the indirection is gone');
    assert.doesNotMatch(out, /oklab/, 'an interpolation space native has no say in');
    assert.match(out, /var\(--tw-gradient-from\)/);
    assert.match(out, /var\(--tw-gradient-via\)/, 'the optional middle, dropped if unset');
    assert.match(out, /var\(--tw-gradient-to\)/);
  });

  it('keeps a stop position as a reference, with its declared default as the fallback', () => {
    const out = flattenTailwind(
      '@property --tw-gradient-from-position { syntax: "*"; initial-value: 0% }\n' +
        '.bg-linear-to-r { --tw-gradient-position: to right; ' +
        'background-image: linear-gradient(var(--tw-gradient-stops)) }',
    );
    // `from-20%` sets this from a different rule, so it cannot be substituted here - but the
    // @property default is what a sheet that never sets it should paint.
    assert.match(out, /var\(--tw-gradient-from-position,\s*0%\)/);
  });

  it('reads a custom property from the rule that declared it, not from the reset', () => {
    // Tailwind's shadows, rings and filters all work this way: a `*` reset gives every property a
    // no-op default, and the utility that needs one sets it in the same rule that reads it. Taking
    // the last value written in the file means taking the reset every time, and the utility does
    // nothing at all - which is what shadows did until this.
    const out = flattenTailwind(
      '.shadow-lg { --tw-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); box-shadow: var(--tw-shadow) }\n' +
        '* { --tw-shadow: 0 0 #0000 }',
    );
    assert.match(out, /box-shadow:\s*0 10px 15px -3px/, 'the rule that reads it declared it');
  });

  it('falls back when a custom property was reset to `initial`', () => {
    // `--tw-shadow-color: initial` is how Tailwind says "nobody has set a shadow colour". A
    // custom property holding `initial` is guaranteed-invalid, so `var()` takes its fallback -
    // and substituting the word itself is how a shadow ended up coloured `initial`.
    const out = flattenTailwind(
      '* { --tw-shadow-color: initial }\n' +
        '.shadow { box-shadow: 0 1px 2px var(--tw-shadow-color, rgb(0 0 0 / 0.1)) }',
    );
    assert.match(out, /box-shadow:\s*0 1px 2px #0000001a/, 'the fallback colour, not the word');
  });

  it('drops a slot nothing reads once the build has filled it in, rather than warning about it', () => {
    // `ease-in` sets `--tw-ease` for `.transition` to read, and the build fills that in. The token
    // itself, a cubic-bezier() no token form holds, warned on every ease-* class in every app.
    const refused: string[] = [];
    const css =
      '.transition { transition-property: opacity; ' +
      'transition-timing-function: var(--tw-ease, ease); transition-duration: 150ms }\n' +
      '.ease-in { --tw-ease: cubic-bezier(0.4, 0, 1, 1); ' +
      'transition-timing-function: cubic-bezier(0.4, 0, 1, 1) }\n' +
      '* { --tw-ease: initial }';
    const out = flattenTailwind(css);
    compileCss(out, 'tailwind', { onUnsupported: (message: string) => refused.push(message) });
    assert.deepEqual(refused, []);
    assert.doesNotMatch(out, /--tw-ease/);
    // A slot left for the device is still read there, and stays.
    assert.match(
      flattenTailwind('.a { --tw-x: 1px; translate: var(--tw-x) }\n.b { translate: var(--tw-x) }'),
      /--tw-x: 1px/,
    );
  });

  it('folds rem and px together, since a rem is a fixed 16 points here', () => {
    // `translate-x-[calc(1rem+2px)]` beside another translate class leaves its slot for the
    // device, and a calc() in a slot is only read once it is one length.
    const out = flattenTailwind(
      '.a { --tw-translate-x: calc(1rem + 2px); --b: calc(2rem - 4px) }\n' +
        '.b { translate: var(--tw-translate-x) }',
    );
    assert.match(out, /--tw-translate-x: 18px/);
    assert.match(out, /--b: 28px/);
  });

  it('leaves a plain rule alone', () => {
    const out = flattenTailwind('.a { flex: 1; background-color: #fff }');
    assert.match(out, /flex:\s*1/);
    assert.match(out, /#fff/i);
  });
});

describe('real Tailwind output, end to end', () => {
  const css = readFileSync(
    fileURLToPath(new URL('./fixtures/tailwind-utilities.css', import.meta.url)),
    'utf8',
  );

  it('compiles the utilities a screen is built from', () => {
    const styles = (className: string) => stylesFor(css, className);

    assert.deepEqual(styles('p-4'), {
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
    });
    assert.deepEqual(styles('gap-2'), { rowGap: 8, columnGap: 8 });
    assert.deepEqual(styles('h-16'), { height: 64 });
    assert.deepEqual(styles('flex-row'), { flexDirection: 'row' });
    assert.deepEqual(styles('items-center'), { alignItems: 'center' });
    assert.deepEqual(styles('justify-between'), { justifyContent: 'space-between' });
    assert.equal(styles('bg-blue-500')['backgroundColor'], 'rgb(43, 127, 255)');
    assert.equal(styles('rounded-lg')['borderTopLeftRadius'], 8);
  });

  it('gets the type scale, which Tailwind hides behind a unitless calc', () => {
    // `--text-lg--line-height: calc(1.75 / 1.125)` - a ratio, in a custom property, referenced
    // from the utility. Nothing about that survives to a device unless it is folded here.
    const lg = stylesFor(css, 'text-lg');
    assert.equal(lg['fontSize'], 18);
    assert.equal(typeof lg['lineHeight'], 'number');
  });

  it('compiles a real shadow utility to a shadow native can paint', () => {
    const shadow = stylesFor(css, 'shadow-lg')['boxShadow'] as
      { color: string; offsetY: number; blurRadius: number }[] | undefined;
    assert.ok(shadow?.length, 'shadow-lg should paint something');
    assert.equal(shadow[0]!.offsetY, 10);
    assert.equal(shadow[0]!.blurRadius, 15);
    assert.match(shadow[0]!.color, /^rgba?\(/, 'a colour, not the word initial');
  });

  it('compiles important utilities, including ones that set a custom property', () => {
    // `shadow!` puts `!important` on its `--tw-shadow` too. The importance belongs to the
    // declaration, not the value: carried into the `var()` it substitutes into, it lands in the
    // middle of `box-shadow` and lightningcss refuses the whole sheet.
    const important =
      css +
      '.shadow\\! { --tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), ' +
      '0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1)) !important; box-shadow: ' +
      'var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), ' +
      'var(--tw-ring-shadow), var(--tw-shadow) !important; }\n' +
      '.leading-6\\! { --tw-leading: 1.5rem !important; line-height: 1.5rem !important; }\n' +
      '.bg-red-500\\! { background-color: rgb(251, 44, 54) !important; }\n';
    const sheet = compileCss(flattenTailwind(important), 'tailwind', { onUnsupported: () => {} });
    const importantFor = (className: string) =>
      sheet.rules.find((r) => r.compounds.some((c) => c.classes.includes(className)))?.important as
        Record<string, unknown> | undefined;
    const shadow = importantFor('shadow!')?.['boxShadow'] as
      { offsetY: number; blurRadius: number }[] | undefined;
    assert.equal(shadow?.length, 2, 'shadow! should paint its two shadows');
    assert.equal(shadow[0]!.offsetY, 1);
    assert.equal(shadow[0]!.blurRadius, 3);
    assert.equal(importantFor('bg-red-500!')?.['backgroundColor'], 'rgb(251, 44, 54)');
    assert.equal(importantFor('leading-6!')?.['lineHeight'], 24);
  });

  it('drops the fully transparent placeholders from a shadow chain', () => {
    // `box-shadow` composes five slots - inset, inset ring, ring offset, ring, shadow - and four
    // of them are `0 0 #0000` on anything that only wanted a drop shadow. They paint nothing, and
    // sending four extra shadow maps per node to paint nothing is worth not doing.
    const shadow = stylesFor(css, 'shadow-lg')['boxShadow'] as unknown[];
    assert.equal(shadow.length, 2, 'the two the utility actually declared');
  });

  it('keeps the timing of duration-, ease- and delay- for the transition beside them', () => {
    // Tailwind 4.3's output for `transition duration-700 ease-linear delay-150`. The three timing
    // utilities write the longhand on its own, with no property list, and were dropped.
    const css =
      ':root { --default-transition-duration: 150ms; ' +
      '--default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }\n' +
      '.transition { transition-property: color, opacity; ' +
      'transition-timing-function: var(--tw-ease, var(--default-transition-timing-function)); ' +
      'transition-duration: var(--tw-duration, var(--default-transition-duration)) }\n' +
      '.delay-150 { transition-delay: 150ms }\n' +
      '.duration-700 { --tw-duration: 700ms; transition-duration: 700ms }\n' +
      '.ease-linear { --tw-ease: linear; transition-timing-function: linear }\n' +
      '@layer properties { *, ::before { --tw-duration: initial; --tw-ease: initial } }';
    assert.equal(stylesFor(css, 'duration-700')['$transitionDuration'], 700);
    assert.deepEqual(stylesFor(css, 'ease-linear')['$transitionEasing'], [0, 0, 1, 1]);
    assert.equal(stylesFor(css, 'delay-150')['$transitionDelay'], 150);
    // Not baked into `.transition` itself, which every other element with it shares.
    const own = stylesFor(css, 'transition')['$transition'] as Record<string, { duration: number }>;
    assert.equal(own['opacity']!.duration, 150);
  });

  it('drops a utility it cannot express instead of failing the build', () => {
    // Tailwind generates from a scan of anything that looks like a class name - comments and
    // string literals included - so a comment listing classes that are not supported generates
    // them. Each one is dropped with a warning, as in a component's own stylesheet.
    const refused: string[] = [];
    const sheet = compileCss(
      '.a { color: red } .b:has(> .c) { color: blue } .d { color: green }',
      'tw',
      {
        onUnsupported: (message: string) => refused.push(message),
      },
    );
    assert.equal(sheet.rules.length, 2, 'the two it could express');
    assert.match(refused.join(''), /:has/);
  });

  it('compiles the whole sheet without the compiler refusing any of it', () => {
    const refused: string[] = [];
    const sheet = compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message) => refused.push(message),
    });
    assert.ok(sheet.rules.length > 20, `expected a sheet, got ${sheet.rules.length} rules`);
    const real = refused.filter((message) => !message.includes("dropped '--"));
    assert.deepEqual(real, [], 'nothing but leftover custom properties should be dropped');
  });
  it('drops a filter utility iOS does not draw, and keeps it behind android:', () => {
    // The shape Tailwind 4.3 writes for grayscale and android:grayscale: every filter utility sets
    // its own slot and reads all nine, and a reset empties the slots nobody set. brightness-50 is
    // drawn on both platforms and stays.
    const slots = ['blur', 'brightness', 'contrast', 'grayscale', 'hue-rotate', 'invert'];
    const reset = `*, ::before { ${slots.map((slot) => `--tw-${slot}: initial;`).join(' ')} }\n`;
    const filters =
      'var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) ' +
      'var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) ' +
      'var(--tw-drop-shadow,)';
    const css =
      `.grayscale { --tw-grayscale: grayscale(100%); filter: ${filters}; }\n` +
      `.platform-android .android\\:grayscale { --tw-grayscale: grayscale(100%); filter: ${filters}; }\n` +
      `.brightness-50 { --tw-brightness: brightness(50%); filter: ${filters}; }\n` +
      reset;
    const refused: string[] = [];
    const sheet = compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    // Each utility's filter is its slot, a token the engine splices into the list on device, so
    // that two filter classes on one node draw both. See tailwind-combining.test.ts.
    const slotOf = (className: string, slot: string) =>
      sheet.rules.find((rule) => rule.compounds.some((c) => c.classes.includes(className)))
        ?.tokens?.[slot]?.filter;

    assert.equal(slotOf('grayscale', '--tw-grayscale'), undefined, 'dropped');
    assert.match(refused.join('\n'), /dropped '--tw-grayscale'.*grayscale\(\) is not drawn on iOS/);
    assert.deepEqual(slotOf('android:grayscale', '--tw-grayscale'), [{ grayscale: 1 }]);
    assert.deepEqual(slotOf('brightness-50', '--tw-brightness'), [{ brightness: 0.5 }]);
  });

  it('keeps a stacked variant, whose root classes may sit on one node', () => {
    // `android:dark:` compiles to `.dark :is(.platform-android .x)`. A combinator inside `:is()`
    // is a build error for the engine, so the rule used to be dropped: every stacked platform and
    // dark variant silently did nothing. It is the same match as either ancestor order, or both
    // classes on one ancestor - which is where \`mount\` and \`watchConditions\` put them.
    const refused: string[] = [];
    const css = '.dark :is(.platform-android .x) { background-color: rgb(1, 2, 3) }';
    const sheet = compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.deepEqual(refused, []);
    const shapes = sheet.rules.map((rule) =>
      rule.compounds.map((c) => c.classes.join('.')).join(' '),
    );
    assert.deepEqual(shapes.sort(), [
      'dark platform-android x',
      'dark.platform-android x',
      'platform-android dark x',
    ]);
  });

  it('keeps a stacked variant whose class has an escaped comma in it', () => {
    // `dark:android:bg-[rgb(1,2,3)]`: split at the escaped commas, the selector no longer looked
    // like a stacked variant, and the compiler refused the combinator inside `:is()`.
    const refused: string[] = [];
    const css = '.dark :is(.platform-android .x-\\[rgb\\(1\\,2\\,3\\)\\]) { color: red }';
    compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.deepEqual(refused, []);
  });

  it('keeps a stacked variant that also carries a same-node pseudo, like ios:dark:press:', () => {
    // `ios:dark:press:bg-red-500` compiles to `.dark :is(.platform-ios .x):active` - the same
    // two-ancestor `:is()` as above, but with `:active` trailing the closing paren rather than
    // nothing. The regex that expands the ancestor form only matched a selector that ended at
    // the paren, so this shape slipped past it unexpanded and the compiler refused the whole
    // rule as a combinator inside `:is()` - every class stacking a platform or dark variant with
    // a pressed, hovered, focused or disabled one compiled to nothing, on both platforms.
    const refused: string[] = [];
    const css = '.dark :is(.platform-ios .x):active { background-color: rgb(1, 2, 3) }';
    const sheet = compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.deepEqual(refused, []);
    const shapes = sheet.rules.map((rule) =>
      rule.compounds.map((c) => c.classes.join('.')).join(' '),
    );
    assert.deepEqual(shapes.sort(), [
      'dark platform-ios x',
      'dark.platform-ios x',
      'platform-ios dark x',
    ]);
    // The pseudo has to survive the expansion, not just the class list.
    for (const rule of sheet.rules) {
      assert.deepEqual(rule.compounds.at(-1)!.pseudo, ['active']);
    }
  });
});
