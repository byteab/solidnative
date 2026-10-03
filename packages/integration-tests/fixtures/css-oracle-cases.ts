/**
 * Cases for the browser differential suite, shared by the generator and the test so both build
 * exactly the same tree.
 *
 * Colours are the probe. `getComputedStyle` returns them as `rgb(r, g, b)`, which is the very
 * format our own compiler emits, so a comparison is about *which declaration won* rather than
 * about how a value was converted. Every rule uses a distinct sentinel colour, so the winner is
 * identifiable on sight.
 *
 * Element names are `view` and `text`. A browser treats an unknown element as an ordinary inline
 * box and still matches type selectors against it, so the same markup serves both sides.
 */

export interface CaseNode {
  name: string;
  id?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  children?: CaseNode[];
}

export interface OracleCase {
  name: string;
  css: string;
  tree: CaseNode;
}

export const PROPERTIES = ['color', 'background-color'] as const;

/** What a browser reports when no rule set the property. Ours reports nothing at all. */
export const INITIAL: Record<string, string> = {
  color: 'rgb(0, 0, 0)',
  'background-color': 'rgba(0, 0, 0, 0)',
};

const probe = (extra: Partial<CaseNode> = {}): CaseNode => ({
  name: 'text',
  id: 'probe',
  ...extra,
});

export const CASES: OracleCase[] = [
  {
    name: 'specificity: a class beats a type',
    css: 'text { color: rgb(1, 0, 0) } .c { color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['c'] }),
  },
  {
    name: 'specificity: an id beats two classes',
    css: '.a.b { color: rgb(1, 0, 0) } #probe { color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['a', 'b'] }),
  },
  {
    name: 'specificity: two classes beat one',
    css: '.a { color: rgb(1, 0, 0) } .a.b { color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['a', 'b'] }),
  },
  {
    name: 'source order decides at equal specificity',
    css: '.a { color: rgb(1, 0, 0) } .b { color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['a', 'b'] }),
  },
  {
    name: 'source order is by rule, not by which class is listed first',
    css: '.b { color: rgb(2, 0, 0) } .a { color: rgb(1, 0, 0) }',
    tree: probe({ classes: ['a', 'b'] }),
  },
  {
    name: 'important beats a later, more specific rule',
    css: '.a { color: rgb(1, 0, 0) !important } #probe.a { color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['a'] }),
  },
  {
    name: 'an attribute selector weighs the same as a class',
    css: '[data-k] { color: rgb(1, 0, 0) } .c { color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['c'], attrs: { 'data-k': 'v' } }),
  },
  {
    name: 'attribute equality',
    css: '[data-k="yes"] { color: rgb(1, 0, 0) }',
    tree: probe({ attrs: { 'data-k': 'yes' } }),
  },
  {
    name: 'attribute prefix, suffix and substring',
    css: '[data-k^="ab"] { color: rgb(1, 0, 0) } [data-k$="cd"] { background-color: rgb(2, 0, 0) }',
    tree: probe({ attrs: { 'data-k': 'abxcd' } }),
  },
  {
    name: 'attribute word match with a tilde',
    css: '[data-k~="two"] { color: rgb(1, 0, 0) }',
    tree: probe({ attrs: { 'data-k': 'one two three' } }),
  },
  {
    name: 'attribute dash match',
    css: '[data-k|="en"] { color: rgb(1, 0, 0) }',
    tree: probe({ attrs: { 'data-k': 'en-GB' } }),
  },
  {
    name: 'where contributes no specificity',
    css: 'text:where(.a) { color: rgb(1, 0, 0) } text { color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['a'] }),
  },
  {
    name: 'is takes its most specific argument',
    css: ':is(.a, #probe) { color: rgb(1, 0, 0) } .x.y { color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['a', 'x', 'y'] }),
  },
  {
    name: 'not takes its argument specificity and excludes',
    css: '.a:not(.b) { color: rgb(1, 0, 0) } .a { background-color: rgb(2, 0, 0) }',
    tree: probe({ classes: ['a'] }),
  },
  {
    name: 'not with several arguments excludes if any matches',
    css: '.a:not(.b, .c) { color: rgb(1, 0, 0) }',
    tree: probe({ classes: ['a', 'c'] }),
  },
  {
    name: 'inheritance: the nearest ancestor wins',
    css: '.outer { color: rgb(1, 0, 0) } .inner { color: rgb(2, 0, 0) }',
    tree: {
      name: 'view',
      classes: ['outer'],
      children: [{ name: 'view', classes: ['inner'], children: [probe()] }],
    },
  },
  {
    name: 'inheritance: a value of its own beats anything inherited',
    css: '.outer { color: rgb(1, 0, 0) } #probe { color: rgb(2, 0, 0) }',
    tree: { name: 'view', classes: ['outer'], children: [probe()] },
  },
  {
    name: 'background-color does not inherit',
    css: '.outer { background-color: rgb(1, 0, 0) }',
    tree: { name: 'view', classes: ['outer'], children: [probe()] },
  },
  {
    name: 'descendant matches any depth, child only one',
    css: '.outer .deep { color: rgb(1, 0, 0) } .outer > .deep { background-color: rgb(2, 0, 0) }',
    tree: {
      name: 'view',
      classes: ['outer'],
      children: [{ name: 'view', children: [probe({ classes: ['deep'] })] }],
    },
  },
  {
    // The matcher walks right to left and takes the first ancestor that fits. Here the nearest
    // `.b` fails the child combinator while a further one satisfies it, so a matcher that cannot
    // reconsider its choice misses the rule entirely.
    name: 'a combinator that only matches on a further ancestor',
    css: '.a > .b .c { color: rgb(1, 0, 0) }',
    tree: {
      name: 'view',
      classes: ['a'],
      children: [
        {
          name: 'view',
          classes: ['b'],
          children: [
            {
              name: 'view',
              children: [{ name: 'view', classes: ['b'], children: [probe({ classes: ['c'] })] }],
            },
          ],
        },
      ],
    },
  },
  {
    name: 'a custom property resolves to the nearest definition',
    css: '.outer { --c: rgb(1, 0, 0) } .inner { --c: rgb(2, 0, 0) } #probe { color: var(--c) }',
    tree: {
      name: 'view',
      classes: ['outer'],
      children: [{ name: 'view', classes: ['inner'], children: [probe()] }],
    },
  },
  {
    name: 'a custom property crosses elements that define nothing',
    css: '.outer { --c: rgb(1, 0, 0) } #probe { color: var(--c) }',
    tree: {
      name: 'view',
      classes: ['outer'],
      children: [{ name: 'view', children: [{ name: 'view', children: [probe()] }] }],
    },
  },
  {
    name: 'a custom property falls back when undefined',
    css: '#probe { color: var(--missing, rgb(1, 0, 0)) }',
    tree: probe(),
  },
  {
    name: 'a defined custom property beats the fallback',
    css: '.outer { --c: rgb(1, 0, 0) } #probe { color: var(--c, rgb(2, 0, 0)) }',
    tree: { name: 'view', classes: ['outer'], children: [probe()] },
  },
  {
    // lightningcss keeps alpha in eight bits, so `.5` arrives as 128/255. A browser prints the
    // shortest decimal that comes back to the same eight bits, and so has to we.
    name: 'a translucent colour reads back as the browser prints it',
    css: '#probe { color: rgba(1, 0, 0, .5); background-color: rgb(2 0 0 / 30%) }',
    tree: probe(),
  },
  {
    name: 'a custom property is itself subject to the cascade',
    css: '.a { --c: rgb(1, 0, 0) } .a.b { --c: rgb(2, 0, 0) } #probe { color: var(--c) }',
    tree: probe({ classes: ['a', 'b'] }),
  },
];
