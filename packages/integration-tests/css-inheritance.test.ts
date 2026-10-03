/**
 * Inheritance across component boundaries.
 *
 * Every node is cascaded against *its own* sheet, and inheritable values are handed down from a
 * parent's already-resolved style. Before this, resolution walked up from each node matching every
 * ancestor against the *node's* sheet, which broke encapsulation in both directions at once: a
 * component's rules reached nodes it did not own, and a parent's real values never arrived.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createFakeFabric, type FakeFabricNode } from '@solid-native/testing';
import { Engine, type StyleSheet } from '@solid-native/fabric';
import { createRequire } from 'node:module';
import { mountSolid, type FakeNode } from './css-solid-harness.ts';
import { crossParent, inheritUpdate } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

const flatten = (n: FakeFabricNode[]): FakeFabricNode[] =>
  n.flatMap((x) => [x, ...flatten(x.children)]);

let mounted: ReturnType<typeof mountSolid> | undefined;
afterEach(() => mounted?.root.dispose());

const paragraphWith = (match: (text: string) => boolean) =>
  mounted!
    .nodes()
    .find(
      (n) =>
        n.viewName === 'Paragraph' &&
        flattenFake(n.children).some((c) => match(String(c.props['text'] ?? ''))),
    )!;
const flattenFake = (n: FakeNode[]): FakeNode[] =>
  n.flatMap((x) => [x, ...flattenFake(x.children)]);

describe('inheritance across a component boundary', () => {
  beforeEach(() => {
    mounted = mountSolid(crossParent());
  });

  const textNamed = (label: string) => paragraphWith((text) => text === label);

  it("hands a parent's inherited value down into a child component", () => {
    // The parent's `.wrap` is red, and the child declares no colour on `.label`, so the child's
    // text must be red. It used to be blue: the child's own `.wrap` rule was matched against the
    // parent's `.wrap` node.
    assert.equal(textNamed('child').props['color'], 'rgb(255, 0, 0)');
    assert.equal(textNamed('child').props['fontSize'], 21);
  });

  it("never matches a component's rules against another component's node", () => {
    const wrap = mounted!.nodes().find((n) => n.props['fontSize'] === 21 && n.viewName === 'View');
    assert.ok(wrap, 'the parent wrap resolved from the parent sheet');
    assert.equal(wrap!.props['color'], 'rgb(255, 0, 0)', 'and not the child sheet blue');
  });

  it("lets the child's own rule beat what it inherits", () => {
    assert.equal(textNamed('own').props['color'], 'rgb(0, 255, 0)');
  });
});

describe('re-resolving inherited style when only an ancestor changes', () => {
  it('updates a child that is not itself dirty', () => {
    const fixture = inheritUpdate();
    mounted = mountSolid(fixture.View);

    const text = () => mounted!.nodes().find((n) => n.viewName === 'Paragraph')!;
    assert.equal(text().props['color'], 'rgb(255, 0, 0)');

    // Only the wrapper's class list changes. The text node's own props are untouched, so nothing
    // marks it dirty, yet what it inherits has changed.
    fixture.setDark(true);
    mounted.settle();

    assert.equal(text().props['color'], 'rgb(0, 0, 255)');
  });

  it('re-matches a descendant selector when an ancestor class changes', () => {
    // The harder half of the same problem. `.wrap.dark .deep` changes what a descendant matches
    // while nothing inheritable moves at all, so watching the inherited map is not enough: the
    // invalidation token has to stand for the whole ancestor chain's matchable state.
    const fixture = inheritUpdate();
    mounted = mountSolid(fixture.View);

    const deep = () => paragraphWith((text) => text.startsWith('matched'));
    assert.equal(deep().props['letterSpacing'], undefined);

    fixture.setDark(true);
    mounted.settle();

    assert.equal(deep().props['letterSpacing'], 7);
  });
});

describe('opting out of an inherited line height', () => {
  /**
   * `line-height: normal`, which is the CSS for "the font's own" and has no React Native spelling
   * but the absence of the prop.
   *
   * `leading-none` on a label reaches its children, because line-height is inherited - and a text
   * field that deliberately sets none of its own then wears the label's. On a phone that is text
   * sitting at the top of its box in one place and centred in the identical box next to it, which
   * is a maddening thing to look at and gives no clue where to look.
   */
  function scene(css: string) {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: compileCss(css) as StyleSheet });
    const parent = engine.createElement('view');
    const child = engine.createElement('text');
    engine.appendChild(engine.root, parent);
    engine.appendChild(parent, child);
    return {
      engine,
      parent,
      child,
      classes(node: unknown, value: string) {
        engine.setClasses(node as never, value);
      },
      painted() {
        engine.commit();
        const [outer] = flatten(fabric.committed);
        return { parent: outer!.props, child: outer!.children[0]!.props };
      },
    };
  }

  it('clears the property rather than compiling to nothing', () => {
    const s = scene('.label { line-height: 1; } .field { line-height: normal; }');
    s.classes(s.parent, 'label');
    s.classes(s.child, 'field');
    const { parent, child } = s.painted();
    assert.equal(parent['lineHeight'], 16, 'the label keeps its own');
    // `null`, not absent: clearing a prop is a value native is sent, and it is what beats the
    // value the parent handed down.
    assert.equal(child['lineHeight'], null, 'and the field has none of its own');
  });

  it('is a reset rather than a default, so a silent child still inherits', () => {
    const s = scene('.label { line-height: 1; }');
    s.classes(s.parent, 'label');
    assert.equal(s.painted().child['lineHeight'], 16);
  });
});

describe('the text properties a view hands down', () => {
  // CSS inherits these, so `text-shadow-md` or `select-none` on a card reaches every text in it.
  // Native reads them on the text only, and a view that wore them did nothing for its contents.
  function childOf(css: string, classes: string): Record<string, unknown> {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: compileCss(css) as StyleSheet });
    const parent = engine.createElement('view');
    const child = engine.createElement('text');
    engine.setClasses(parent, classes);
    engine.appendChild(engine.root, parent);
    engine.appendChild(parent, child);
    engine.commit();
    return flatten(fabric.committed)[0]!.children[0]!.props;
  }

  it('hands a text shadow down to the text inside', () => {
    const child = childOf('.glow { text-shadow: 0 1px 2px rgb(0, 0, 0) }', 'glow');
    assert.deepEqual(child['textShadowOffset'], { width: 0, height: 1 });
    assert.equal(child['textShadowRadius'], 2);
    assert.equal(child['textShadowColor'], 'rgb(0, 0, 0)');
  });

  it("hands selectability down, as user-select: auto takes the parent's", () => {
    assert.equal(childOf('.plain { user-select: none }', 'plain')['selectable'], false);
  });
});
