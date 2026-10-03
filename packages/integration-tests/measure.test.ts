/**
 * Measuring a node: where it actually is, in window coordinates.
 *
 * The engine has had no way to answer this. `(layout)` reports a frame in the parent's
 * coordinates, which is enough to size something and useless for positioning against it from
 * somewhere else in the tree - and positioning against it from somewhere else in the tree is the
 * whole of what an anchored overlay does.
 *
 * Fabric answers it synchronously on the new architecture: `measureInWindow` calls back before it
 * returns. That is worth relying on and worth not assuming, so the API is a callback - a caller
 * that needs the value now can capture it, and one that does not is unaffected if the platform
 * ever changes its mind.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine, type WindowFrame } from '@solidnative/fabric';
import { createFakeFabric } from '@solidnative/testing';

const scene = () => {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1);
  const view = engine.createElement('view');
  engine.appendChild(engine.root, view);
  engine.commit();
  return { fabric, engine, view };
};

describe('measuring a node', () => {
  it('reports the frame the platform gives, in window coordinates', () => {
    const { fabric, engine, view } = scene();
    fabric.frames.set('View', { x: 12, y: 40, width: 200, height: 44 });

    let frame: WindowFrame | null = null;
    engine.measure(view, (f) => (frame = f));
    assert.deepEqual(frame, { x: 12, y: 40, width: 200, height: 44 });
  });

  it('calls back synchronously, which is what lets an overlay place itself without a flash', () => {
    const { fabric, engine, view } = scene();
    fabric.frames.set('View', { x: 0, y: 0, width: 10, height: 10 });

    let calledDuring = false;
    engine.measure(view, () => (calledDuring = true));
    assert.equal(calledDuring, true, 'not on a later tick');
  });

  it('says nothing rather than guessing when the node has never been committed', () => {
    const { engine } = scene();
    const orphan = engine.createElement('view');

    let called = false;
    engine.measure(orphan, () => (called = true));
    assert.equal(called, false, 'a node native has not seen has no frame to report');
  });

  it('says nothing when the platform has no measure at all', () => {
    // An older host, or the fake in a test that never set a frame. Silence rather than zeroes:
    // a zero frame is a position, and an overlay would place itself in the corner believing it.
    const { engine, view } = scene();
    let called = false;
    engine.measure(view, () => (called = true));
    assert.equal(called, false);
  });
});
