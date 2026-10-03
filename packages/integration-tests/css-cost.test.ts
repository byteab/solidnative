/**
 * What the CSS engine costs, and the baseline the planned rework has to beat.
 *
 * Assertions are on **work counts**, never on milliseconds. A compound comparison is deterministic
 * and a stopwatch is not, so a count catches the regression that matters (the walk went quadratic,
 * the cache stopped hitting) without being flaky on a loaded machine. Timings are printed for a
 * human to read, and asserted on only with a ceiling loose enough to mean something is badly wrong.
 *
 * Recorded against push-down resolution. The numbers it replaced, when
 * resolution walked up from every node calling `cascade` once per ancestor, were 175,050 rule
 * tests and 89 compound tests per node.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine, StyleResolver, type StyleSheet, type StyleTarget } from '@solidnative/fabric';
import { createFakeFabric } from '@solidnative/testing';
import { resetStyleStats, styleStats } from '../fabric/src/css.ts';
import { createRequire } from 'node:module';
import { mountSolid } from './css-solid-harness.ts';
import { scaleList } from './css-solid-fixtures.tsx';

const { compileCss } = createRequire(import.meta.url)('@solidnative/metro/css/compile.cjs');

const ROWS = 1000;

const makeRows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: i, label: `row ${i}` }));

function mountRows(styled: boolean, rows: number) {
  const fixture = scaleList(styled);
  const mounted = mountSolid(fixture.View);

  resetStyleStats();
  const started = performance.now();
  fixture.setRows(makeRows(rows));
  mounted.settle();
  const elapsed = performance.now() - started;
  mounted.root.dispose();

  return { elapsed, stats: { ...styleStats } };
}

describe('what CSS costs', () => {
  it('costs nothing at all when a component has no stylesheet', () => {
    const { stats } = mountRows(false, ROWS);
    // The resolver returns on `!sheet` before doing anything, so an app that writes no CSS pays
    // literally zero. This is also why every scale and device number recorded before this test
    // says nothing about CSS: they were all measured on this path.
    assert.deepEqual(stats, { compoundTests: 0, ruleTests: 0, nodesResolved: 0 });
  });

  it('prices a 1000 row mount with and without a stylesheet', () => {
    const plain = mountRows(false, ROWS);
    const styled = mountRows(true, ROWS);

    console.log(
      `      ${ROWS} rows: ${plain.elapsed.toFixed(0)}ms plain, ${styled.elapsed.toFixed(0)}ms styled ` +
        `(${(styled.elapsed / plain.elapsed).toFixed(1)}x)`,
    );
    console.log(
      `      ${styled.stats.nodesResolved} nodes resolved, ${styled.stats.ruleTests} rule tests, ` +
        `${styled.stats.compoundTests} compound tests ` +
        `(${(styled.stats.compoundTests / styled.stats.nodesResolved).toFixed(1)} per node)`,
    );

    // Two per row, the pressable and its text. Raw text nodes carry no sheet, and the static
    // subtree was resolved on the first commit and is reused: nothing about it changed, so the
    // resolver hands back the same object rather than recomputing an equal one.
    assert.equal(styled.stats.nodesResolved, 2000);
    // Not nodes x rules any more: rules are filed by key selector, so a node is only offered the
    // buckets its own name, id and classes can reach, plus the ones nothing can be keyed on. The
    // fixture's twenty-five rules become one or two tries per node instead of twenty-five, which
    // is what makes a utility sheet of hundreds affordable. Each node is still cascaded once per
    // commit however many descendants ask it for inherited values.
    assert.equal(styled.stats.ruleTests, 3000, 'was 50,000 before the rules were indexed');
    assert.equal(styled.stats.compoundTests, 6000, 'was 53,000');
  });

  it('re-resolves nothing when a commit changes one row out of a thousand', () => {
    const fixture = scaleList(true);
    const mounted = mountSolid(fixture.View);
    fixture.setRows(makeRows(ROWS));
    mounted.settle();

    // Edit one label. Nothing else about the tree moved, so every other node must be handed back
    // its previous result rather than cascaded again: that is what makes the cache worth having,
    // and it is the property that breaks first if invalidation is ever widened carelessly.
    const rows = makeRows(ROWS);
    rows[500] = { id: 500, label: 'edited' };
    resetStyleStats();
    fixture.setRows(rows);
    mounted.settle();
    mounted.root.dispose();

    console.log(
      `      one row of ${ROWS} edited: ${styleStats.nodesResolved} nodes re-resolved, ` +
        `${styleStats.compoundTests} compound tests`,
    );
    assert.equal(styleStats.nodesResolved, 0, 'nothing needed cascading again');
    assert.equal(styleStats.compoundTests, 0);
  });

  it('costs the same per node however deep the tree is', () => {
    // The property push-down resolution exists to give us. Same sheet, same leaf, only the
    // nesting differs, so if resolution ever goes back to walking ancestors this diverges.
    const sheet: StyleSheet = {
      rules: Array.from({ length: 30 }, (_, i) => ({
        compounds: [{ classes: [`c${i}`] }],
        combinators: [],
        specificity: 1000,
        order: i,
        declarations: { color: `#${i}` },
      })),
    };

    const leafAtDepth = (depth: number): StyleTarget => {
      let node: StyleTarget | null = null;
      for (let i = 0; i < depth; i++) {
        node = {
          name: 'view',
          parent: node,
          classes: new Set([`c${i % 30}`]),
          props: {},
          sheet,
          hostSheet: null,
          styleCache: null,
          styleDirty: true,
        };
      }
      return node!;
    };

    const resolver = new StyleResolver(null, { width: 0, height: 0, colorScheme: 'light' });
    const costAt = (depth: number, epoch: number): number => {
      resetStyleStats();
      // Resolve every node on the chain, which is what a commit does.
      const chain: StyleTarget[] = [];
      for (let n: StyleTarget | null = leafAtDepth(depth); n; n = n.parent) chain.push(n);
      for (const node of chain.reverse()) resolver.resolve(node, epoch);
      return styleStats.compoundTests / chain.length;
    };

    const shallow = costAt(3, 1);
    const deep = costAt(30, 2);
    console.log(
      `      ${shallow.toFixed(1)} compound tests per node at depth 3, ${deep.toFixed(1)} at depth 30`,
    );
    assert.ok(
      Math.abs(deep - shallow) < 1,
      `per-node cost must not track depth, got ${shallow.toFixed(1)} vs ${deep.toFixed(1)}`,
    );
  });

  it('shares one answer among new unstyled nodes, but not over a child that resolved elsewhere', () => {
    type Mutable = StyleTarget & { parent: StyleTarget | null; children: StyleTarget[] };
    const target = (classes: string[], sheet: StyleSheet | null = null): Mutable => ({
      name: 'view',
      parent: null,
      children: [],
      classes: new Set(classes),
      props: {},
      sheet,
      hostSheet: null,
      styleCache: null,
      styleDirty: true,
    });
    const resolver = new StyleResolver(null, { width: 0, height: 0, colorScheme: 'light' });
    const a = target([]);
    const b = target([]);
    assert.equal(resolver.resolve(a, 1), resolver.resolve(b, 1), 'no answer of their own');
    assert.equal(a.styleDirty, false);

    // `.x .label` cannot match until the label sits under an `.x`, which it moves into.
    const label = target(['label'], compileCss('.x .label { color: red }') as StyleSheet);
    const first = target([]);
    label.parent = first;
    first.children.push(label);
    resolver.resolve(first, 2);
    assert.equal(resolver.resolve(label, 2).style['color'], undefined);
    const wrap = target(['x']);
    label.parent = wrap;
    first.children.length = 0;
    wrap.children.push(label);
    assert.notEqual(resolver.resolve(wrap, 3), resolver.resolve(a, 3), 'a context of its own');
    assert.ok(resolver.resolve(label, 3).style['color'], 'so the moved label resolves again');
  });
});

describe('a list change under a structural sheet', () => {
  // A Tailwind sheet's `space-x-*` makes every sheet structural. Removing one row re-matched every
  // row of the list before: the list re-resolved, minted a new context, and each row followed.
  it('re-resolves only the list when a row no position rule reaches is removed', () => {
    const css = '.space > :not(:last-child) { margin-right: 4px } .row { opacity: 0.5 }';
    const engine = new Engine(createFakeFabric(), 1, { globalStyles: compileCss(css, 'test') });
    const list = engine.createElement('view');
    engine.appendChild(engine.root, list);
    for (let i = 0; i < 50; i++) {
      const row = engine.createElement('view');
      engine.setClasses(row, 'row');
      engine.appendChild(list, row);
    }
    engine.commit();

    resetStyleStats();
    engine.removeChild(list, list.children[10]!);
    engine.commit();
    assert.ok(styleStats.nodesResolved <= 2, `${styleStats.nodesResolved} nodes re-resolved`);
  });
});
