/**
 * What happens to the focused node when its view goes away.
 *
 * `Engine.focused` is the text input the keyboard belongs to, and it is not only used for
 * `:focus`. Every scroll view on screen reads it on every touch to decide whether that touch is
 * "a tap somewhere else, so dismiss the keyboard" - and a scroll view that decides yes *captures*
 * the touch before any child sees it.
 *
 * So a focused node that outlives its view is not a stale style. It is every tap in the
 * application being swallowed by the nearest scroll view, on every screen, until the app is
 * restarted. That is what a combobox did: focus its search box, press outside to dismiss, and
 * nothing in the app could be tapped again.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine } from '@solid-native/fabric';
import { createFakeFabric } from '@solid-native/testing';

/** A root, a wrapper, and an input inside the wrapper - the shape an overlay removes. */
function scene() {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1);
  const wrapper = engine.createElement('view');
  const input = engine.createElement('text-input');
  engine.appendChild(engine.root, wrapper);
  engine.appendChild(wrapper, input);
  engine.commit();
  return { engine, fabric, wrapper, input };
}

describe('the focused node', () => {
  it('is whatever native last said', () => {
    const s = scene();
    s.fabric.emit(s.fabric.committed[0]!.children[0]!, 'topFocus', {});
    assert.equal(s.engine.focused, s.input);
  });

  it('is forgotten when its own view is removed', () => {
    const s = scene();
    s.fabric.emit(s.fabric.committed[0]!.children[0]!, 'topFocus', {});
    s.engine.removeChild(s.wrapper, s.input);
    assert.equal(s.engine.focused, null);
  });

  it('is forgotten when an ancestor is removed, which is the one that bit', () => {
    // `removeChild` unlinks the subtree's root and leaves everything under it pointing at its own
    // parent, so a focused descendant still looks perfectly attached. A renderer need not call
    // `destroyNode` for every node in a removed subtree either, so neither hook fires for the
    // input - and that is exactly the shape of an overlay closing with a field inside it.
    const s = scene();
    s.fabric.emit(s.fabric.committed[0]!.children[0]!, 'topFocus', {});
    s.engine.removeChild(s.engine.root, s.wrapper);
    assert.equal(s.engine.focused, null);
  });

  it('survives a removal that is not its own', () => {
    const s = scene();
    const other = s.engine.createElement('view');
    s.engine.appendChild(s.engine.root, other);
    s.fabric.emit(s.fabric.committed[0]!.children[0]!, 'topFocus', {});
    s.engine.removeChild(s.engine.root, other);
    assert.equal(s.engine.focused, s.input, 'still focused, and still attached');
  });

  it('is forgotten on blur, as before', () => {
    const s = scene();
    const node = s.fabric.committed[0]!.children[0]!;
    s.fabric.emit(node, 'topFocus', {});
    s.fabric.emit(node, 'topBlur', {});
    assert.equal(s.engine.focused, null);
  });

  it('keeps the new node focused when the old one reports its blur after', () => {
    // Moving from one field to the next, native can report the new focus before the old blur.
    const s = scene();
    const next = s.engine.createElement('text-input');
    s.engine.appendChild(s.wrapper, next);
    s.engine.commit();
    const [first, second] = s.fabric.committed[0]!.children;
    s.fabric.emit(first!, 'topFocus', {});
    s.fabric.emit(second!, 'topFocus', {});
    s.fabric.emit(first!, 'topBlur', {});
    assert.equal(s.engine.focused, next);
  });

  it('is not focused again when a removed subtree is put back', () => {
    const s = scene();
    s.fabric.emit(s.fabric.committed[0]!.children[0]!, 'topFocus', {});
    s.engine.removeChild(s.engine.root, s.wrapper);
    s.engine.commit();
    s.engine.appendChild(s.engine.root, s.wrapper);
    s.engine.commit();
    assert.equal(s.engine.focused, null, 'native dropped its focus when the view went');
  });
});
