/**
 * The CSS system: build-time compilation, selector matching, cascade and inheritance.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { mountSolid } from './css-solid-harness.ts';
import { styled } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

describe('CSS compilation', () => {
  it('expands shorthands and converts units at build time', () => {
    const { rules } = compileCss('.a { padding: 12px 8px; margin-left: 2rem; width: 50% }');
    assert.deepEqual(rules[0].declarations, {
      paddingTop: 12,
      paddingRight: 8,
      paddingBottom: 12,
      paddingLeft: 8,
      marginLeft: 32,
      width: '50%',
    });
  });

  it('sorts rules by specificity then source order, so the device only merges', () => {
    const { rules } = compileCss('.a { color: red } #b { color: red } view { color: red }');
    assert.deepEqual(
      rules.map((r: { specificity: number }) => r.specificity),
      [1, 1000, 1_000_000],
    );
  });

  it('rejects what native cannot express, naming it', () => {
    // A style that silently does nothing is the failure mode this project keeps hitting.
    assert.throws(() => compileCss('.a { float: left }'), /float.*no React Native equivalent/s);
    assert.throws(() => compileCss('.a { display: grid }'), /display: grid does not exist/);
    assert.throws(() => compileCss('.a { width: 3ex }'), /unit 'ex'/);
    assert.throws(() => compileCss('.a:hover { color: red }'), /':hover' is not supported/);
    assert.throws(() => compileCss('@supports (a: b) { .a { color: red } }'), /@supports/);
    assert.throws(
      () => compileCss('@media print { .a { color: red } }'),
      /media type has no meaning/,
    );
    assert.throws(
      () => compileCss('@media (hover: hover) { .a { color: red } }'),
      /not a media feature/,
    );
  });
});

describe('CSS at runtime', () => {
  let mounted: ReturnType<typeof mountSolid>;
  let fixture: ReturnType<typeof styled>;

  beforeEach(() => {
    fixture = styled();
    mounted = mountSolid(fixture.View);
  });

  afterEach(() => mounted.root.dispose());

  const card = () => mounted.nodes().find((n) => n.props['backgroundColor'] !== undefined)!;
  const label = () => mounted.nodes().find((n) => n.viewName === 'Paragraph')!;

  it('applies a class rule to a native view', () => {
    assert.equal(card().props['backgroundColor'], 'rgb(255, 0, 0)');
    assert.equal(card().props['paddingTop'], 12);
    assert.equal(card().props['paddingLeft'], 8);
  });

  it('applies a type selector to every matching element', () => {
    // `view { flex: 1 }` reaches both views.
    const views = mounted.nodes().filter((n) => n.viewName === 'View');
    assert.ok(views.length >= 2);
    for (const view of views) assert.equal(view.props['flexGrow'], 1);
  });

  it('never sends class as a native prop', () => {
    // Nothing on the native side reads it; it exists only for matching.
    for (const node of mounted.nodes()) {
      assert.equal(node.props['class'], undefined);
    }
  });

  it('matches descendant and id selectors', () => {
    assert.equal(card().props['borderTopLeftRadius'], 6, '#main .card matched');
    assert.equal(label().props['color'], 'rgb(0, 0, 255)', '.card .label matched');
    assert.equal(label().props['fontSize'], 20);
  });

  it('inherits text properties down the tree, which RN does not', () => {
    // A text with no rule of its own, inside a card that sets a colour and a size.
    const plain = mounted.byId('inheriting');
    assert.equal(plain.props['color'], 'rgb(1, 2, 3)', 'from the card');
    assert.equal(plain.props['fontSize'], 11);

    // And a rule of its own still wins over what it would have inherited.
    assert.equal(label().props['color'], 'rgb(0, 0, 255)');
    assert.equal(label().props['fontSize'], 20);
  });

  it('resolves specificity when a bound class is added', () => {
    fixture.setRaised(true);
    mounted.settle();

    // `.card.raised` is more specific than `.card`.
    assert.equal(card().props['backgroundColor'], 'rgb(0, 128, 0)');
  });
});
