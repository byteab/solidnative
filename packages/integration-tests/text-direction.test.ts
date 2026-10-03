/**
 * Text alignment inside a `direction` subtree.
 *
 * On the web `direction: rtl` moves a paragraph's default alignment and its `start` and `end` to
 * the right-hand side. Yoga carries the direction into layout, but React Native aligns a paragraph
 * with no `textAlign` by the app's language rather than by the subtree, so an Arabic line in an
 * RTL box of an English app sat on the left. React Native also reads `left` and `right` relative
 * to the layout direction, swapping them in a right-to-left layout, which the engine has to
 * account for when it commits a physical side.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine } from '@solid-native/fabric';
import { createFakeFabric } from '@solid-native/testing';
import { mountSolid } from './css-solid-harness.ts';
import { textDirection } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

describe('text in a direction subtree', () => {
  let mounted: ReturnType<typeof mountSolid> | undefined;
  let fixture: ReturnType<typeof textDirection>;
  const render = () => {
    fixture = textDirection();
    mounted = mountSolid(fixture.View);
    return { getByTestId: (id: string) => mounted!.byId(id) };
  };

  afterEach(() => mounted?.root.dispose());

  // React Native's `left` is the start edge, and its `right` the end edge, of the layout direction.
  const START = 'left';
  const END = 'right';

  it('starts a paragraph at the right in a right-to-left subtree, whatever its script', () => {
    const { getByTestId } = render();
    for (const id of ['plain', 'arabic']) {
      assert.equal(getByTestId(id).props['textAlign'], START, id);
      assert.equal(getByTestId(id).props['writingDirection'], 'rtl', id);
    }
  });

  it('resolves start and end against the subtree, and keeps a physical side where it is', () => {
    const { getByTestId } = render();
    assert.equal(getByTestId('start').props['textAlign'], START);
    assert.equal(getByTestId('end').props['textAlign'], END);
    // Physical left in a right-to-left layout is React Native's end edge.
    assert.equal(getByTestId('left').props['textAlign'], END);
    assert.equal(getByTestId('centre').props['textAlign'], 'center');
  });

  it('lets a writing-direction stand, and a nested ltr subtree turn it back', () => {
    const { getByTestId } = render();
    assert.equal(getByTestId('written').props['writingDirection'], 'ltr');
    assert.equal(getByTestId('back').props['textAlign'], START);
    assert.equal(getByTestId('back').props['writingDirection'], 'ltr');
  });

  it('follows an inline direction, and a change to it', () => {
    const { getByTestId } = render();
    assert.equal(getByTestId('inline').props['writingDirection'], 'rtl');

    fixture.setInline({ direction: 'ltr' });
    mounted!.settle();
    assert.equal(getByTestId('inline').props['writingDirection'], 'ltr');
  });

  it('leaves a paragraph with no direction around it to the platform', () => {
    const { getByTestId } = render();
    assert.equal(getByTestId('none').props['textAlign'], undefined);
    assert.equal(getByTestId('none').props['writingDirection'], undefined);
    assert.equal(getByTestId('none-end').props['textAlign'], END, 'end is still the end edge');
  });
});

describe('a paragraph between two directions', () => {
  it('takes the nearer inline direction over one it only inherits from further out', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: compileCss('.rtl { direction: rtl }') });
    const outer = engine.createElement('view');
    engine.addClass(outer, 'rtl');
    const middle = engine.createElement('view');
    engine.setProp(middle, 'style', { direction: 'ltr' });
    const paragraph = engine.createElement('text');
    engine.appendChild(paragraph, engine.createText('Hello'));
    engine.appendChild(engine.root, outer);
    engine.appendChild(outer, middle);
    engine.appendChild(middle, paragraph);
    engine.commit();
    const committed = fabric.committed[0]!.children[0]!.children[0]!;
    assert.equal(committed.props['writingDirection'], 'ltr');
  });
});
