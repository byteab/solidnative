/**
 * Truncated text ends in an ellipsis, as React Native's own `Text` does. Its JavaScript defaults
 * `ellipsizeMode` to 'tail'; native's own default is to clip, so leaving it unset cut a long
 * address off mid-letter with nothing to say it went on.
 *
 * CSS says the same with `white-space: nowrap` and `text-overflow`, and with `line-clamp`, which
 * is what Tailwind's `truncate` and `line-clamp-*` write. Native has no style for either: a
 * paragraph is truncated by its `numberOfLines` and `ellipsizeMode` props, which the compiler
 * writes instead.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { cleanup, render, screen } from '@solid-native/testing';
import { Truncated, TruncatedByCss } from './ui-truncated-fixture.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');
const { flattenTailwind } = require('@solid-native/tailwind') as {
  flattenTailwind(css: string): string;
};

/** The declarations a single-rule stylesheet produces, or undefined when it produces none. */
const declarationsOf = (css: string): Record<string, unknown> | undefined =>
  compileCss(`text { ${css} }`, 'test').rules[0]?.declarations;

afterEach(cleanup);

describe('truncated text', () => {
  it('ends in an ellipsis unless told otherwise', () => {
    render(Truncated);

    assert.equal(screen.getByTestId('default').props['ellipsizeMode'], 'tail');
    assert.equal(screen.getByTestId('head').props['ellipsizeMode'], 'head');
  });
});

describe('truncation written in CSS', () => {
  it('reads line-clamp, prefixed or not, as the number of lines', () => {
    assert.deepEqual(declarationsOf('-webkit-line-clamp: 2'), { numberOfLines: 2 });
    assert.deepEqual(declarationsOf('line-clamp: 3'), { numberOfLines: 3 });
  });

  it('reads none and unset as no clamp, which a later rule uses to undo one', () => {
    assert.deepEqual(declarationsOf('line-clamp: none'), { numberOfLines: null });
    assert.deepEqual(declarationsOf('-webkit-line-clamp: unset'), { numberOfLines: null });
    assert.deepEqual(declarationsOf('-webkit-line-clamp: initial'), { numberOfLines: null });
  });

  it('refuses a clamp that is not a whole number of lines', () => {
    assert.throws(() => declarationsOf('line-clamp: 1.5'), /line-clamp.*whole number of lines/);
    assert.throws(() => declarationsOf('line-clamp: 0'), /line-clamp.*whole number of lines/);
    // A length is not a number of lines: `line-clamp-[13px]` was thirteen of them.
    assert.throws(
      () => declarationsOf('-webkit-line-clamp: 13px'),
      /'-webkit-line-clamp' takes no length/,
    );
    assert.throws(() => declarationsOf('line-clamp: 30deg'), /'line-clamp' takes no angle/);
  });

  it('reads white-space: nowrap as one line, and normal as no limit', () => {
    assert.deepEqual(declarationsOf('white-space: nowrap'), { numberOfLines: 1 });
    assert.deepEqual(declarationsOf('white-space: normal'), { numberOfLines: null });
  });

  it('refuses the white-space values about keeping spaces, which native has no switch for', () => {
    assert.throws(() => declarationsOf('white-space: pre'), /white-space: pre.*nowrap/);
  });

  it('reads text-overflow as where the ellipsis goes', () => {
    assert.deepEqual(declarationsOf('text-overflow: ellipsis'), { ellipsizeMode: 'tail' });
    assert.deepEqual(declarationsOf('text-overflow: clip'), { ellipsizeMode: 'clip' });
    assert.throws(() => declarationsOf('text-overflow: "-"'), /text-overflow/);
  });

  it('reads the old flexbox display line-clamp needs as the flex box native already is', () => {
    assert.deepEqual(declarationsOf('display: -webkit-box; -webkit-box-orient: vertical'), {
      display: 'flex',
      flexDirection: 'column',
    });
  });

  it('reads box-orient alone as nothing, as a browser does without display: -webkit-box', () => {
    // Tailwind's line-clamp-none writes `-webkit-box-orient: horizontal` beside `display: block`,
    // and a row there would lay a view's children out side by side where the web does not.
    assert.deepEqual(declarationsOf('display: block; -webkit-box-orient: horizontal'), {
      display: 'flex',
    });
    assert.equal(compileCss('text { -webkit-box-orient: vertical }', 'test').rules.length, 0);
  });

  it('reads font-variant-numeric as the font variants native asks a font for', () => {
    assert.deepEqual(declarationsOf('font-variant-numeric: tabular-nums'), {
      fontVariant: ['tabular-nums'],
    });
    assert.deepEqual(declarationsOf('font-variant-numeric: oldstyle-nums proportional-nums'), {
      fontVariant: ['oldstyle-nums', 'proportional-nums'],
    });
    assert.deepEqual(declarationsOf('font-variant-numeric: normal'), { fontVariant: null });
    assert.throws(
      () => declarationsOf('font-variant-numeric: slashed-zero'),
      /'slashed-zero' is not a font variant native can ask a font for/,
    );
  });

  describe('on a rendered text', () => {
    const props = (id: string) => screen.getByTestId(id).props;

    it('truncates to one line with an ellipsis, as truncate does on the web', () => {
      render(TruncatedByCss);
      assert.equal(props('truncate')['numberOfLines'], 1);
      assert.equal(props('truncate')['ellipsizeMode'], 'tail');
    });

    it('clamps to the lines line-clamp names', () => {
      render(TruncatedByCss);
      assert.equal(props('clamp')['numberOfLines'], 2);
      assert.equal(props('clamp')['ellipsizeMode'], 'tail');
    });

    it('lets text-overflow: clip win over the ellipsis a text has by default', () => {
      render(TruncatedByCss);
      assert.equal(props('clip')['ellipsizeMode'], 'clip');
    });

    it('lets a bound numberOfLines win over the stylesheet, as an explicit prop does', () => {
      render(TruncatedByCss);
      assert.equal(props('bound')['numberOfLines'], 3);
    });

    it('lets a later rule undo a clamp', () => {
      render(TruncatedByCss);
      // Null is how a declaration clears a prop back to native's default, which is no limit.
      assert.equal(props('unclamped')['numberOfLines'], null);
    });
  });

  it("compiles Tailwind's truncate, line-clamp-* and tabular-nums without dropping them", () => {
    // Tailwind 4.3's own output for the four utilities.
    const numeric =
      'var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) ' +
      'var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)';
    const css =
      '.line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; ' +
      '-webkit-line-clamp: 2; }\n' +
      '.line-clamp-none { overflow: visible; display: block; -webkit-box-orient: horizontal; ' +
      '-webkit-line-clamp: unset; }\n' +
      '.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n' +
      `.tabular-nums { --tw-numeric-spacing: tabular-nums; font-variant-numeric: ${numeric}; }\n` +
      '*, ::before { --tw-ordinal: initial; --tw-slashed-zero: initial; ' +
      '--tw-numeric-figure: initial; --tw-numeric-spacing: initial; --tw-numeric-fraction: initial; }\n';
    const refused: string[] = [];
    const sheet = compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    const of = (name: string) =>
      sheet.rules.find((rule: { compounds: { classes: string[] }[] }) =>
        rule.compounds.some((c) => c.classes.includes(name)),
      )?.declarations;

    assert.deepEqual(
      refused.filter((message) => !message.includes("dropped '--")),
      [],
    );
    assert.deepEqual(of('truncate'), {
      overflow: 'hidden',
      ellipsizeMode: 'tail',
      numberOfLines: 1,
    });
    assert.deepEqual(of('line-clamp-2'), {
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      numberOfLines: 2,
    });
    assert.deepEqual(of('line-clamp-none'), {
      overflow: 'visible',
      display: 'flex',
      numberOfLines: null,
    });
    assert.deepEqual(of('tabular-nums'), { fontVariant: ['tabular-nums'] });
  });
});
