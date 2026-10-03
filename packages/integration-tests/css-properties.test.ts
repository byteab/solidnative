/**
 * Phase 1 of the CSS route: shorthand coverage and property coverage.
 *
 * The scope rule is that if React Native can express it, CSS gets a spelling for
 * it. These are the cases that rule brings in, and the ones it keeps out.
 *
 * Note the target is what **Fabric's C++** accepts, not what RN's JS style API accepts, because
 * this renderer writes props straight to Fabric and never goes through RN's StyleSheet. The two
 * differ: `boxShadow` takes a CSS string in JS but, with `enableNativeCSSParsing` defaulting to
 * false, only a list of maps with numeric fields in C++.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { StyleResolver, type StyleTarget } from '@solidnative/fabric';
import { mountSolid } from './css-solid-harness.ts';
import { shadowed } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

/** Every side of a border, spelled out: what the `border` shorthand compiles to. */
const everySide = (part: 'Width' | 'Color', value: unknown) =>
  Object.fromEntries(
    ['Top', 'Right', 'Bottom', 'Left'].map((side) => [`border${side}${part}`, value]),
  );

/** The declarations a single-rule stylesheet produces. */
const declarationsOf = (css: string): Record<string, unknown> =>
  compileCss(`view { ${css} }`).rules[0].declarations;

describe('shorthands that every stylesheet uses', () => {
  it('background, taking the colour and ignoring the initial layers', () => {
    assert.deepEqual(declarationsOf('background: red'), { backgroundColor: 'rgb(255, 0, 0)' });
  });

  it('border, which sets width, style and colour on every side at once', () => {
    // Every side spelled out rather than native's unsided props, which lose to a per-side prop
    // from any weaker rule. See 'a shorthand beats a longhand from a weaker rule'.
    assert.deepEqual(declarationsOf('border: 2px solid red'), {
      ...everySide('Width', 2),
      borderStyle: 'solid',
      ...everySide('Color', 'rgb(255, 0, 0)'),
    });
  });

  it('a per-side border longhand still overrides the shorthand', () => {
    assert.deepEqual(declarationsOf('border: 1px solid red; border-left-width: 4px'), {
      ...everySide('Width', 1),
      borderStyle: 'solid',
      ...everySide('Color', 'rgb(255, 0, 0)'),
      borderLeftWidth: 4,
    });
  });

  it('font, including a unitless line-height resolved against the font size', () => {
    assert.deepEqual(declarationsOf('font: bold 12px/1.5 system-ui'), {
      fontWeight: '700',
      fontSize: 12,
      lineHeight: 18,
      fontFamily: 'system-ui',
    });
  });

  it('overflow, which is one axis on native', () => {
    assert.deepEqual(declarationsOf('overflow: hidden'), { overflow: 'hidden' });
  });

  it('refuses an overflow whose axes disagree, because native has only one', () => {
    assert.throws(() => declarationsOf('overflow: hidden visible'), /one overflow/i);
  });

  it('text-decoration, with its line list joined as RN spells it', () => {
    assert.deepEqual(declarationsOf('text-decoration: underline dotted blue'), {
      textDecorationLine: 'underline',
      textDecorationStyle: 'dotted',
      textDecorationColor: 'rgb(0, 0, 255)',
    });
    assert.equal(
      declarationsOf('text-decoration-line: underline line-through')['textDecorationLine'],
      'underline line-through',
    );
  });

  it('flex-flow', () => {
    assert.deepEqual(declarationsOf('flex-flow: row wrap'), {
      flexDirection: 'row',
      flexWrap: 'wrap',
    });
  });
});

describe('the parts of a shorthand the author left out', () => {
  // lightningcss fills every omitted part in with its initial value: `border: none` arrives as a
  // `medium` width, a `none` style and a `currentColor` colour. Each of those used to be refused,
  // so the commonest resets on the web - `border: 0`, `border: none`, `outline: none`,
  // `text-decoration: none` - were all dropped, found by compiling Bootstrap and Bulma.

  it('border: none and border: 0, which paint no border whatever the colour', () => {
    // CSS computes the width of a border whose style is `none` as 0, which is also how native is
    // told there is no border.
    // The none style is kept for the engine, which settles it into widths and sends none of it.
    const none = { ...everySide('Width', 0), borderStyle: 'none' };
    assert.deepEqual(declarationsOf('border: none'), none);
    assert.deepEqual(declarationsOf('border: 0'), none);
    assert.deepEqual(declarationsOf('border: 2px none red'), none);
  });

  it('reads the width keywords as the lengths CSS defines them as', () => {
    assert.deepEqual(declarationsOf('border: thin solid red'), {
      ...everySide('Width', 1),
      borderStyle: 'solid',
      ...everySide('Color', 'rgb(255, 0, 0)'),
    });
    assert.deepEqual(declarationsOf('border-width: medium thick'), {
      borderTopWidth: 3,
      borderRightWidth: 5,
      borderBottomWidth: 3,
      borderLeftWidth: 5,
    });
  });

  it('still refuses a visible border in currentColor, which native has no spelling for', () => {
    assert.throws(() => declarationsOf('border: 1px solid'), /currentColor/);
  });

  it('outline: none and outline: 0', () => {
    assert.deepEqual(declarationsOf('outline: none'), { outlineWidth: 0 });
    assert.deepEqual(declarationsOf('outline: 0'), { outlineWidth: 0 });
  });

  it('text-decoration without a colour, which native already draws in the text colour', () => {
    // currentColor is native's own default for a decoration, so it is cleared to that default
    // rather than refused: clearing it is what makes a later shorthand reset an earlier colour.
    assert.deepEqual(declarationsOf('text-decoration: none'), {
      textDecorationLine: 'none',
      textDecorationStyle: 'solid',
      textDecorationColor: null,
    });
    assert.deepEqual(
      declarationsOf('text-decoration: underline')['textDecorationLine'],
      'underline',
    );
  });
});

describe('a shorthand beats a longhand from a weaker rule', () => {
  // A shorthand sets every longhand it stands for. Compiled to one unsided prop instead -
  // `borderWidth`, `gap` - it lost to any per-side prop a weaker rule had set, because native
  // reads `borderTopWidth` over `borderWidth` whatever order they arrived in. Open Props'
  // normalize is `* { border-width: 0 }`, so no bordered element in it had a border.
  const resolved = (css: string, classes: string[]) => {
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
    const resolver = new StyleResolver(compileCss(css), {
      width: 400,
      height: 800,
      colorScheme: 'light',
    });
    return resolver.resolve(target(target(null, []), classes), 1).style;
  };

  it('border, over a per-side width and colour', () => {
    const style = resolved(
      '* { border-width: 0; border-top-color: blue } .a { border: 2px solid red }',
      ['a'],
    );
    assert.deepEqual(
      [style['borderTopWidth'], style['borderLeftWidth'], style['borderTopColor']],
      [2, 2, 'rgb(255, 0, 0)'],
    );
  });

  it('border from tokens, and border-color from a token', () => {
    const css =
      ':root { --w: 2px; --c: rgb(1, 2, 3) } * { border-width: 0; border-left-color: blue }' +
      '.a { border: var(--w) solid var(--c) } .b { border-color: var(--c) }';
    assert.equal(resolved(css, ['a'])['borderTopWidth'], 2);
    assert.equal(resolved(css, ['b'])['borderLeftColor'], 'rgb(1, 2, 3)');
  });

  it('gap, over a row or column gap', () => {
    const css = ':root { --g: 6px } * { column-gap: 1px } .a { gap: 8px } .b { gap: var(--g) }';
    assert.equal(resolved(css, ['a'])['columnGap'], 8);
    assert.equal(resolved(css, ['b'])['columnGap'], 6);
  });
});

describe('the per-side border shorthands', () => {
  // `border-top: 1px solid #dee2e6` is how every divider on the web is written, and it was not
  // mapped at all. Native has a width and a colour per side, and one style for the whole box.
  it('sets the width and colour of that side alone', () => {
    assert.deepEqual(declarationsOf('border-top: 1px solid red'), {
      borderTopWidth: 1,
      borderTopColor: 'rgb(255, 0, 0)',
    });
    assert.deepEqual(declarationsOf('border-left: 2px solid rgb(1, 2, 3)'), {
      borderLeftWidth: 2,
      borderLeftColor: 'rgb(1, 2, 3)',
    });
  });

  it('takes none as no border on that side', () => {
    assert.deepEqual(declarationsOf('border-bottom: none'), { borderBottomWidth: 0 });
    assert.deepEqual(declarationsOf('border-right: 0'), { borderRightWidth: 0 });
  });

  it('refuses a style other than solid, because native has one style for every side', () => {
    // Solid is native's default, so saying it for one side changes nothing about the others.
    assert.throws(() => declarationsOf('border-top: 1px dashed red'), /one border style/);
  });
});

describe('properties React Native supports that we were rejecting', () => {
  it('transform, as the array of single-key objects Fabric expects', () => {
    assert.deepEqual(declarationsOf('transform: translateX(10px) rotate(45deg) scale(2)'), {
      transform: [{ translateX: 10 }, { rotate: '45deg' }, { scaleX: 2 }, { scaleY: 2 }],
    });
  });

  it('transform-origin', () => {
    // Exactly three: Fabric's parseProcessedTransformOrigin discards anything whose length is
    // not 3, silently, so a two-element origin would simply never apply on device.
    assert.deepEqual(declarationsOf('transform-origin: 10px 20px'), {
      transformOrigin: [10, 20, 0],
    });
  });

  it('box-shadow, as processed maps rather than a CSS string', () => {
    // enableNativeCSSParsing is false by default, so Fabric's parseProcessedBoxShadow runs and it
    // wants numbers, not a string.
    assert.deepEqual(declarationsOf('box-shadow: 1px 2px 4px 1px rgba(0, 0, 0, 0.3)'), {
      boxShadow: [
        {
          offsetX: 1,
          offsetY: 2,
          blurRadius: 4,
          spreadDistance: 1,
          color: 'rgba(0, 0, 0, 0.3)',
          inset: false,
        },
      ],
    });
  });

  it('inset box-shadow, and more than one of them', () => {
    const value = declarationsOf('box-shadow: inset 0 1px 0 red, 0 2px 0 blue')[
      'boxShadow'
    ] as Array<Record<string, unknown>>;
    assert.equal(value.length, 2);
    assert.equal(value[0]!['inset'], true);
    assert.equal(value[1]!['inset'], false);
  });

  it('text-shadow, which native models as one offset rather than a list', () => {
    assert.deepEqual(declarationsOf('text-shadow: 1px 2px 3px red'), {
      textShadowOffset: { width: 1, height: 2 },
      textShadowRadius: 3,
      textShadowColor: 'rgb(255, 0, 0)',
    });
  });

  it('refuses a text-shadow list, because native has room for exactly one', () => {
    assert.throws(() => declarationsOf('text-shadow: 1px 1px red, 2px 2px blue'), /only one/i);
  });

  it('outline', () => {
    assert.deepEqual(declarationsOf('outline: 2px solid red'), {
      outlineWidth: 2,
      outlineStyle: 'solid',
      outlineColor: 'rgb(255, 0, 0)',
    });
  });

  it('the odds and ends: mix-blend-mode, isolation, box-sizing, cursor', () => {
    assert.deepEqual(declarationsOf('mix-blend-mode: multiply'), { mixBlendMode: 'multiply' });
    assert.deepEqual(declarationsOf('isolation: isolate'), { isolation: 'isolate' });
    assert.deepEqual(declarationsOf('box-sizing: border-box'), { boxSizing: 'border-box' });
    assert.deepEqual(declarationsOf('cursor: auto'), { cursor: 'auto' });
    assert.deepEqual(declarationsOf('cursor: pointer'), { cursor: 'pointer' });
  });

  it('logical properties, as the Yoga style every native view reads', () => {
    assert.deepEqual(declarationsOf('margin-inline: 4px'), { marginLeft: 4, marginRight: 4 });
    assert.deepEqual(declarationsOf('padding-block: 6px'), { paddingTop: 6, paddingBottom: 6 });
  });
});

describe('keywords React Native does not take', () => {
  // Fabric drops a keyword it has no reading for without a word, so each of these compiled
  // cleanly and did nothing on device.
  it('takes auto and pointer as a cursor, reads default as auto, and refuses the rest', () => {
    assert.deepEqual(declarationsOf('cursor: pointer'), { cursor: 'pointer' });
    assert.deepEqual(declarationsOf('cursor: default'), { cursor: 'auto' });
    assert.throws(() => declarationsOf('cursor: alias'), /cursor: alias is not supported/);
  });

  it('reads overflow auto as scroll, and clip as hidden, the nearest Yoga has', () => {
    assert.deepEqual(declarationsOf('overflow: auto'), { overflow: 'scroll' });
    assert.deepEqual(declarationsOf('overflow: clip'), { overflow: 'hidden' });
    assert.deepEqual(declarationsOf('overflow: scroll'), { overflow: 'scroll' });
  });

  it('refuses the plus-darker blend mode, which native does not draw', () => {
    assert.deepEqual(declarationsOf('mix-blend-mode: plus-lighter'), {
      mixBlendMode: 'plus-lighter',
    });
    assert.throws(() => declarationsOf('mix-blend-mode: plus-darker'), /plus-darker/);
  });

  it('refuses an overline, which native text does not draw', () => {
    assert.throws(() => declarationsOf('text-decoration-line: overline'), /overline/);
  });
});

describe('lengths in units native has no word for', () => {
  it('reads an outline offset in rem, which lightningcss hands over unparsed', () => {
    // `outline-offset` is a property lightningcss does not know, and its value arrived as the bare
    // number in it: 1.25rem was an offset of 1.25 points, not 20.
    assert.deepEqual(declarationsOf('outline-offset: 1.25rem'), { outlineOffset: 20 });
  });

  it('refuses an outline offset in percent, which CSS does not take', () => {
    assert.throws(() => declarationsOf('outline-offset: 37%'), /outline-offset/);
  });

  it('reads a font size in percent as a share of the inherited one, as an em is', () => {
    // `fontSize: '37%'` is not a value native takes; the size it means is known on device.
    const [rule] = compileCss('view { font-size: 37% }').rules;
    assert.deepEqual(rule.deferred, [
      { props: ['fontSize'], compute: { unit: 'em', factor: 0.37 } },
    ]);
  });
});

describe('logical properties', () => {
  // React Native spells these the way CSS does - `insetInlineStart`, `marginBlock` - but those
  // names are aliases. Yoga has no slot for them: `YogaLayoutableShadowNode::updateYogaProps`
  // copies them onto the style on its way to layout, and any view whose shadow node sets its own
  // style from the props' Yoga style skips that step and loses them. react-native-safe-area-
  // context's is one, so Tailwind's `inset-x-0` (`inset-inline: 0`) on a `<safe-area-view>` did
  // nothing, and said nothing. The names every view reads are the physical edges and Yoga's own
  // Start and End.

  /** RN's aliases, which only some views apply. None of them should ever be written. */
  const ALIASES = [
    'insetInline',
    'insetBlock',
    'insetInlineStart',
    'insetInlineEnd',
    'insetBlockStart',
    'insetBlockEnd',
    'marginInline',
    'marginInlineStart',
    'marginInlineEnd',
    'marginBlock',
    'marginBlockStart',
    'marginBlockEnd',
    'paddingInline',
    'paddingInlineStart',
    'paddingInlineEnd',
    'paddingBlock',
    'paddingBlockStart',
    'paddingBlockEnd',
  ];

  /** Every prop a rule would write, settled now or on device. */
  const writes = (css: string): string[] => {
    const rule = compileCss(`view { ${css} }`).rules[0];
    const deferred = (rule.deferred ?? []) as { props: string[] }[];
    return [...Object.keys(rule.declarations), ...deferred.flatMap((d) => d.props)];
  };

  it('places inset-inline on both sides, which is the same both ways round', () => {
    assert.deepEqual(declarationsOf('inset-inline: 0'), { left: 0, right: 0 });
    assert.deepEqual(declarationsOf('inset-inline: 25%'), { left: '25%', right: '25%' });
    assert.deepEqual(declarationsOf('inset-inline: auto'), { left: 'auto', right: 'auto' });
  });

  it('follows the layout direction when the two sides differ', () => {
    assert.deepEqual(declarationsOf('inset-inline: 4px 8px'), { start: 4, end: 8 });
    assert.deepEqual(declarationsOf('margin-inline: 1px 2px'), { marginStart: 1, marginEnd: 2 });
    assert.deepEqual(declarationsOf('padding-inline: 1px 2px'), {
      paddingStart: 1,
      paddingEnd: 2,
    });
  });

  it('places the block axis on top and bottom', () => {
    assert.deepEqual(declarationsOf('inset-block: 2px'), { top: 2, bottom: 2 });
    assert.deepEqual(declarationsOf('inset-block: 2px 3px'), { top: 2, bottom: 3 });
    assert.deepEqual(declarationsOf('margin-block: 2px 3px'), { marginTop: 2, marginBottom: 3 });
  });

  it('places a var() the same way', () => {
    assert.deepEqual(writes('inset-inline: var(--x)'), ['left', 'right']);
    assert.deepEqual(writes('inset-inline: var(--x) var(--y)'), ['start', 'end']);
    assert.deepEqual(writes('margin-inline-start: var(--x)'), ['marginStart']);
    assert.deepEqual(writes('padding-block: var(--x) 2px'), ['paddingBottom', 'paddingTop']);
  });

  it('never writes one of the names only some views read', () => {
    const properties = ['inset', 'margin', 'padding'].flatMap((box) =>
      ['inline', 'block'].flatMap((axis) => [
        `${box}-${axis}`,
        `${box}-${axis}-start`,
        `${box}-${axis}-end`,
      ]),
    );
    const values = ['4px', '4px 8px', 'var(--x)', 'var(--x) var(--y)', 'calc(var(--x) * 2)'];
    for (const property of properties) {
      for (const value of values) {
        if (property.endsWith('-start') || property.endsWith('-end')) {
          if (value.includes(' ') && !value.startsWith('calc')) continue;
        }
        const written = writes(`${property}: ${value}`);
        assert.ok(written.length > 0, `${property}: ${value} wrote something`);
        for (const prop of written) {
          assert.ok(!ALIASES.includes(prop), `${property}: ${value} wrote ${prop}`);
        }
      }
    }
  });
});

describe('the keywords that mean the property is off', () => {
  // `max-width: none`, `z-index: auto` and the rest are how a later rule undoes an earlier one -
  // Bootstrap's `.modal-fullscreen` and every responsive `mw-*` reset - and each was refused, so
  // the earlier value stood. Native spells "the default" as the absence of the prop, which a
  // declaration says with `null`, or with an empty list for a prop that is a list.
  it('clears a scalar back to the native default', () => {
    assert.deepEqual(declarationsOf('max-width: none'), { maxWidth: null });
    assert.deepEqual(declarationsOf('max-height: none'), { maxHeight: null });
    assert.deepEqual(declarationsOf('z-index: auto'), { zIndex: null });
    assert.deepEqual(declarationsOf('letter-spacing: normal'), { letterSpacing: null });
  });

  it('empties a list', () => {
    assert.deepEqual(declarationsOf('filter: none'), { filter: [] });
    assert.deepEqual(declarationsOf('background-image: none'), {
      experimental_backgroundImage: [],
    });
    // lightningcss leaves this one unparsed, and it was reported as mixing var() with values.
    assert.deepEqual(declarationsOf('box-shadow: none'), { boxShadow: [] });
  });
});

describe('what it refuses, and how it says so', () => {
  it('does not blame var() for a value that has none', () => {
    // A value lightningcss could not parse arrives the way a var() does, and every one of them was
    // reported as "mixes var() with other values": `color: inherit` included.
    assert.throws(
      () => declarationsOf('color: inherit'),
      (error: Error) => {
        assert.match(error.message, /CSS-wide keyword/);
        assert.doesNotMatch(error.message, /var\(\)/);
        return true;
      },
    );
    assert.throws(
      () => declarationsOf('flex-basis: content'),
      (error: Error) => {
        assert.match(error.message, /flex-basis: content/);
        assert.doesNotMatch(error.message, /var\(\)/);
        return true;
      },
    );
  });

  it('names the display value that was written, not the one lightningcss reads it as', () => {
    // `display: inline-block` is `inline flow-root` to the parser, and the message named that.
    assert.throws(() => declarationsOf('display: inline-block'), /display: inline-block\b/);
    assert.throws(() => declarationsOf('display: grid'), /display: grid\b/);
  });

  it('reads display: block as flex, which is what every native view already is', () => {
    // A native view stacks its children in a column, as a block does. Refusing it broke every
    // stylesheet that shows a hidden element again with block.
    assert.deepEqual(declarationsOf('display: block'), { display: 'flex' });
  });

  it('passes display: contents through, which Yoga lays out as no box at all', () => {
    // It used to compile to flex, so the wrapper kept its background and stacked its children in
    // a column of its own instead of handing them to its parent's row.
    assert.deepEqual(declarationsOf('display: contents'), { display: 'contents' });
  });

  it('gives a prefixed sticky the same explanation as sticky', () => {
    // `position: -webkit-sticky` reported "expected a keyword, got {...}".
    assert.throws(() => declarationsOf('position: -webkit-sticky'), /sticky is not supported/);
  });

  it('refuses a relative font weight, which native would ignore without a word', () => {
    // `bolder` compiled straight through, and native has no such weight: it drew the text at the
    // weight it already had. Bootstrap writes it for every `<b>` and `<strong>`.
    assert.throws(() => declarationsOf('font-weight: bolder'), /bolder/);
    assert.throws(() => declarationsOf('font-weight: lighter'), /lighter/);
  });

  it('only claims there is no native equivalent when that is true', () => {
    // The old message said this of transform and box-shadow, which RN supports perfectly well.
    assert.throws(() => declarationsOf('float: left'), /no React Native equivalent/);
    assert.doesNotThrow(() => declarationsOf('transform: scale(2)'));
    assert.doesNotThrow(() => declarationsOf('box-shadow: 0 1px 2px red'));
  });

  it('does not claim there is no cascade, which there is', () => {
    // Every "no React Native equivalent" message ended "Native styling is a subset of CSS: there
    // is no cascade, no floats and no grid", which contradicts the engine this compiler feeds.
    for (const css of ['visibility: hidden', 'order: 1', 'float: left']) {
      assert.throws(
        () => declarationsOf(css),
        (error: Error) => {
          assert.match(error.message, /no React Native equivalent/);
          assert.doesNotMatch(error.message, /cascade/);
          return true;
        },
        css,
      );
    }
  });

  it('says what to write instead, where there is something', () => {
    assert.throws(() => declarationsOf('visibility: hidden'), /opacity: 0.*display: none/);
    assert.throws(() => declarationsOf('order: 1'), /order in the template/);
  });

  it('names the place a dropped declaration was once, not twice', () => {
    // `app.tailwind.css:8: dropped 'visibility': app.tailwind.css:8: 'visibility' has no ...`
    const dropped: string[] = [];
    compileCss('.a { color: red }\n.b { visibility: hidden }', 'app.tailwind.css', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /^app\.tailwind\.css:2: dropped 'visibility': 'visibility' has/);
    assert.equal(dropped[0]!.split('app.tailwind.css').length, 2, 'named once');
  });

  it('names the line a nested rule was written on, though nesting is printed afresh', () => {
    const css = '.a {\n  color: red;\n\n  & .b {\n    float: left;\n  }\n}\n';
    assert.throws(() => compileCss(css, 'nested.css'), /\bnested\.css:4: 'float'/);
  });

  it('names the line of a syntax error', () => {
    assert.throws(
      () => compileCss('.a { color: red }\n\n.b { color }', 'broken.css'),
      /\bbroken\.css:3: /,
    );
  });

  it('drops only the selector it cannot match from a list, and keeps the rest', () => {
    // lightningcss merges neighbouring rules with the same declarations into one list, so a
    // `group-hover:` beside `data-[state=on]:` of the same colour arrives as one rule, and
    // refusing the whole list silently took the variant that was fine with it.
    const dropped: string[] = [];
    const sheet = compileCss('.a:hover, .b, .c:has(.d) { color: red }', 'list.css', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.deepEqual(
      sheet.rules.map(
        (rule: { compounds: { classes: string[] }[] }) => rule.compounds.at(-1)!.classes,
      ),
      [['b']],
    );
    assert.equal((sheet.rules[0] as { order: number }).order, 1, 'ordered as it was in the list');
    assert.equal(dropped.length, 2);
    assert.match(dropped[0]!, /^list\.css:1: dropped a selector: ':hover'/);
    assert.match(dropped[1]!, /^list\.css:1: dropped a selector: ':has\(\)'/);
  });

  it('names the line of a dropped rule before saying it was dropped', () => {
    // `app.tailwind.css: dropped a rule: app.tailwind.css:430: ...`, the line in the middle.
    const dropped: string[] = [];
    compileCss('.a { color: red }\n.b:has(.c) { color: blue }', 'app.tailwind.css', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /^app\.tailwind\.css:2: dropped a rule: ':has\(\)'/);
    assert.equal(dropped[0]!.split('app.tailwind.css').length, 2, 'named once');
  });

  it('names a property it simply has not mapped yet, rather than blaming native', () => {
    // `caret-color` is a real RN prop on a text input, reached through a prop rather than a style;
    // nothing here translates it, and saying so is not the same as saying native cannot do it.
    assert.throws(() => declarationsOf('caret-color: red'), /not mapped yet/);
  });

  it('names the property of a dropped var() declaration, not the parser shape it arrived in', () => {
    // A value with var() in it reaches the compiler as an `unparsed` declaration, and the drop was
    // reported as "dropped 'unparsed'", naming no property at all.
    const warnings: string[] = [];
    compileCss('view { transition: var(--t) }', 'styles', {
      onUnsupported: (message: string) => warnings.push(message),
    });
    assert.match(warnings[0]!, /dropped 'transition'/);
  });

  it('lets an author opt out of a declaration it cannot map, saying what was dropped', () => {
    const warnings: string[] = [];
    const { rules } = compileCss('view { color: red; float: left }', 'styles', {
      onUnsupported: (message: string) => warnings.push(message),
    });
    assert.deepEqual(rules[0].declarations, { color: 'rgb(255, 0, 0)' });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /float/);
  });
});

describe('colours nested inside a style value', () => {
  it('processes a box-shadow colour, which a key-based rule never reaches', () => {
    // Colours reach Fabric as processed numbers, converted at commit time because only the device
    // knows what a colour is. That conversion keys off a `*color` property name, so a colour
    // living inside a `boxShadow` array is invisible to it. With `enableNativeCSSParsing` off,
    // Fabric will not parse a colour string either, so an unprocessed one is simply lost.
    const mounted = mountSolid(shadowed(), {
      processColor: (value) => `processed(${String(value)})`,
    });

    const card = mounted.nodes().find((n) => n.props['boxShadow'] !== undefined)!;
    assert.equal(card.props['backgroundColor'], 'processed(rgb(4, 5, 6))');
    assert.deepEqual(card.props['boxShadow'], [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 2,
        spreadDistance: 0,
        color: 'processed(rgb(1, 2, 3))',
        inset: false,
      },
    ]);
    mounted.root.dispose();
  });
});

describe('a colour token made of channel tokens', () => {
  // `--ring: rgba(var(--ring-rgb), var(--ring-alpha))`: Bootstrap writes its colours this way, and
  // Tailwind 3's `ring-opacity-50` needs it, since a ring's colour is a token the ring reads. The
  // colour is settled where the token is defined, from the tokens in scope there.
  const resolve = (css: string, parentClasses: string[], classes: string[]) => {
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
    const resolver = new StyleResolver(compileCss(css), {
      width: 400,
      height: 800,
      colorScheme: 'light',
    });
    const parent = target(null, parentClasses);
    resolver.resolve(parent, 1);
    return resolver.resolve(target(parent, classes), 1).style;
  };
  const css = `
    .blue { --ring-rgb: 59, 130, 246; --ring-alpha: 1; --ring: rgba(var(--ring-rgb), var(--ring-alpha, 1)) }
    .faded { --ring-alpha: 0.5 }
    .fixed { --ring-rgb: 1, 2, 3; --ring: rgba(var(--ring-rgb), 0.25) }
    .paint { background-color: var(--ring) }
  `;

  it('takes its alpha from a token', () => {
    assert.equal(resolve(css, [], ['blue', 'paint'])['backgroundColor'], 'rgb(59, 130, 246)');
    assert.equal(
      resolve(css, [], ['blue', 'faded', 'paint'])['backgroundColor'],
      'rgba(59, 130, 246, 0.5)',
    );
  });

  it('takes an alpha written beside the channels', () => {
    assert.equal(resolve(css, [], ['fixed', 'paint'])['backgroundColor'], 'rgba(1, 2, 3, 0.25)');
  });

  it('is what an alias to it resolves to, as an hsl() token is', () => {
    const aliased = `
      .a { --rgb: 1, 2, 3; --base: rgba(var(--rgb), 0.5); --semantic: var(--base) }
      .h { --hue: 0; --base: hsl(var(--hue), 100%, 50%); --semantic: var(--base) }
      .paint { background-color: var(--semantic) }
    `;
    assert.equal(resolve(aliased, [], ['a', 'paint'])['backgroundColor'], 'rgba(1, 2, 3, 0.5)');
    assert.equal(resolve(aliased, [], ['h', 'paint'])['backgroundColor'], 'rgb(255, 0, 0)');
  });

  it("takes its channels' fallback when the channels token is unset", () => {
    const fallback = `
      .t { --c: rgba(var(--rgb, 1, 2, 3), 0.5) }
      .paint { background-color: var(--c) }
      .direct { background-color: rgba(var(--rgb, 4, 5, 6), 0.25) }
    `;
    assert.equal(resolve(fallback, [], ['t', 'paint'])['backgroundColor'], 'rgba(1, 2, 3, 0.5)');
    assert.equal(resolve(fallback, [], ['direct'])['backgroundColor'], 'rgba(4, 5, 6, 0.25)');
  });

  it('leaves the colour unset when its alpha names a token nothing set, as CSS does', () => {
    const missing = `
      .t { --rgb: 1, 2, 3; --c: rgba(var(--rgb), var(--missing)) }
      .paint { background-color: var(--c) }
      .direct { --rgb: 1, 2, 3; background-color: rgba(var(--rgb), var(--missing)) }
    `;
    assert.equal(resolve(missing, [], ['t', 'paint'])['backgroundColor'], undefined);
    assert.equal(resolve(missing, [], ['direct'])['backgroundColor'], undefined);
  });

  it('is inherited as the colour it was settled to', () => {
    assert.equal(
      resolve(css, ['blue', 'faded'], ['paint'])['backgroundColor'],
      'rgba(59, 130, 246, 0.5)',
    );
  });
});

describe('unsupported CSS, through the build', () => {
  /** What the build prints while `run` transforms, and what it returns. */
  function warned<T>(run: () => T): { result: T; warnings: string[] } {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => void warnings.push(message);
    try {
      return { result: run(), warnings };
    } finally {
      console.warn = original;
    }
  }
  // A `.native.css` import, as Metro's Solid transformer compiles it. The rule sits on line 3.
  const { transformNativeCss } = require('@solidnative/metro/solid-css.cjs') as {
    transformNativeCss(css: string, file: string, options: object): { code: string };
  };
  const build = (css: string, file: string) =>
    transformNativeCss(`/* a */\n/* b */\n${css}`, file, { platform: 'ios' });

  it('drops an unsupported declaration with a warning, and keeps the rest of the rule', () => {
    const { result, warnings } = warned(() =>
      build('  .a { color: red; float: left }', '/tmp/drop.native.css'),
    );
    assert.match(result.code, /rgb\(255, 0, 0\)/, 'the rest of the rule still applies');
    assert.doesNotMatch(result.code, /float/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /^\[[a-z-]+\] \/tmp\/drop\.native\.css:3: dropped 'float'/);
  });

  it('drops a rule it cannot select with a warning, and keeps the others', () => {
    const { result, warnings } = warned(() =>
      build('  .a:has(> .b) { color: blue }\n  .c { color: red }', '/tmp/r.native.css'),
    );
    assert.match(result.code, /rgb\(255, 0, 0\)/);
    assert.doesNotMatch(result.code, /rgb\(0, 0, 255\)/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /\/tmp\/r\.native\.css:3: dropped a rule: .*:has/);
  });

  it('accepts a native-ignore-unsupported comment and warns the same way', () => {
    const { warnings } = warned(() =>
      build(
        '  /* native-ignore-unsupported */ .a { color: red; float: left }',
        '/tmp/marked.native.css',
      ),
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /dropped 'float'/);
  });

  it('still fails the build on CSS that does not parse', () => {
    const { warnings } = warned(() =>
      assert.throws(() => build('  .a { color: red; }}', '/tmp/syntax.native.css')),
    );
    assert.deepEqual(warnings, []);
  });
});

describe('messages for things that are refused', () => {
  it('names the at-rule rather than printing an object', () => {
    assert.throws(() => compileCss('@supports (a: b) { .a { color: red } }'), /@supports/);
    assert.throws(() => compileCss('@layer base { .a { color: red } }'), /@layer/);
  });

  it('says a pseudo-element is permanent, not pending', () => {
    // Synthesising nodes no template declares is a different project, so never, not yet.
    assert.throws(() => compileCss('.a::before { color: red }'), /::before.*never/s);
  });

  // The rest were found reading the corpus's drop report, where each gave a reason that named the
  // wrong thing.

  it('names the at-rule, not the name a container query gives its container', () => {
    // `@container bulma-fixed-grid (...)` was reported as "'@bulma-fixed-grid' is not supported".
    assert.throws(
      () => compileCss('@container grid (min-width: 1px) { .a { color: red } }'),
      (error: Error) => {
        assert.match(error.message, /'@container'/);
        assert.doesNotMatch(error.message, /@grid/);
        return true;
      },
    );
  });

  it('says why a @keyframes inside @media is refused, rather than that @keyframes is', () => {
    // Open Props has dark-mode variants of its keyframes. Keyframes are global here, and there is
    // nothing for a condition on one to attach to.
    assert.throws(
      () => compileCss('@media (min-width: 1px) { @keyframes k { to { opacity: 1 } } }'),
      /@keyframes inside @media/,
    );
  });

  it('names a pseudo-class lightningcss does not know, rather than calling it custom', () => {
    assert.throws(() => compileCss(':-moz-focusring { color: red }'), /':-moz-focusring'/);
  });

  it('does not blame the missing hover cascade for a structural pseudo-class', () => {
    assert.throws(
      () => compileCss('.a:first-of-type { color: red }'),
      (error: Error) => {
        assert.match(error.message, /':first-of-type' is not supported yet/);
        assert.doesNotMatch(error.message, /hover/);
        return true;
      },
    );
  });

  it('describes a length where a keyword was wanted, and a radius that is not a number', () => {
    // These printed "'dimension'" and "[object Object] / [object Object]".
    assert.throws(() => declarationsOf('vertical-align: -0.125em'), /a length/);
    assert.throws(
      () => declarationsOf('border-top-left-radius: 1em 2em'),
      (error: Error) => !/object Object/.test(error.message) && /elliptical/.test(error.message),
    );
  });

  it('says native has no equivalent of the layout and text properties it has none of', () => {
    // These said "not mapped yet. React Native may well support it", which sends someone to look.
    for (const css of [
      'order: 1',
      'text-wrap: balance',
      'appearance: none',
      'word-break: keep-all',
    ]) {
      assert.throws(() => declarationsOf(css), /no React Native equivalent/, css);
    }
  });

  it('points a per-axis overflow at the one native has', () => {
    assert.throws(() => declarationsOf('overflow-x: auto'), /one overflow for both axes/);
  });

  it('says a vendor-prefixed property is one, rather than that it is unmapped', () => {
    assert.throws(() => declarationsOf('-webkit-margin-end: 1px'), /vendor-prefixed/);
    assert.throws(() => declarationsOf('-moz-column-gap: 1px'), /vendor-prefixed/);
  });
});

describe('the rest of the selector and unit surface', () => {
  it('writes a negative zero as zero', () => {
    // `-translate-x-0` is `-0px`. JSON has no negative zero, so the module Metro writes held 0
    // where the sheet compiled in memory held -0, and the two were not the same sheet.
    const [rule] = compileCss('.a { margin-left: -0px; --x: -0rem; --y: -0px }').rules;
    assert.ok(Object.is(rule!.declarations['marginLeft'], 0));
    assert.ok(Object.is((rule!.tokens!['--x'] as { length: number }).length, 0));
    assert.ok(Object.is((rule!.tokens!['--y'] as { length: number }).length, 0));
  });

  it('supports the remaining attribute operators', () => {
    const rule = (s: string) => compileCss(`${s} { color: red }`).rules[0];
    assert.equal(rule('view[data-x~="b"]').compounds[0].attributes[0].operator, 'includes');
    assert.equal(rule('view[lang|="en"]').compounds[0].attributes[0].operator, 'dash-match');
  });

  it('supports vmin and vmax, which cost nothing once vw and vh exist', () => {
    const { rules } = compileCss('view { width: 50vmin; height: 50vmax }');
    assert.deepEqual(rules[0].deferred, [
      { props: ['width'], compute: { unit: 'vmin', factor: 50 } },
      { props: ['height'], compute: { unit: 'vmax', factor: 50 } },
    ]);
  });
});

describe('longhands the shorthand tests were hiding', () => {
  // Each of these compiled fine inside `border`, `font` or `flex`, where the shorthand handler
  // pre-extracts a scalar, and threw as a standalone declaration because lightningcss hands
  // the longhand over in a structured form the generic keyword path could not read.
  it('z-index, which arrives as an integer node', () => {
    assert.deepEqual(declarationsOf('z-index: 2'), { zIndex: 2 });
  });

  it('elevation, which CSS has no standard for and so arrives as a custom property', () => {
    assert.deepEqual(declarationsOf('elevation: 3'), { elevation: 3 });
  });

  it('aspect-ratio, as the single number native takes', () => {
    assert.deepEqual(declarationsOf('aspect-ratio: 2'), { aspectRatio: 2 });
    assert.deepEqual(declarationsOf('aspect-ratio: 16 / 9'), { aspectRatio: 1.77778 });
  });

  it('refuses aspect-ratio: auto, which native has no spelling for', () => {
    assert.throws(() => declarationsOf('aspect-ratio: auto'), /auto/);
  });

  it('font-family, taking the first family as native does', () => {
    assert.deepEqual(declarationsOf('font-family: Arial'), { fontFamily: 'Arial' });
    assert.deepEqual(declarationsOf('font-family: "Helvetica Neue", Arial'), {
      fontFamily: 'Helvetica Neue',
    });
  });

  it('border-style, which is one value for every side on native', () => {
    assert.deepEqual(declarationsOf('border-style: dashed'), { borderStyle: 'dashed' });
  });

  it('refuses a border-style whose sides disagree, because native has only one', () => {
    assert.throws(() => declarationsOf('border-style: solid dashed'), /one border-style/i);
  });

  it('rounds the flex shorthand like every other number', () => {
    assert.deepEqual(declarationsOf('flex: 0.4 1 auto'), {
      flexGrow: 0.4,
      flexShrink: 1,
      flexBasis: 'auto',
    });
  });

  it('refuses an elliptical border-radius rather than keeping half of it', () => {
    assert.throws(() => declarationsOf('border-radius: 10px / 5px'), /elliptical/i);
    assert.throws(() => declarationsOf('border-top-left-radius: 4px 2px'), /elliptical/i);
  });

  it('accepts a border-radius whose two radii happen to agree', () => {
    assert.deepEqual(declarationsOf('border-radius: 8px / 8px'), {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    });
  });
});

describe('where an error points', () => {
  it('names the line of the rule that failed', () => {
    const css = 'view { color: red }\n\nview { rubbish: 1 }';
    assert.throws(() => compileCss(css, 'demo'), /demo:3\b/);
  });

  it('names the line in the warning too', () => {
    const dropped: string[] = [];
    compileCss('view { color: red }\n\nview { float: left }', 'demo', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.match(dropped[0]!, /demo:3\b/);
  });
});

describe('values the build settles on its own', () => {
  it('splits a two-value translate and scale into both axes, each with its own value', () => {
    assert.deepEqual(declarationsOf('transform: translate(4px, 8px) scale(2, 3)')['transform'], [
      { translateX: 4 },
      { translateY: 8 },
      { scaleX: 2 },
      { scaleY: 3 },
    ]);
  });

  it('takes a zero-width currentColor border as no border, with no colour to resolve', () => {
    const declarations = declarationsOf('border: 0 solid currentColor');
    assert.deepEqual(declarations, { ...everySide('Width', 0), borderStyle: 'solid' });
  });

  it('lays -webkit-box out as a row, its default orientation', () => {
    assert.deepEqual(declarationsOf('display: -webkit-box'), {
      display: 'flex',
      flexDirection: 'row',
    });
  });

  it('takes the colour of a layered background from its last layer, where CSS puts it', () => {
    assert.deepEqual(declarationsOf('background: none, blue'), {
      backgroundColor: 'rgb(0, 0, 255)',
    });
  });

  it('gives each inline edge its own colour, and refuses two block edges that differ', () => {
    assert.deepEqual(declarationsOf('border-inline-color: red blue'), {
      borderStartColor: 'rgb(255, 0, 0)',
      borderEndColor: 'rgb(0, 0, 255)',
    });
    assert.throws(
      () => declarationsOf('border-block-color: red blue'),
      /one colour for both edges/,
    );
  });

  it('places a zero beside a var() in a shorthand, and hides a hidden border', () => {
    assert.deepEqual(declarationsOf('margin: var(--a) 0'), { marginRight: 0, marginLeft: 0 });
    assert.deepEqual(declarationsOf('border: var(--c) hidden'), everySide('Width', 0));
  });

  it('settles a weight between the hundreds on the nearest one native draws', () => {
    // Native takes the nine hundreds and no others: `550` or `1000` is drawn at the regular
    // weight, with nothing but a native log line to say so.
    assert.equal(declarationsOf('font-weight: 550')['fontWeight'], '600');
    assert.equal(declarationsOf('font-weight: 449')['fontWeight'], '400');
    assert.equal(declarationsOf('font-weight: 1000')['fontWeight'], '900');
    assert.equal(declarationsOf('font-weight: 1')['fontWeight'], '100');
    assert.equal(declarationsOf('font-weight: 700')['fontWeight'], '700');
    const token = compileCss(':root { --w: 550 }').rules[0].tokens['--w'];
    assert.equal(token.weight, '600', 'a token holding one too');
  });

  it('reads a bare 0 as no hue rotation, on Android where the filter is drawn', () => {
    const rule = compileCss('view { filter: hue-rotate(0) }', 'filters', { platform: 'android' })
      .rules[0];
    assert.deepEqual(rule.declarations['filter'], [{ hueRotate: 0 }]);
  });
});

describe('the logical border shorthands', () => {
  it('border-inline-start and -end draw the start and end sides, which follow the direction', () => {
    assert.deepEqual(declarationsOf('border-inline-start: 3px solid red'), {
      borderStartWidth: 3,
      borderStartColor: 'rgb(255, 0, 0)',
    });
    assert.deepEqual(declarationsOf('border-inline-end: 1px solid blue'), {
      borderEndWidth: 1,
      borderEndColor: 'rgb(0, 0, 255)',
    });
  });

  it('border-block-start and -end are the top and bottom, the block axis being vertical', () => {
    assert.deepEqual(declarationsOf('border-block-end: 2px solid red'), {
      borderBottomWidth: 2,
      borderBottomColor: 'rgb(255, 0, 0)',
    });
  });

  it('border-inline and border-block draw both of their sides', () => {
    assert.deepEqual(declarationsOf('border-inline: 1px solid red'), {
      borderLeftWidth: 1,
      borderLeftColor: 'rgb(255, 0, 0)',
      borderRightWidth: 1,
      borderRightColor: 'rgb(255, 0, 0)',
    });
    assert.deepEqual(declarationsOf('border-block: 1px solid red'), {
      borderTopWidth: 1,
      borderTopColor: 'rgb(255, 0, 0)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgb(255, 0, 0)',
    });
  });
});
