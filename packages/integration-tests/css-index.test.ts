/**
 * Which rules a node is even considered against.
 *
 * The resolver used to walk every rule for every node, which is fine for a component's dozen and
 * hopeless for a utility sheet's hundreds: a Tailwind app would spend a million match attempts
 * mounting one screen. So rules are bucketed by the most selective simple selector in their
 * rightmost compound - what a browser calls the key selector - and a node only sees the buckets
 * its own classes, name and id can reach, plus the ones nothing can be keyed on.
 *
 * These tests are about the *bucketing*, since the matching itself is covered elsewhere and must
 * not change: a rule that would have matched before still has to be offered.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import {
  candidateRules,
  indexRules,
  ruleKey,
  type StyleSheet,
  type StyleTarget,
} from '../fabric/src/css.ts';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs') as {
  compileCss(
    source: string,
    context?: string,
    options?: { onUnsupported?: (message: string) => void },
  ): StyleSheet;
};

const sheetOf = (css: string) => compileCss(css, 'test');
const keys = (css: string) => sheetOf(css).rules.map((rule) => ruleKey(rule));

describe('the key selector a rule is bucketed by', () => {
  it('is the class of a single-class selector', () => {
    assert.deepEqual(keys('.card { flex: 1 }'), ['class:card']);
  });

  it('is the element name when there is no class', () => {
    assert.deepEqual(keys('view { flex: 1 }'), ['type:view']);
  });

  it('is the id when there is one', () => {
    assert.deepEqual(keys('#header { flex: 1 }'), ['id:header']);
  });

  it('is the rightmost compound, because matching counts leftwards', () => {
    assert.deepEqual(keys('.card .title { flex: 1 }'), ['class:title']);
    assert.deepEqual(keys('.card > view { flex: 1 }'), ['type:view']);
  });

  it('prefers a class over the element name in the same compound', () => {
    assert.deepEqual(keys('view.card { flex: 1 }'), ['class:card']);
  });

  it('falls back to the universal bucket for anything not keyed on a name', () => {
    // An attribute test, `:host`, and `*` can match a node whose classes say nothing, so they
    // have to be offered to every node or they would silently stop applying.
    assert.deepEqual(keys('[data-open] { flex: 1 }'), ['*']);
    assert.deepEqual(keys(':host { flex: 1 }'), ['*']);
    assert.deepEqual(keys('* { flex: 1 }'), ['*']);
  });

  it('gives every selector in a list its own bucket', () => {
    // A selector list compiles to one rule each, and the compiler emits them in specificity
    // order - `view` before `.a` - which is the order the cascade wants anyway.
    assert.deepEqual(keys('.a, view, [x] { flex: 1 }'), ['type:view', 'class:a', '*']);
  });
});

describe('the candidates a node is offered', () => {
  const entriesOf = (css: string) => {
    const sheet = sheetOf(css);
    return sheet.rules.map((rule, order) => ({ rule, sheet, weight: order }));
  };
  const target = (name: string, classes: string[], props: Record<string, unknown> = {}) =>
    ({
      name,
      parent: null,
      classes: new Set(classes),
      props,
      sheet: null,
      hostSheet: null,
      styleCache: null,
      styleDirty: false,
    }) as unknown as StyleTarget;

  it('offers the rules keyed on what the node is, and nothing else', () => {
    const entries = entriesOf('.a { flex: 1 } .b { flex: 2 } view { flex: 3 } text { flex: 4 }');
    const index = indexRules(entries);
    const offered = candidateRules(target('view', ['a']), index);
    assert.deepEqual(
      offered.map((entry) => ruleKey(entry.rule)),
      ['type:view', 'class:a'],
      'both buckets, still in the order the sheet had them',
    );
  });

  it('always offers the universal bucket', () => {
    const entries = entriesOf('* { flex: 1 } .other { flex: 2 }');
    const offered = candidateRules(target('view', []), indexRules(entries));
    assert.equal(offered.length, 1);
    assert.equal(ruleKey(offered[0]!.rule), '*');
  });

  it('keeps the order the rules were merged in, across buckets', () => {
    // The cascade depends on it: the list is sorted by weight before it is indexed, and later
    // simply wins. Collecting from several buckets must not shuffle that.
    const entries = entriesOf('.a { flex: 1 } view { flex: 2 } .b { flex: 3 }');
    const offered = candidateRules(target('view', ['a', 'b']), indexRules(entries));
    assert.deepEqual(
      offered.map((entry) => entry.weight),
      [0, 1, 2],
      'the weights are the positions in the merged list, and they come back ascending',
    );
  });

  it('offers a rule once, however many of its selectors could reach the node', () => {
    const entries = entriesOf('.a, .b { flex: 1 }');
    const offered = candidateRules(target('view', ['a', 'b']), indexRules(entries));
    assert.equal(offered.length, 2, 'a selector list is two rules, and each is offered once');
  });
});

describe('a rule that translated to nothing', () => {
  it('is not kept, so it is never a candidate', () => {
    // Tailwind's theme rules are custom properties, substituted at build time, and its resets are
    // browser-only properties this engine drops. Either way what is left is an empty `:root` or
    // `*` rule - no key class, so the bucket every single node is offered.
    const sheet = compileCss(
      '* { -webkit-font-smoothing: antialiased }\n.p { padding-top: 4px }',
      'test',
      {
        onUnsupported: () => {},
      },
    );
    assert.deepEqual(
      sheet.rules.map((rule) => rule.compounds.at(-1)?.classes),
      [['p']],
    );
  });

  it('still keeps a rule that only defines custom properties', () => {
    // Empty of declarations, but not empty: the tokens are the point of the rule.
    const sheet = compileCss(':root { --brand: red }', 'test', { onUnsupported: () => {} });
    assert.equal(sheet.rules.length, 1);
  });
});
