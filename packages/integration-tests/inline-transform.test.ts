/**
 * A transform written as a string on a node's own style: `[style.transform]="'rotate(30deg)'"`.
 *
 * A class's transform is compiled at build time into the list React Native wants. A bound style
 * has no build step, and Fabric reads only the list, so a string reached it untouched and was
 * dropped without a word: every rotated element on screen drew straight. In React Native it is
 * the JavaScript layer's `processTransform` that turns the string into the list, and there is no
 * React Native JavaScript between this engine and Fabric, so the engine does it.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Engine } from '@solidnative/fabric';
import { createFakeFabric, type FakeFabric } from '@solidnative/testing';

describe('a transform string on a bound style', () => {
  let fabric: FakeFabric;
  let engine: Engine;

  beforeEach(() => {
    fabric = createFakeFabric();
    engine = new Engine(fabric, 1, { processColor: (value) => value });
  });

  const committed = (transform: unknown) => {
    const view = engine.createElement('view');
    engine.setProp(view, 'style', { transform });
    engine.appendChild(engine.root, view);
    engine.commit();
    return fabric.committed[0]!.props['transform'];
  };

  it('reaches native as the list React Native builds from it', () => {
    assert.deepEqual(committed('rotate(30deg)'), [{ rotate: '30deg' }]);
  });

  it('keeps every function, in order, with lengths as numbers', () => {
    assert.deepEqual(committed('translateX(10px) rotate(-29.5deg) scale(1.5)'), [
      { translateX: 10 },
      { rotate: '-29.5deg' },
      { scale: 1.5 },
    ]);
  });

  it('splits the two-argument forms into their axes, as React Native does', () => {
    assert.deepEqual(committed('translate(4px, -2px) scale(2, 0.5)'), [
      { translateX: 4 },
      { translateY: -2 },
      { scaleX: 2 },
      { scaleY: 0.5 },
    ]);
  });

  it('keeps a percentage translate, which React Native resolves against the view', () => {
    assert.deepEqual(committed('translateX(-50%)'), [{ translateX: '-50%' }]);
  });

  it('leaves a list alone, which is what a compiled class already gives it', () => {
    assert.deepEqual(committed([{ rotate: '10deg' }]), [{ rotate: '10deg' }]);
  });

  it('widens a 2D matrix() to the sixteen values native reads, column by column', () => {
    assert.deepEqual(committed('matrix(1, 2, 3, 4, 5, 6)'), [
      { matrix: [1, 2, 0, 0, 3, 4, 0, 0, 0, 0, 1, 0, 5, 6, 0, 1] },
    ]);
  });

  it("treats 'none' as no transform", () => {
    assert.deepEqual(committed('none'), []);
  });
});
