/**
 * The properties React Native supports and this compiler had not reached yet.
 *
 * The scope rule is that if React Native can express it, CSS gets a spelling for
 * it. These were found by walking RN's own style types and putting the corresponding CSS through
 * the compiler, which is the only way this list stays honest: a property nobody happened to write
 * in a test is a property that silently does nothing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

const declarationsOf = (css: string): Record<string, unknown> =>
  compileCss(`view { ${css} }`).rules[0].declarations;

/** The same, compiled for an Android build, where every filter function is drawn. */
const androidDeclarationsOf = (css: string): Record<string, unknown> =>
  compileCss(`view { ${css} }`, 'test', { platform: 'android' }).rules[0].declarations;

const everySide = (part: 'Width' | 'Color', value: unknown) =>
  Object.fromEntries(
    ['Top', 'Right', 'Bottom', 'Left'].map((side) => [`border${side}${part}`, value]),
  );

describe('logical longhands', () => {
  // The shorthands already produced these props; only the longhand spellings were missing, which
  // is the half of the pair an RTL layout actually writes.
  it('spells each edge as the Yoga style every native view reads', () => {
    // The inline edges follow the layout direction, as Yoga's Start and End do. The block axis is
    // always vertical on native, which has one writing mode, so its edges are top and bottom.
    assert.deepEqual(declarationsOf('margin-inline-start: 4px'), { marginStart: 4 });
    assert.deepEqual(declarationsOf('margin-inline-end: 4px'), { marginEnd: 4 });
    assert.deepEqual(declarationsOf('margin-block-start: 4px'), { marginTop: 4 });
    assert.deepEqual(declarationsOf('margin-block-end: 4px'), { marginBottom: 4 });
    assert.deepEqual(declarationsOf('padding-inline-start: 4px'), { paddingStart: 4 });
    assert.deepEqual(declarationsOf('padding-inline-end: 4px'), { paddingEnd: 4 });
    assert.deepEqual(declarationsOf('padding-block-start: 4px'), { paddingTop: 4 });
    assert.deepEqual(declarationsOf('padding-block-end: 4px'), { paddingBottom: 4 });
    assert.deepEqual(declarationsOf('inset-inline-start: 4px'), { start: 4 });
    assert.deepEqual(declarationsOf('inset-inline-end: 4px'), { end: 4 });
    assert.deepEqual(declarationsOf('inset-block-start: 4px'), { top: 4 });
    assert.deepEqual(declarationsOf('inset-block-end: 4px'), { bottom: 4 });
  });

  it('takes the logical corner radii', () => {
    assert.deepEqual(declarationsOf('border-start-start-radius: 4px'), {
      borderStartStartRadius: 4,
    });
    assert.deepEqual(declarationsOf('border-end-end-radius: 4px'), { borderEndEndRadius: 4 });
  });

  it('takes a block border colour, which is two edges at once', () => {
    assert.deepEqual(declarationsOf('border-block-color: red'), {
      borderBlockColor: 'rgb(255, 0, 0)',
    });
    assert.deepEqual(declarationsOf('border-block-start-color: red'), {
      borderBlockStartColor: 'rgb(255, 0, 0)',
    });
  });
});

describe('outline', () => {
  // The shorthand worked and the longhands did not, which is the wrong way round: a focus ring is
  // usually one property at a time.
  it('takes its longhands, not only the shorthand', () => {
    assert.deepEqual(declarationsOf('outline-color: red'), { outlineColor: 'rgb(255, 0, 0)' });
    assert.deepEqual(declarationsOf('outline-width: 2px'), { outlineWidth: 2 });
    assert.deepEqual(declarationsOf('outline-offset: 2px'), { outlineOffset: 2 });
  });
});

describe('text', () => {
  it('reads a text transform, which lightningcss hands over as a record', () => {
    assert.deepEqual(declarationsOf('text-transform: uppercase'), { textTransform: 'uppercase' });
    assert.deepEqual(declarationsOf('text-transform: capitalize'), {
      textTransform: 'capitalize',
    });
    assert.deepEqual(declarationsOf('text-transform: none'), { textTransform: 'none' });
  });

  it('takes the font variants native has, as the list RN wants', () => {
    assert.deepEqual(declarationsOf('font-variant: small-caps'), { fontVariant: ['small-caps'] });
    assert.deepEqual(declarationsOf('font-variant: tabular-nums'), {
      fontVariant: ['tabular-nums'],
    });
  });
});

describe('transform-origin', () => {
  it('takes the keywords, not only lengths', () => {
    assert.deepEqual(declarationsOf('transform-origin: top left'), {
      transformOrigin: ['0%', '0%', 0],
    });
    assert.deepEqual(declarationsOf('transform-origin: center bottom'), {
      transformOrigin: ['50%', '100%', 0],
    });
    assert.deepEqual(declarationsOf('transform-origin: right'), {
      transformOrigin: ['100%', '50%', 0],
    });
  });
});

describe('filter', () => {
  // Fabric takes a list of one-key records, each naming a filter and carrying a plain number:
  // percentages are already fractions, and every angle is already in degrees.
  it('takes each primitive as the record native names it by', () => {
    assert.deepEqual(androidDeclarationsOf('filter: blur(2px)'), { filter: [{ blur: 2 }] });
    assert.deepEqual(declarationsOf('filter: brightness(50%)'), { filter: [{ brightness: 0.5 }] });
    assert.deepEqual(androidDeclarationsOf('filter: saturate(2)'), { filter: [{ saturate: 2 }] });
    assert.deepEqual(declarationsOf('filter: opacity(0.5)'), { filter: [{ opacity: 0.5 }] });
  });

  it('keeps a list in the order it was written, because filters compose', () => {
    assert.deepEqual(androidDeclarationsOf('filter: grayscale(1) blur(4px)'), {
      filter: [{ grayscale: 1 }, { blur: 4 }],
    });
  });

  it('spells the hue rotation in degrees, whatever the author measured in', () => {
    assert.deepEqual(androidDeclarationsOf('filter: hue-rotate(90deg)'), {
      filter: [{ hueRotate: 90 }],
    });
    assert.deepEqual(androidDeclarationsOf('filter: hue-rotate(0.25turn)'), {
      filter: [{ hueRotate: 90 }],
    });
  });

  it('takes a drop shadow, which is the one primitive with a shape of its own', () => {
    assert.deepEqual(androidDeclarationsOf('filter: drop-shadow(1px 2px 3px red)'), {
      filter: [
        {
          dropShadow: {
            offsetX: 1,
            offsetY: 2,
            standardDeviation: 3,
            color: 'rgb(255, 0, 0)',
          },
        },
      ],
    });
  });

  it('refuses a filter native has no name for', () => {
    assert.throws(() => declarationsOf('filter: url(#x)'), /filter/);
  });
});

describe('filter, per platform', () => {
  // React Native 0.86 draws brightness() and opacity() on iOS and nothing else: the rest need
  // enableSwiftUIBasedFilters, a feature flag that is off. Android draws all ten. A filter iOS
  // cannot draw compiled cleanly and left the view unchanged on an iPhone, with no message.
  const IOS_UNDRAWN = [
    'blur(2px)',
    'contrast(2)',
    'grayscale(1)',
    'hue-rotate(90deg)',
    'invert(1)',
    'saturate(2)',
    'sepia(1)',
    'drop-shadow(1px 2px 3px red)',
  ];

  it('refuses a filter iOS does not draw in a rule that can apply there', () => {
    for (const fn of IOS_UNDRAWN) {
      const name = fn.slice(0, fn.indexOf('('));
      assert.throws(
        () => declarationsOf(`filter: ${fn}`),
        (error: Error) => {
          assert.match(error.message, new RegExp(`filter: ${name}\\(\\) is not drawn on iOS`));
          assert.match(error.message, /\.platform-android/, 'says how to keep it for Android');
          return true;
        },
        fn,
      );
    }
  });

  it('names the function iOS cannot draw, not the ones beside it that it can', () => {
    assert.throws(() => declarationsOf('filter: brightness(0.5) blur(2px)'), /blur\(\)/);
  });

  it('keeps brightness() and opacity(), which both platforms draw', () => {
    assert.deepEqual(declarationsOf('filter: brightness(0.5) opacity(0.2)'), {
      filter: [{ brightness: 0.5 }, { opacity: 0.2 }],
    });
  });

  it('keeps any filter in a rule scoped to Android, which is what android: compiles to', () => {
    const sheet = compileCss('.platform-android .a { filter: grayscale(1) }', 'test');
    assert.deepEqual(sheet.rules[0].declarations, { filter: [{ grayscale: 1 }] });
  });

  it('refuses one in a rule scoped to iOS, where it would never be drawn', () => {
    assert.throws(
      () => compileCss('.platform-ios .a { filter: sepia(1) }', 'test'),
      /sepia\(\) is not drawn on iOS/,
    );
  });

  it('keeps any filter in an Android build, and refuses it in an iOS one', () => {
    const css = '.a { filter: grayscale(1) }';
    assert.deepEqual(compileCss(css, 'test', { platform: 'android' }).rules[0].declarations, {
      filter: [{ grayscale: 1 }],
    });
    assert.throws(() => compileCss(css, 'test', { platform: 'ios' }), /not drawn on iOS/);
  });

  it('checks every selector in a list, since any of them could match on iOS', () => {
    assert.throws(
      () => compileCss('.platform-android .a, .b { filter: blur(1px) }', 'test'),
      /not drawn on iOS/,
    );
  });

  it('drops only the filter, and says so, when there is somewhere to report it', () => {
    // How a Tailwind sheet, and a component's stylesheet in a build, are compiled.
    const dropped: string[] = [];
    const sheet = compileCss('.a { opacity: 0.5; filter: grayscale(1) }', 'test', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.deepEqual(sheet.rules[0].declarations, { opacity: 0.5 });
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /dropped 'filter'.*grayscale\(\) is not drawn on iOS/);
  });

  it('keeps the filter for the selectors of a list that are scoped to Android', () => {
    // lightningcss merges identical neighbouring rules into one list, so a utility and its
    // android: form can arrive together; dropping the filter for both lost the scoped one.
    const dropped: string[] = [];
    const sheet = compileCss(
      '.a, .platform-android .b { opacity: 0.5; filter: grayscale(1) }',
      't',
      {
        onUnsupported: (message: string) => dropped.push(message),
      },
    );
    const of = (name: string) =>
      sheet.rules.find((rule: { compounds: { classes: string[] }[] }) =>
        rule.compounds.some((c) => c.classes.includes(name)),
      ).declarations;
    assert.deepEqual(of('a'), { opacity: 0.5 });
    assert.deepEqual(of('b'), { opacity: 0.5, filter: [{ grayscale: 1 }] });
    assert.equal(dropped.length, 1);
  });

  it('reads a filter list made of tokens, one slot each, for the device to fill', () => {
    // Tailwind's shape: every filter utility sets its own slot and reads all of them, so
    // `blur-sm grayscale` is one list made of two classes.
    const sheet = compileCss(
      '.platform-android .g { --g: grayscale(1); filter: var(--b,) var(--g,) }',
      'test',
    );
    const [rule] = sheet.rules;
    assert.deepEqual(rule.tokens, { '--g': { filter: [{ grayscale: 1 }] } });
    assert.deepEqual(rule.deferred, [
      {
        props: ['filter'],
        within: [
          { __filters: { reference: '--b', fallback: [] } },
          { __filters: { reference: '--g', fallback: [] } },
        ],
      },
    ]);
  });

  it('refuses a filter token iOS does not draw where it sets it, and keeps it for Android', () => {
    const dropped: string[] = [];
    const sheet = compileCss(
      '.g { --g: grayscale(1) } .platform-android .h { --g: grayscale(1) } .b { --b: brightness(0.5) }',
      'test',
      { onUnsupported: (message: string) => dropped.push(message) },
    );
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /dropped '--g'.*grayscale\(\) is not drawn on iOS/);
    const tokensOf = (name: string) =>
      sheet.rules.find((rule: { compounds: { classes: string[] }[] }) =>
        rule.compounds.some((c) => c.classes.includes(name)),
      )?.tokens;
    assert.equal(tokensOf('g'), undefined);
    assert.deepEqual(tokensOf('h'), { '--g': { filter: [{ grayscale: 1 }] } });
    assert.deepEqual(tokensOf('b')!['--b']!.filter, [{ brightness: 0.5 }]);
  });

  it('checks a filter whose length is only known on device', () => {
    const dropped: string[] = [];
    const sheet = compileCss('.a { filter: blur(0.5em) }', 'test', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.equal(sheet.rules.length, 0, 'nothing is left to apply');
    assert.match(dropped.join(''), /blur\(\) is not drawn on iOS/);
  });

  it('checks a keyframe, which has no selector to scope it', () => {
    assert.throws(
      () => compileCss('@keyframes fade { to { filter: blur(4px) } }', 'test'),
      /blur\(\) is not drawn on iOS/,
    );
    const sheet = compileCss('@keyframes fade { to { filter: blur(4px) } }', 'test', {
      platform: 'android',
    });
    assert.deepEqual(sheet.keyframes['fade'][0].declarations, { filter: [{ blur: 4 }] });
  });
});

describe('skew, per platform', () => {
  // React Native on Android breaks a transform down into the rotation, scale and translation an
  // Android view has, and a view has no skew: skewX() is left out, and skewY() comes out as a
  // rotation. iOS draws both. A skew compiled for Android was a silent difference.

  it('refuses a skew in a rule that can apply on Android, and names it', () => {
    for (const fn of ['skewX(12deg)', 'skewY(12deg)']) {
      assert.throws(
        () => declarationsOf(`transform: rotate(10deg) ${fn}`),
        (error: Error) => {
          assert.match(error.message, /skew[XY]\(\) is not drawn on Android/);
          assert.match(error.message, /\.platform-ios/, 'says how to keep it for iOS');
          return true;
        },
        fn,
      );
    }
  });

  it('keeps a skew of 0, which draws the same on Android: how a variant takes one back out', () => {
    assert.deepEqual(declarationsOf('transform: skewX(0deg)'), { transform: [{ skewX: '0deg' }] });
  });

  it('keeps a skew in a rule scoped to iOS, which is what ios: compiles to', () => {
    const sheet = compileCss('.platform-ios .a { transform: skewX(12deg) }', 'test');
    assert.deepEqual(sheet.rules[0].declarations, { transform: [{ skewX: '12deg' }] });
  });

  it('keeps a skew in an iOS build, and refuses it in an Android one', () => {
    const css = '.a { transform: skewX(12deg) }';
    assert.deepEqual(compileCss(css, 'test', { platform: 'ios' }).rules[0].declarations, {
      transform: [{ skewX: '12deg' }],
    });
    assert.throws(() => compileCss(css, 'test', { platform: 'android' }), /not drawn on Android/);
  });

  it('keeps the rest of the rule, and says what it dropped', () => {
    const dropped: string[] = [];
    const sheet = compileCss('.a { opacity: 0.5; transform: skewX(12deg) }', 'test', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.deepEqual(sheet.rules[0].declarations, { opacity: 0.5 });
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /dropped 'transform'.*skewX\(\) is not drawn on Android/);
  });

  it('refuses a skew token where it sets it, and keeps it for iOS', () => {
    // Tailwind's shape: skew-x-12 sets a slot every transform utility reads.
    const dropped: string[] = [];
    const sheet = compileCss(
      '.s { --s: skewX(12deg) } .platform-ios .t { --s: skewX(12deg) }',
      'test',
      { onUnsupported: (message: string) => dropped.push(message) },
    );
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /dropped '--s'.*skewX\(\) is not drawn on Android/);
    const tokensOf = (name: string) =>
      sheet.rules.find((rule: { compounds: { classes: string[] }[] }) =>
        rule.compounds.some((c) => c.classes.includes(name)),
      )?.tokens;
    assert.equal(tokensOf('s'), undefined);
    assert.deepEqual(tokensOf('t'), { '--s': { transform: [{ skewX: '12deg' }] } });
  });

  it('checks a keyframe, which has no selector to scope it', () => {
    assert.throws(
      () => compileCss('@keyframes lean { to { transform: skewX(12deg) } }', 'test'),
      /skewX\(\) is not drawn on Android/,
    );
    const sheet = compileCss('@keyframes lean { to { transform: skewX(12deg) } }', 'test', {
      platform: 'ios',
    });
    assert.deepEqual(sheet.keyframes['lean'][0].declarations, {
      transform: [{ skewX: '12deg' }],
    });
  });
});

describe('background sizing', () => {
  // Only meaningful now that a background can be a gradient rather than nothing.
  it('takes the keywords and an explicit pair', () => {
    assert.deepEqual(declarationsOf('background-size: cover'), {
      experimental_backgroundSize: ['cover'],
    });
    assert.deepEqual(declarationsOf('background-size: 50% auto'), {
      experimental_backgroundSize: [{ x: '50%', y: 'auto' }],
    });
  });

  it('takes a repeat per axis, which is what native reads', () => {
    assert.deepEqual(declarationsOf('background-repeat: no-repeat'), {
      experimental_backgroundRepeat: [{ x: 'no-repeat', y: 'no-repeat' }],
    });
    assert.deepEqual(declarationsOf('background-repeat: repeat-x'), {
      experimental_backgroundRepeat: [{ x: 'repeat', y: 'no-repeat' }],
    });
  });

  it('takes a position as the pair of edges it is measured from', () => {
    assert.deepEqual(declarationsOf('background-position: center'), {
      experimental_backgroundPosition: [{ left: '50%', top: '50%' }],
    });
    assert.deepEqual(declarationsOf('background-position: right 10px bottom 20px'), {
      experimental_backgroundPosition: [{ right: 10, bottom: 20 }],
    });
  });
});

describe('nested rules', () => {
  const sheetOf = (css: string) => compileCss(css, 'test');
  const selectorsOf = (css: string) =>
    sheetOf(css).rules.map((rule: { compounds: { classes?: string[]; name?: string }[] }) =>
      rule.compounds.map((c) => c.classes?.[0] ?? c.name).join(' '),
    );

  it('flattens a nested rule into the selector it stands for', () => {
    // What a component stylesheet is written in now. The engine matches flat selectors, so the
    // nesting is lowered at build time rather than understood at match time.
    assert.deepEqual(selectorsOf('.a { color: red; & .b { color: blue } }'), ['a', 'a b']);
  });

  it('takes the implicit form, where the nested selector needs no ampersand', () => {
    assert.deepEqual(selectorsOf('.a { .b { color: blue } }'), ['a b']);
  });

  it('takes an ampersand that is not at the front', () => {
    assert.deepEqual(selectorsOf('.a { .b & { color: blue } }'), ['b a']);
  });

  it('joins a state onto the parent rather than descending into it', () => {
    const [rule] = sheetOf('.a { &:active { color: blue } }').rules;
    assert.deepEqual(rule.compounds, [{ classes: ['a'], pseudo: ['active'] }]);
  });

  it('nests inside a media query, which is where a component puts its breakpoints', () => {
    const [rule] = sheetOf('.a { @media (min-width: 100px) { & .b { color: blue } } }').rules;
    assert.ok(rule.condition, 'the query survived the flattening');
    assert.deepEqual(
      rule.compounds.map((c: { classes?: string[] }) => c.classes?.[0]),
      ['a', 'b'],
    );
  });
});

describe('names Fabric actually reads', () => {
  // This renderer writes props straight to Fabric, so a prop spelled the way RN's JavaScript API
  // spells it - where the JS layer renames it before native ever sees it - silently does nothing.
  // Each of these compiled cleanly to a name Fabric's C++ has no reader for.

  it('spells the inline border colours as the start and end ones Fabric has', () => {
    // Fabric reads `borderStartColor` and `borderEndColor`; there is no `borderInlineStartColor`.
    assert.deepEqual(declarationsOf('border-inline-start-color: red'), {
      borderStartColor: 'rgb(255, 0, 0)',
    });
    assert.deepEqual(declarationsOf('border-inline-end-color: red'), {
      borderEndColor: 'rgb(255, 0, 0)',
    });
    // One colour for both is left and right, which a later `border-left-color` can override:
    // Yoga's start and end outrank left and right whatever the order.
    assert.deepEqual(declarationsOf('border-inline-color: red'), {
      borderLeftColor: 'rgb(255, 0, 0)',
      borderRightColor: 'rgb(255, 0, 0)',
    });
    assert.deepEqual(declarationsOf('border-inline-color: red blue'), {
      borderStartColor: 'rgb(255, 0, 0)',
      borderEndColor: 'rgb(0, 0, 255)',
    });
  });

  it('refuses a unitless width in a border or outline shorthand, as a browser drops it', () => {
    for (const property of [
      'border',
      'border-top',
      'border-left',
      'border-inline',
      'border-inline-start',
      'border-block',
      'border-block-end',
      'outline',
    ]) {
      assert.throws(() => declarationsOf(`${property}: 3 solid red`), /needs a unit/, property);
    }
    assert.deepEqual(declarationsOf('border: 0 solid red').borderTopWidth, 0, 'only 0 may go bare');
  });

  it('puts a border-inline colour from a token on left and right, as a written one', () => {
    const sheet = compileCss('.a { --c: red; border-inline-color: var(--c) }', 'test');
    assert.deepEqual(sheet.rules[0].deferred[0].props, ['borderLeftColor', 'borderRightColor']);
  });

  it('puts a border-inline width from a token on left and right, as a written one', () => {
    // So a later border-left overrides it on native as it does on the web, whichever it is.
    const sheet = compileCss('.a { --w: 3px; border-inline-width: var(--w) }', 'test');
    assert.deepEqual(sheet.rules[0].deferred[0].props, ['borderLeftWidth', 'borderRightWidth']);
  });

  it('takes the inline border widths, which were not mapped at all', () => {
    assert.deepEqual(declarationsOf('border-inline-start-width: 2px'), { borderStartWidth: 2 });
    assert.deepEqual(declarationsOf('border-inline-end-width: 2px'), { borderEndWidth: 2 });
    assert.deepEqual(declarationsOf('border-inline-width: 3px'), {
      borderLeftWidth: 3,
      borderRightWidth: 3,
    });
    assert.deepEqual(declarationsOf('border-inline-width: 1px 3px'), {
      borderStartWidth: 1,
      borderEndWidth: 3,
    });
  });

  it("reads object-fit as the resizeMode an image takes, by RN's own table", () => {
    // RN's Image component turns `objectFit` into `resizeMode` in JavaScript; Fabric only knows
    // the second.
    assert.deepEqual(declarationsOf('object-fit: cover'), { resizeMode: 'cover' });
    assert.deepEqual(declarationsOf('object-fit: fill'), { resizeMode: 'stretch' });
    assert.deepEqual(declarationsOf('object-fit: scale-down'), { resizeMode: 'contain' });
  });

  it("reads vertical-align as textAlignVertical, by RN's own table", () => {
    assert.deepEqual(declarationsOf('vertical-align: middle'), { textAlignVertical: 'center' });
    assert.deepEqual(declarationsOf('vertical-align: top'), { textAlignVertical: 'top' });
    assert.throws(() => declarationsOf('vertical-align: baseline'), /baseline/);
  });

  it('reads user-select as whether the text is selectable', () => {
    assert.deepEqual(declarationsOf('user-select: none'), { selectable: false });
    assert.deepEqual(declarationsOf('user-select: text'), { selectable: true });
  });
});

describe('spellings that mean a property already mapped', () => {
  it('reads the logical sizes as width and height, the only writing mode native has', () => {
    // Open Props' normalize writes `max-inline-size` and `block-size` throughout.
    assert.deepEqual(declarationsOf('inline-size: 10px'), { width: 10 });
    assert.deepEqual(declarationsOf('block-size: 20px'), { height: 20 });
    assert.deepEqual(declarationsOf('min-inline-size: 1px'), { minWidth: 1 });
    assert.deepEqual(declarationsOf('max-block-size: none'), { maxHeight: null });
    const token = compileCss('view { max-inline-size: var(--w) }').rules[0];
    assert.deepEqual(token.deferred[0].props, ['maxWidth']);
  });

  it('reads the grid gap names, which are older spellings of gap', () => {
    // Pico's `.grid` is `grid-column-gap: var(--pico-grid-column-gap)`.
    assert.deepEqual(declarationsOf('grid-row-gap: 4px'), { rowGap: 4 });
    assert.deepEqual(declarationsOf('grid-column-gap: 1rem'), { columnGap: 16 });
    assert.deepEqual(declarationsOf('grid-gap: 6px'), { rowGap: 6, columnGap: 6 });
    const token = compileCss('view { grid-column-gap: var(--g) }').rules[0];
    assert.deepEqual(token.deferred, [{ props: ['columnGap'], kind: 'length', reference: '--g' }]);
  });
});

describe('the alignment keywords Yoga reads', () => {
  // Fabric parses each alignment prop against Yoga's fixed list of strings and drops anything
  // else without a word, so a CSS keyword passed straight through was an alignment that silently
  // did nothing. Each is now one of Yoga's strings, a CSS spelling of one, or refused.

  it('reads baseline as the baseline Yoga has, not the first of its positions', () => {
    // lightningcss hands 'baseline' over as the 'first' baseline position.
    assert.deepEqual(declarationsOf('align-items: baseline'), { alignItems: 'baseline' });
    assert.deepEqual(declarationsOf('align-self: first baseline'), { alignSelf: 'baseline' });
    // Neither engine has a baseline for the lines of a wrapping box: CSS falls back to start, and
    // React Native does not take the word at all, so it is the start it comes to.
    assert.deepEqual(declarationsOf('align-content: baseline'), { alignContent: 'flex-start' });
    assert.throws(() => declarationsOf('align-items: last baseline'), /last baseline/);
  });

  it('reads the box-alignment positions as the flex ones Yoga has', () => {
    assert.deepEqual(declarationsOf('align-items: start'), { alignItems: 'flex-start' });
    assert.deepEqual(declarationsOf('align-items: self-end'), { alignItems: 'flex-end' });
    assert.deepEqual(declarationsOf('align-self: end'), { alignSelf: 'flex-end' });
    assert.deepEqual(declarationsOf('align-content: start'), { alignContent: 'flex-start' });
    assert.deepEqual(declarationsOf('justify-content: start'), { justifyContent: 'flex-start' });
    assert.deepEqual(declarationsOf('justify-content: end'), { justifyContent: 'flex-end' });
    assert.deepEqual(declarationsOf('align-items: safe center'), { alignItems: 'center' });
  });

  it('reads normal as what it means in a flex container', () => {
    assert.deepEqual(declarationsOf('align-items: normal'), { alignItems: 'stretch' });
    assert.deepEqual(declarationsOf('align-self: normal'), { alignSelf: 'stretch' });
    assert.deepEqual(declarationsOf('align-content: normal'), { alignContent: 'stretch' });
    assert.deepEqual(declarationsOf('justify-content: normal'), { justifyContent: 'flex-start' });
  });

  it('refuses the alignments Yoga cannot do', () => {
    assert.throws(() => declarationsOf('justify-content: stretch'), /justify-content/);
    assert.throws(() => declarationsOf('justify-content: left'), /justify-content/);
    assert.throws(() => declarationsOf('align-items: anchor-center'), /align-items/);
  });
});

describe('the line styles native can draw', () => {
  // Fabric reads a border or outline style of solid, dotted or dashed, and a decoration style of
  // those or double. Anything else was committed as written and dropped by Fabric, so the line
  // was drawn in whatever style it already had.

  it('takes the styles native draws', () => {
    assert.deepEqual(declarationsOf('border-style: dashed'), { borderStyle: 'dashed' });
    assert.deepEqual(declarationsOf('outline-style: dotted'), { outlineStyle: 'dotted' });
    assert.deepEqual(declarationsOf('text-decoration-style: double'), {
      textDecorationStyle: 'double',
    });
  });

  it('refuses the ones it cannot, in the longhands and the shorthands', () => {
    assert.throws(() => declarationsOf('border-style: double'), /double/);
    assert.throws(() => declarationsOf('border: 1px inset red'), /inset/);
    assert.throws(() => declarationsOf('outline-style: groove'), /groove/);
    assert.throws(() => declarationsOf('outline: 2px double red'), /double/);
    assert.throws(() => declarationsOf('text-decoration-style: wavy'), /wavy/);
    assert.throws(() => declarationsOf('text-decoration: underline wavy red'), /wavy/);
  });

  it('reads a style of none as no line, as the shorthands already did', () => {
    // CSS computes the width of a line styled none as 0. Native has no none style, so the style
    // is kept only for the engine, which zeroes a width a later rule sets and sends none of it.
    const none = { ...everySide('Width', 0), borderStyle: 'none' };
    assert.deepEqual(declarationsOf('border-style: none'), none);
    assert.deepEqual(declarationsOf('border-style: hidden'), none);
    assert.deepEqual(declarationsOf('outline-style: none'), { outlineWidth: 0 });
  });
});

describe('the other keywords Fabric reads', () => {
  it('refuses a text-align native has no value for', () => {
    // Start and end stay logical; the engine resolves them against the paragraph's direction.
    assert.deepEqual(declarationsOf('text-align: start'), { textAlign: 'start' });
    assert.deepEqual(declarationsOf('text-align: end'), { textAlign: 'end' });
    assert.throws(() => declarationsOf('text-align: match-parent'), /text-align/);
  });

  it('reads the pointer-events values only SVG has as auto, as a browser does', () => {
    // Bulma's is-clickable is pointer-events: all, which Fabric dropped.
    assert.deepEqual(declarationsOf('pointer-events: all'), { pointerEvents: 'auto' });
    assert.deepEqual(declarationsOf('pointer-events: visible-painted'), { pointerEvents: 'auto' });
    assert.deepEqual(declarationsOf('pointer-events: none'), { pointerEvents: 'none' });
    assert.deepEqual(declarationsOf('pointer-events: box-none'), { pointerEvents: 'box-none' });
  });
});

describe('font-style', () => {
  it('reads oblique as oblique, whatever angle it names', () => {
    // lightningcss fills in the default 14deg, and the keyword used to be read off that angle,
    // which committed a font style of 'deg'.
    assert.deepEqual(declarationsOf('font-style: oblique'), { fontStyle: 'oblique' });
    assert.deepEqual(declarationsOf('font-style: oblique 20deg'), { fontStyle: 'oblique' });
    assert.equal(declarationsOf('font: oblique 12px serif')['fontStyle'], 'oblique');
    assert.deepEqual(declarationsOf('font-style: italic'), { fontStyle: 'italic' });
  });
});
