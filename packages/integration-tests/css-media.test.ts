/**
 * Media queries, and the invalidation that makes them live.
 *
 * These are the first rules whose applicability can change without any node changing, so they are
 * what forces a condition set into the resolver at all.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { StyleResolver, type Engine, type StyleTarget } from '@solidnative/fabric';
import { createRequire } from 'node:module';
import { mountSolid } from './css-solid-harness.ts';
import { responsive } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

let mounted: ReturnType<typeof mountSolid> | undefined;
afterEach(() => mounted?.root.dispose());

describe('media queries', () => {
  let engine: Engine;

  const boot = (conditions: Record<string, unknown>) => {
    mounted?.root.dispose();
    mounted = mountSolid(responsive(), { conditions: conditions as never });
    engine = mounted.engine;
  };
  const settle = () => mounted!.settle();

  // Hidden elements included: a rule that hides one is part of what these tests look at.
  const byId = (id: string) => mounted!.byId(id);

  it('applies a rule only when its query holds', () => {
    boot({ width: 320, height: 640 });
    assert.equal(byId('box').props['paddingTop'], 1);

    boot({ width: 800, height: 640 });
    assert.equal(byId('box').props['paddingTop'], 2);
  });

  it('shows a hidden element again at a breakpoint that asks for display: block', () => {
    // Bootstrap's .d-none .d-md-block. Refusing block left the element hidden at every width.
    boot({ width: 320, height: 640 });
    assert.equal(byId('toggle').props['display'], 'none');

    boot({ width: 800, height: 640 });
    assert.equal(byId('toggle').props['display'], 'flex');
  });

  it('reads the colour scheme', () => {
    boot({ width: 320, height: 640, colorScheme: 'light' });
    assert.equal(byId('label').props['color'], undefined);

    boot({ width: 320, height: 640, colorScheme: 'dark' });
    assert.equal(byId('label').props['color'], 'rgb(9, 9, 9)');
  });

  it('derives orientation from the viewport, and ands conditions together', () => {
    boot({ width: 800, height: 640 });
    assert.equal(byId('box').props['paddingBottom'], 3, 'wider than tall is landscape');

    boot({ width: 800, height: 1000 });
    assert.equal(byId('box').props['paddingBottom'], undefined);
  });

  it('reads the motion the user asked for, which is a preference like the others', () => {
    boot({ width: 320, height: 640, reducedMotion: true });
    assert.equal(byId('box').props['paddingRight'], 5);

    boot({ width: 320, height: 640, reducedMotion: false });
    assert.equal(byId('box').props['paddingRight'], undefined);

    boot({ width: 320, height: 640 });
    assert.equal(byId('box').props['paddingRight'], undefined, 'unstated is no preference');
  });

  it('treats a comma as or', () => {
    boot({ width: 90, height: 640 });
    assert.equal(byId('box').props['paddingLeft'], 4);

    boot({ width: 320, height: 950 });
    assert.equal(byId('box').props['paddingLeft'], 4);

    boot({ width: 320, height: 640 });
    assert.equal(byId('box').props['paddingLeft'], undefined);
  });

  it('re-resolves a token whose :root definition is guarded by a query', () => {
    // The combination the two features are actually used in: a theme defined as tokens on :root,
    // with a media query redefining them. Nothing about any node changes when the theme flips.
    const global = compileCss(
      ':root { --surface: rgb(1, 1, 1) }' +
        '@media (prefers-color-scheme: light) { :root { --surface: rgb(2, 2, 2) } }' +
        'view { background-color: var(--surface) }',
      'global',
    );
    mounted = mountSolid(responsive(), {
      globalStyles: global,
      conditions: { width: 320, height: 640, colorScheme: 'dark' },
    });
    engine = mounted.engine;
    assert.equal(byId('box').props['backgroundColor'], 'rgb(1, 1, 1)');

    engine.updateConditions({ width: 320, height: 640, colorScheme: 'light' });
    settle();
    assert.equal(byId('box').props['backgroundColor'], 'rgb(2, 2, 2)');
  });

  it('re-resolves live when the conditions change, with nothing else moving', () => {
    // A rotation changes no node and no binding, so nothing is dirty. Only the condition set
    // moved, and every rule guarded by a query has to be reconsidered.
    boot({ width: 320, height: 640, colorScheme: 'light' });
    assert.equal(byId('box').props['paddingTop'], 1);

    engine.updateConditions({ width: 800, height: 640, colorScheme: 'dark' });
    settle();

    assert.equal(byId('box').props['paddingTop'], 2);
    assert.equal(byId('label').props['color'], 'rgb(9, 9, 9)');
  });
});

describe('a media query with one rule it cannot compile', () => {
  // Only that rule is dropped. It used to be the whole block: the error escaped the loop over the
  // query's rules and took every sibling with it, so one `::before` inside Bootstrap's
  // `@media (min-width: 768px)` removed every other rule at that breakpoint, reported as one drop.
  it('keeps the rules around it, each under the condition', () => {
    const dropped: string[] = [];
    const { rules } = compileCss(
      '@media (min-width: 100px) { .a { color: red } .b::before { color: red } .c { color: blue } }',
      'media',
      { onUnsupported: (message: string) => dropped.push(message) },
    );
    assert.deepEqual(
      rules.map((rule: { compounds: { classes: string[] }[] }) => rule.compounds[0]!.classes[0]),
      ['a', 'c'],
    );
    assert.ok(rules.every((rule: { condition?: unknown }) => rule.condition));
    assert.equal(dropped.length, 1);
    assert.match(dropped[0]!, /pseudo-element/);
  });

  it('throws when there is nowhere to report the rule', () => {
    assert.throws(
      () => compileCss('@media (min-width: 100px) { .a { color: red } .b::before { color: red } }'),
      /pseudo-element/,
    );
  });
});

describe('the ways a media query can be written', () => {
  // Any sheet with a nested block, which is any sheet with a media query in it, was lowered for an
  // old browser before it was read. That rewrote the range syntax into 'not' queries this compiler
  // refuses, so '(width < 40rem)', which is how Tailwind writes its max-* variants, was a build
  // error. And a query in em compared the width with the marker em compiles to, so never held.
  const holdsAt = (query: string, width: number, height = 800) => {
    const sheet = compileCss(`.a { color: red } @media ${query} { .a { color: blue } }`, 'media');
    const resolver = new StyleResolver(sheet, { width, height, colorScheme: 'light' });
    const target: StyleTarget = {
      name: 'view',
      parent: null,
      classes: new Set(['a']),
      props: {},
      sheet: null,
      hostSheet: null,
      styleCache: null,
      styleDirty: true,
    };
    return resolver.resolve(target, 1).style['color'] === 'rgb(0, 0, 255)';
  };

  it('holds an or when either side does, and not when neither does', () => {
    const query = '(width < 400px) or (height < 300px)';
    assert.deepEqual(
      [holdsAt(query, 500, 200), holdsAt(query, 300, 800), holdsAt(query, 500, 800)],
      [true, true, false],
    );
  });

  it('calls a square screen portrait, as the web does', () => {
    assert.equal(holdsAt('(orientation: portrait)', 500, 500), true);
    assert.equal(holdsAt('(orientation: landscape)', 500, 500), false);
    assert.equal(holdsAt('(orientation: landscape)', 501, 500), true);
  });

  it('reads the range syntax, both ways round', () => {
    assert.deepEqual(
      [holdsAt('(width < 500px)', 400), holdsAt('(width < 500px)', 500)],
      [true, false],
    );
    assert.deepEqual(
      [holdsAt('(width > 300px)', 301), holdsAt('(width > 300px)', 300)],
      [true, false],
    );
    assert.deepEqual(
      [holdsAt('(500px > width)', 400), holdsAt('(width <= 400px)', 400)],
      [true, true],
    );
    assert.equal(holdsAt('(height > 700px)', 400), true);
  });

  it('reads a range with both ends', () => {
    const query = '(300px < width <= 400px)';
    assert.deepEqual(
      [300, 301, 400, 401].map((width) => holdsAt(query, width)),
      [false, true, true, false],
    );
    assert.deepEqual(
      [299, 300, 499, 500].map((width) => holdsAt('(500px > width >= 300px)', width)),
      [false, true, true, false],
    );
  });

  it('reads an exact width', () => {
    assert.deepEqual(
      [holdsAt('(width: 400px)', 400), holdsAt('(width = 400px)', 399)],
      [true, false],
    );
  });

  it('reads em and rem as the initial font size, as a browser does in a query', () => {
    assert.deepEqual(
      [holdsAt('(min-width: 20em)', 320), holdsAt('(min-width: 20em)', 319)],
      [true, false],
    );
    assert.equal(holdsAt('(width < 40rem)', 639), true);
  });
});
