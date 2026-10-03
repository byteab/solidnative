/**
 * Selectors that ask about a node's place among its siblings.
 *
 * These are the ones a list is written with: a separator on every row but the last, a rounded
 * corner on the first, alternating rows. Nothing about native prevents them - the engine has the
 * whole tree - they had simply never been built.
 *
 * The cost is not in matching them but in knowing when a match has *stopped* being true: adding a
 * row changes what its new neighbours match, and nothing about those neighbours changed. So a
 * sheet that uses one of these says so, and the engine invalidates a parent's children when its
 * child list moves - only then.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine } from '@solid-native/fabric';
import { createFakeFabric, type FakeFabric, type FakeFabricNode } from '@solid-native/testing';
import { mountSolid } from './css-solid-harness.ts';
import { structuralHost } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

describe('compiling a structural selector', () => {
  const compoundOf = (selector: string) =>
    compileCss(`${selector} { color: red }`, 'test').rules[0].compounds.at(-1);

  it('reads the four position pseudo-classes as the counts they stand for', () => {
    assert.deepEqual(compoundOf('view:first-child').nth, [{ a: 0, b: 1 }]);
    assert.deepEqual(compoundOf('view:last-child').nth, [{ a: 0, b: 1, fromEnd: true }]);
    assert.deepEqual(compoundOf('view:nth-child(2n + 1)').nth, [{ a: 2, b: 1 }]);
    assert.deepEqual(compoundOf('view:nth-last-child(3)').nth, [{ a: 0, b: 3, fromEnd: true }]);
  });

  it('reads only-child as the two tests it is', () => {
    assert.deepEqual(compoundOf('view:only-child').nth, [
      { a: 0, b: 1 },
      { a: 0, b: 1, fromEnd: true },
    ]);
  });

  it('reads empty, which asks about a node rather than its siblings', () => {
    assert.equal(compoundOf('view:empty').empty, true);
  });

  it('marks the sheet, so the engine only pays for invalidation where it is used', () => {
    assert.equal(compileCss('view:first-child { color: red }', 'test').structural, true);
    assert.equal(compileCss('view + view { color: red }', 'test').structural, true);
    assert.equal(compileCss('view .a { color: red }', 'test').structural, undefined);
  });

  it('takes the two sibling combinators', () => {
    const { combinators } = compileCss('view + text { color: red }', 'test').rules[0];
    assert.deepEqual(combinators, ['next-sibling']);
    assert.deepEqual(compileCss('view ~ text { color: red }', 'test').rules[0].combinators, [
      'later-sibling',
    ]);
  });
});

describe('a sibling test inside :is(), the shape Tailwind writes peer-* as', () => {
  // `peer-focus:x` is `.x:is(:where(.peer):focus ~ *)`: an element with an earlier sibling that
  // matches. The compiler refused any combinator inside `:is()` but the ancestor form, so every
  // peer-* class was dropped with "':is()' cannot contain a combinator".
  it('reads it as the later-sibling selector it means', () => {
    const rule = compileCss('.x:is(:where(.peer):focus ~ *) { color: red }', 'test').rules[0];
    assert.deepEqual(rule.combinators, ['later-sibling']);
    assert.deepEqual(rule.compounds[0], {
      classes: [],
      is: [[{ classes: ['peer'] }]],
      pseudo: ['focus'],
    });
    assert.deepEqual(rule.compounds[1].classes, ['x']);
    assert.equal(rule.compounds[1].is, undefined, 'nothing is left of the :is()');
  });

  it('takes a list of compounds before the combinator, as peer-focus: writes', () => {
    const rule = compileCss(
      '.x:is(:is(:where(.peer):focus, :where(.peer)[data-focus]) ~ *) { color: red }',
      'test',
    ).rules[0];
    assert.deepEqual(rule.combinators, ['later-sibling']);
    assert.equal(rule.compounds[0].is.length, 1);
    assert.equal(rule.compounds[0].is[0].length, 2, 'either compound');
  });

  it('keeps what came before it, whose relation to the sibling is the same', () => {
    // `.list > .x:is(.peer ~ *)`: the peer is a child of `.list` exactly when `.x` is.
    const rule = compileCss('.list > .x:is(.peer ~ *) { color: red }', 'test').rules[0];
    assert.deepEqual(rule.combinators, ['child', 'later-sibling']);
    assert.deepEqual(
      rule.compounds.map((c: { classes: string[] }) => c.classes),
      [['list'], ['peer'], ['x']],
    );
  });

  it('has the specificity :is() gives it: the sibling compound, plus the element', () => {
    assert.equal(
      compileCss('.x:is(.peer:focus ~ *) { color: red }', 'test').rules[0].specificity,
      compileCss('.peer:focus ~ .x { color: red }', 'test').rules[0].specificity,
    );
    assert.equal(
      compileCss('.x:where(.peer ~ *) { color: red }', 'test').rules[0].specificity,
      compileCss('.x { color: red }', 'test').rules[0].specificity,
    );
  });

  it('marks the sheet as asking about siblings', () => {
    assert.equal(compileCss('.x:is(.peer ~ *) { color: red }', 'test').structural, true);
  });

  it('still refuses a sibling test after a sibling combinator, which would reorder the two', () => {
    assert.throws(() => compileCss('.a ~ .x:is(.peer ~ *) { color: red }', 'test'), /combinator/);
  });
});

describe("a sibling's state and classes", () => {
  // A later sibling's style depends on its peer, and only the peer changes: focus moves to it, a
  // class arrives on it. Only the peer and its subtree were restyled, so the sibling kept what it
  // had matched before.
  const build = (css: string) => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: compileCss(css, 'test') });
    const list = engine.createElement('view');
    const peer = engine.createElement('view');
    const between = engine.createElement('view');
    const label = engine.createElement('text');
    engine.setClasses(peer, 'peer');
    engine.setClasses(label, 'label');
    engine.appendChild(engine.root, list);
    for (const child of [peer, between, label]) engine.appendChild(list, child);
    engine.commit();
    return { engine, fabric, peer, label };
  };

  /** The props the last commit gave a node. */
  const lastProps = (fabric: FakeFabric, node: unknown): Record<string, unknown> => {
    const all = (n: FakeFabricNode): FakeFabricNode[] => [n, ...n.children.flatMap(all)];
    const found = fabric.committed.flatMap(all).find((n) => n.instanceHandle === node);
    assert.ok(found, 'committed');
    return found.props;
  };

  it('restyles a later sibling when focus reaches its peer, and again when it leaves', () => {
    const { engine, peer, label, fabric } = build('.peer:focus ~ .label { opacity: 0.5 }');
    const labelProps = () => lastProps(fabric, label);
    assert.equal(labelProps()['opacity'], undefined);

    engine.dispatchEvent(peer, 'topFocus', {});
    assert.equal(labelProps()['opacity'], 0.5, 'focused');

    engine.dispatchEvent(peer, 'topBlur', {});
    assert.equal(labelProps()['opacity'], null, 'blurred');
  });

  it('restyles a later sibling when its peer gains a class', () => {
    const { engine, peer, label, fabric } = build('.peer.on + * + .label { opacity: 0.5 }');
    engine.setClasses(peer, 'peer on');
    engine.commit();
    assert.equal(lastProps(fabric, label)['opacity'], 0.5);
  });
});

describe('matching one', () => {
  let mounted: ReturnType<typeof mountSolid> | undefined;
  let host: ReturnType<typeof structuralHost>;

  const boot = () => {
    host = structuralHost();
    mounted = mountSolid(host.View);
  };
  const settle = () => mounted!.settle();

  afterEach(() => mounted?.root.dispose());

  const rows = () => mounted!.nodes().filter((n) => /^row/.test(String(n.props['nativeID'] ?? '')));

  it('picks the first and the last of a list', () => {
    boot();
    const all = rows();
    assert.equal(all.length, 3);
    assert.equal(all[0]!.props['borderTopWidth'], 2, 'the first row');
    assert.equal(all[1]!.props['borderTopWidth'], undefined);
    assert.equal(all[2]!.props['borderBottomWidth'], 4, 'the last row');
  });

  it('counts with nth-child, which is how a list stripes itself', () => {
    boot();
    const all = rows();
    assert.equal(all[0]!.props['backgroundColor'], 'rgb(238, 238, 238)');
    assert.equal(all[1]!.props['backgroundColor'], undefined);
    assert.equal(all[2]!.props['backgroundColor'], 'rgb(238, 238, 238)');
  });

  it('separates with the adjacent sibling combinator', () => {
    // `.row + .row` is the separator idiom: a line between rows and not above the first.
    boot();
    const all = rows();
    assert.equal(all[0]!.props['marginTop'], undefined);
    assert.equal(all[1]!.props['marginTop'], 8);
    assert.equal(all[2]!.props['marginTop'], 8);
  });

  it('re-matches the neighbours when a row is added, though nothing about them changed', () => {
    // The whole difficulty of these selectors. The old last row is no longer the last, and
    // nothing in it moved: only its parent's child list did.
    boot();
    host.setCount(4);
    settle();

    const all = rows();
    assert.equal(all.length, 4);
    // Null rather than absent: the prop has to be cleared on the native node it was set on.
    assert.equal(all[2]!.props['borderBottomWidth'], null, 'no longer the last');
    assert.equal(all[3]!.props['borderBottomWidth'], 4, 'and the new row is');
  });

  it('re-matches when a row is removed', () => {
    boot();
    host.setCount(2);
    settle();

    const all = rows();
    assert.equal(all.length, 2);
    assert.equal(all[1]!.props['borderBottomWidth'], 4);
  });
});

describe('a position test that is not at the top of its compound', () => {
  // `.row:not(:last-child)` is the separator idiom written the other way round, and `:empty` asks
  // about a child list too. The engine only restyles on a child-list change for a sheet marked as
  // asking about position, so these need the mark as much as `:last-child` does.
  const lastProps = (fabric: FakeFabric, node: unknown): Record<string, unknown> => {
    const all = (n: FakeFabricNode): FakeFabricNode[] => [n, ...n.children.flatMap(all)];
    const found = fabric.committed.flatMap(all).find((n) => n.instanceHandle === node);
    assert.ok(found, 'committed');
    return found.props;
  };

  it('marks the sheet when the test is inside :not() or :is(), or is :empty', () => {
    assert.equal(compileCss('.a:not(:last-child) { color: red }', 'test').structural, true);
    assert.equal(compileCss('.a:is(:first-child, .b) { color: red }', 'test').structural, true);
    assert.equal(compileCss('.a:empty { color: red }', 'test').structural, true);
  });

  it('restyles the old last row when a row is added after it', () => {
    const fabric = createFakeFabric();
    const css = '.row:not(:last-child) { border-bottom-width: 1px }';
    const engine = new Engine(fabric, 1, { globalStyles: compileCss(css, 'test') });
    const list = engine.createElement('view');
    const first = engine.createElement('view');
    engine.setClasses(first, 'row');
    engine.appendChild(engine.root, list);
    engine.appendChild(list, first);
    engine.commit();
    assert.equal(lastProps(fabric, first)['borderBottomWidth'], undefined);

    const second = engine.createElement('view');
    engine.setClasses(second, 'row');
    engine.appendChild(list, second);
    engine.commit();
    assert.equal(lastProps(fabric, first)['borderBottomWidth'], 1, 'no longer the last');
  });

  it('restyles an :empty node when a child arrives', () => {
    const fabric = createFakeFabric();
    const css = '.list:empty { opacity: 0.5 }';
    const engine = new Engine(fabric, 1, { globalStyles: compileCss(css, 'test') });
    const list = engine.createElement('view');
    engine.setClasses(list, 'list');
    engine.appendChild(engine.root, list);
    engine.commit();
    assert.equal(lastProps(fabric, list)['opacity'], 0.5);

    engine.appendChild(list, engine.createElement('view'));
    engine.commit();
    assert.equal(lastProps(fabric, list)['opacity'], null, 'no longer empty');
  });

  it('counts a node holding only the anchor of an empty @for or @if as :empty', () => {
    // The anchor is a comment on the web, and :empty ignores comments. A list whose @for has no
    // rows holds nothing else.
    const fabric = createFakeFabric();
    const css = '.list:empty { opacity: 0.5 }';
    const engine = new Engine(fabric, 1, { globalStyles: compileCss(css, 'test') });
    const list = engine.createElement('view');
    engine.setClasses(list, 'list');
    engine.appendChild(engine.root, list);
    engine.appendChild(list, engine.createAnchor());
    engine.commit();
    assert.equal(lastProps(fabric, list)['opacity'], 0.5);
  });
});
