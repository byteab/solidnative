/**
 * Selector forms beyond type, class and id: attribute selectors and the functional pseudo-classes
 * that are pure selector algebra.
 *
 * All of these are compile-time work plus a matcher that reads state nodes already carry, which is
 * why they come before anything needing a new invalidation path.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { matches, type StyleRule, type StyleTarget } from '@solid-native/fabric';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

/** A standalone node, with no parent, carrying the given props and classes. */
function node(
  name: string,
  props: Record<string, unknown> = {},
  classes: string[] = [],
  parent: StyleTarget | null = null,
): StyleTarget {
  return {
    name,
    parent,
    classes: new Set(classes),
    props,
    sheet: null,
    hostSheet: null,
    styleCache: null,
    styleDirty: true,
  };
}

const ruleFor = (selector: string): StyleRule => compileCss(`${selector} { color: red }`).rules[0];

const hits = (selector: string, target: StyleTarget): boolean => matches(target, ruleFor(selector));

describe('attribute selectors', () => {
  it('matches on a prop being present at all', () => {
    assert.equal(hits('view[disabled]', node('view', { disabled: true })), true);
    assert.equal(hits('view[disabled]', node('view', {})), false);
  });

  it('treats a prop set to false or null as absent, as an unset attribute is on the web', () => {
    assert.equal(hits('view[disabled]', node('view', { disabled: false })), false);
    assert.equal(hits('view[disabled]', node('view', { disabled: null })), false);
  });

  it('matches an exact value, comparing as a string', () => {
    assert.equal(hits('view[role="tab"]', node('view', { role: 'tab' })), true);
    assert.equal(hits('view[role="tab"]', node('view', { role: 'panel' })), false);
    // Numbers and booleans stringify, so [tabIndex="0"] works on a numeric prop.
    assert.equal(hits('view[tabIndex="0"]', node('view', { tabIndex: 0 })), true);
  });

  it('supports the substring operators', () => {
    const n = node('view', { name: 'chevron-down' });
    assert.equal(hits('view[name^="chevron"]', n), true);
    assert.equal(hits('view[name$="down"]', n), true);
    assert.equal(hits('view[name*="ron-do"]', n), true);
    assert.equal(hits('view[name^="arrow"]', n), false);
  });

  it('matches |= on the whole value or its first hyphenated part, as a language tag is read', () => {
    assert.equal(hits('view[lang|="en"]', node('view', { lang: 'en' })), true);
    assert.equal(hits('view[lang|="en"]', node('view', { lang: 'en-GB' })), true);
    assert.equal(hits('view[lang|="en"]', node('view', { lang: 'english' })), false);
  });

  it('matches ~= on one whole word of a space-separated list, not on part of one', () => {
    assert.equal(hits('view[tags~="new"]', node('view', { tags: 'sale new' })), true);
    assert.equal(hits('view[tags~="new"]', node('view', { tags: 'renewed' })), false);
  });

  it('counts as a class for specificity', () => {
    assert.equal(ruleFor('view[disabled]').specificity, ruleFor('view.x').specificity);
  });

  it('honours the i flag, which compares the value without case', () => {
    // The flag was read and thrown away, so the test stayed case-sensitive and never matched.
    const n = node('view', { type: 'Submit' });
    assert.equal(hits('view[type="submit" i]', n), true);
    assert.equal(hits('view[type^="SUB" i]', n), true);
    assert.equal(hits('view[type="submit"]', n), false);
    assert.equal(hits('view[type="submit" s]', n), false);
  });
});

describe(':is, :where and :not', () => {
  it(':is matches when any argument matches', () => {
    assert.equal(hits('view:is(.a, .b)', node('view', {}, ['b'])), true);
    assert.equal(hits('view:is(.a, .b)', node('view', {}, ['c'])), false);
  });

  it(':not matches when no argument matches', () => {
    assert.equal(hits('view:not(.a, .b)', node('view', {}, ['c'])), true);
    assert.equal(hits('view:not(.a, .b)', node('view', {}, ['a'])), false);
  });

  it(':where matches like :is but contributes nothing to specificity', () => {
    assert.equal(hits('view:where(.a)', node('view', {}, ['a'])), true);
    assert.equal(ruleFor('view:where(.a)').specificity, ruleFor('view').specificity);
  });

  it(':is and :not take the specificity of their most specific argument', () => {
    assert.equal(ruleFor('view:is(.a, #b)').specificity, ruleFor('view#b').specificity);
    assert.equal(ruleFor('view:not(.a)').specificity, ruleFor('view.a').specificity);
  });

  it('nests, because the argument is a compound like any other', () => {
    assert.equal(hits('view:not(.a[disabled])', node('view', { disabled: true }, ['a'])), false);
    assert.equal(hits('view:not(.a[disabled])', node('view', {}, ['a'])), true);
  });

  it('refuses a combinator inside, which would need a second matching pass', () => {
    assert.throws(() => compileCss('view:is(.a .b) { color: red }'), /combinator/i);
  });
});

/**
 * `group-*`: a variant that styles a node from the state of something above it.
 *
 * Tailwind writes it as `:is(:where(.group) [data-x] *)` - a descendant combinator inside `:is()`,
 * which is refused in general and has to be, because a combinator there means a second matching
 * pass rooted at the node. This one shape is the exception: a compound followed by a descendant
 * `*` says "some ancestor matches", which is what `:host-context()` already means and what the
 * matcher already walks the tree to answer.
 *
 * Worth supporting rather than working around, because the whole `group-*` family compiles to it,
 * and shadcn reaches for it wherever a part is styled by the state of the thing containing it -
 * the switch thumb sized by the switch, a label dimmed by a disabled field.
 */
describe('an ancestor test inside :is()', () => {
  const nested = (parentClasses: string[], parentProps: Record<string, unknown> = {}) =>
    node('view', {}, ['thumb'], node('view', parentProps, parentClasses));

  it('matches when an ancestor matches the compound', () => {
    const selector = '.thumb:is(:where(.track)[data-size="lg"] *)';
    assert.equal(hits(selector, nested(['track'], { 'data-size': 'lg' })), true);
    assert.equal(hits(selector, nested(['track'], { 'data-size': 'sm' })), false);
    assert.equal(hits(selector, nested(['other'], { 'data-size': 'lg' })), false);
  });

  it('reaches any ancestor, not only the parent', () => {
    const deep = node('view', {}, ['thumb'], node('view', {}, [], node('view', {}, ['track'])));
    assert.equal(hits('.thumb:is(:where(.track) *)', deep), true);
  });

  it('does not match the node itself, which is what the descendant combinator means', () => {
    assert.equal(hits('.track:is(:where(.track) *)', node('view', {}, ['track'])), false);
  });

  it('still refuses a combinator that is not the ancestor shape', () => {
    assert.throws(
      () => compileCss('.a:is(.b > .c) { color: red }', 'other'),
      /combinator/,
      'a child combinator inside :is() is a second matching pass, and stays refused',
    );
  });
});

describe('alternatives inside :is() and :where(), some of them ancestor tests', () => {
  // `&:where(.dark, .dark *)` is the class-based dark mode Tailwind's own docs give: the element
  // is dark, or inside something that is. Compiled as one compound needing both, it matched only
  // an element that was dark and inside something dark, so `dark:` did nothing, and said nothing.
  const anyRule = (selector: string, target: StyleTarget) =>
    compileCss(`${selector} { color: red }`).rules.some((rule: StyleRule) => matches(target, rule));

  it('matches the element itself, or one inside it, as either alternative says', () => {
    const selector = '.x:where(.dark, .dark *)';
    assert.equal(anyRule(selector, node('view', {}, ['x', 'dark'])), true, 'the element is dark');
    assert.equal(
      anyRule(selector, node('view', {}, ['x'], node('view', {}, ['dark']))),
      true,
      'inside',
    );
    assert.equal(anyRule(selector, node('view', {}, ['x'])), false, 'neither');
  });

  it('matches inside either of two ancestors, not only inside both', () => {
    const selector = '.x:is(.a *, .b *)';
    assert.equal(anyRule(selector, node('view', {}, ['x'], node('view', {}, ['a']))), true);
    assert.equal(anyRule(selector, node('view', {}, ['x'], node('view', {}, ['b']))), true);
    assert.equal(anyRule(selector, node('view', {}, ['x'], node('view', {}, ['c']))), false);
  });

  it('keeps the specificity of the most specific alternative, as :is() has', () => {
    const [first, second] = compileCss('.x:is(#id *, .a) { color: red }').rules as StyleRule[];
    assert.equal(first!.specificity, ruleFor('.x#id').specificity);
    assert.equal(second!.specificity, first!.specificity);
  });
});

describe('html, the document element', () => {
  // Open Props defines every one of its tokens under `:where(html)`, and on native no element is
  // called `html`: the rule compiled, matched nothing, and said nothing. The document element is
  // what `:root` already means here, the node at the top of the tree, so `html` means that too.
  const root = node('view');
  const child = node('text', {}, [], root);

  it('matches the root, alone or inside :where()', () => {
    assert.equal(hits('html', root), true);
    assert.equal(hits(':where(html)', root), true);
    assert.equal(hits('html', child), false);
    assert.equal(hits('html .x', node('text', {}, ['x'], root)), true);
  });

  it('keeps the specificity of a type selector, not the class weight of :root', () => {
    assert.equal(ruleFor('html').specificity, ruleFor('view').specificity);
  });
});

describe('what a refused selector says', () => {
  /** The message the compiler refuses a selector with. */
  const refusal = (selector: string): string => {
    try {
      compileCss(`${selector} { color: red }`, 'test');
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error(`${selector} compiled`);
  };

  // Every pseudo-class the matcher had no answer for was refused as though it were :hover, with
  // "Native has no hover or focus cascade", which is nothing to do with :has() or :checked.
  it('says :has() asks about what is below a node, not about hover', () => {
    const message = refusal('view:has(.a)');
    assert.match(message, /':has\(\)' is not supported/);
    assert.match(message, /descendants/);
    assert.doesNotMatch(message, /hover/);
  });

  it('says :nth-child() of a selector is the form it cannot count, and which it can', () => {
    const message = refusal('view:nth-child(2 of .x)');
    assert.match(message, /':nth-child\(\)' with 'of <selector>'/);
    assert.match(message, /without 'of'/);
    assert.doesNotMatch(message, /hover/);
  });

  it('says :checked has no state to read, and how to style a checked control', () => {
    const message = refusal('switch:checked');
    assert.match(message, /':checked' has no state on native to read/);
    assert.match(message, /data-checked/);
    assert.doesNotMatch(message, /hover/);
  });

  it('keeps the hover and focus explanation for :hover and :focus-visible', () => {
    assert.match(refusal('view:hover'), /no hover or focus cascade/);
    assert.match(refusal('view:focus-visible'), /no hover or focus cascade/);
  });

  it('gives any other pseudo-class a message about state, not hover', () => {
    const message = refusal('view:target');
    assert.match(message, /':target' is not supported/);
    assert.doesNotMatch(message, /hover/);
  });
});

describe('an id', () => {
  it('matches the nativeID it names, and no other', () => {
    assert.equal(hits('view.card#main', node('view', { nativeID: 'main' }, ['card'])), true);
    assert.equal(hits('view.card#main', node('view', { nativeID: 'side' }, ['card'])), false);
  });
});

/**
 * A parent and its children, in order. `'#text'` is a run of text, which the position
 * selectors skip as the web skips a text node.
 */
function family(names: string[]): StyleTarget[] {
  const parent: StyleTarget & { children: StyleTarget[] } = { ...node('view'), children: [] };
  for (const name of names) {
    const child: StyleTarget = {
      ...node(name === '#text' ? '#text' : name, {}, [], parent),
      kind: name === '#text' ? 'text' : 'element',
      children: [],
    };
    parent.children.push(child);
  }
  return parent.children;
}

describe('position among siblings', () => {
  it('counts nth-child(An+B) from B onwards only, never before it', () => {
    const rows = family(['view', 'view', 'view', 'view']);
    assert.deepEqual(
      rows.map((row) => hits('view:nth-child(2n+3)', row)),
      [false, false, true, false],
    );
  });

  it('matches nth-child(B), with no step, on the Bth child alone', () => {
    const rows = family(['view', 'view', 'view', 'view']);
    assert.deepEqual(
      rows.map((row) => hits('view:nth-child(3)', row)),
      [false, false, true, false],
    );
  });

  it('counts nth-last-child from the end, with the last child as 1', () => {
    const rows = family(['view', 'view', 'view']);
    assert.deepEqual(
      rows.map((row) => hits('view:nth-last-child(1)', row)),
      [false, false, true],
    );
    assert.deepEqual(
      rows.map((row) => hits('view:nth-last-child(2)', row)),
      [false, true, false],
    );
  });

  it('skips runs of text when counting', () => {
    const [, second, , fourth] = family(['view', '#text', 'view', 'view']);
    assert.equal(hits('view:nth-child(2)', second!), false, 'text is not a child element');
    assert.equal(hits('view:nth-child(3)', fourth!), true);
  });

  it('matches :empty on an element with no children, and not on one with any', () => {
    const [bare] = family(['view']);
    assert.equal(hits('view:empty', bare!), true);
    const [full] = family(['view']);
    (full!.children as StyleTarget[]).push(node('text', {}, [], full!));
    assert.equal(hits('view:empty', full!), false);
  });
});

describe('the sibling combinators', () => {
  it('reads + as the element immediately before, not any before it', () => {
    const [, , label] = family(['view', 'image', 'text']);
    assert.equal(hits('view + text', label!), false);
    assert.equal(hits('image + text', label!), true);
    assert.equal(hits('view ~ text', label!), true);
  });

  it('looks past a run of text to the element before', () => {
    const [, , label] = family(['view', '#text', 'text']);
    assert.equal(hits('view + text', label!), true);
  });
});

describe('a nested rule', () => {
  it('names the line it was written on, when nesting moves it after its parent', () => {
    const dropped: string[] = [];
    compileCss('.a {\n  .b { color: red; }\n  .c { float: left; }\n  padding: 1px;\n}', 'nested', {
      onUnsupported: (message: string) => dropped.push(message),
    });
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /^nested:3: dropped 'float'/);
  });
});
