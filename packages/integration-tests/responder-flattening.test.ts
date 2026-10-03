/**
 * A view that wants touches has to exist natively to be touched.
 *
 * Fabric flattens a view whose props say nothing visual and nothing interactive: no native view is
 * created and the layout is folded into the parent. Our responders are registered on the
 * JavaScript side through `Engine.setResponder`, which Fabric cannot see - so a transparent
 * touch-catcher looked exactly like a view worth flattening, and was.
 *
 * On a device that is a popover that will not close: the full-screen catcher over the app has no
 * background, gets flattened, and every press outside the card lands on whatever is underneath it.
 * The dialog's backdrop survived only by accident, because `bg-black/50` made it visual.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine } from '@solidnative/fabric';
import { createFakeFabric, type FakeFabricNode } from '@solidnative/testing';

const flatten = (n: FakeFabricNode[]): FakeFabricNode[] =>
  n.flatMap((x) => [x, ...flatten(x.children)]);

/** A node with nothing on it but a position, which is what a touch-catcher is. */
function scene() {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1);
  const view = engine.createElement('view');
  engine.appendChild(engine.root, view);
  return { engine, fabric, view, painted: () => flatten(fabric.committed)[0]! };
}

describe('a view that claims touches', () => {
  it('is left alone by the flattener', () => {
    const s = scene();
    s.engine.setResponder(s.view, { onStartShouldSetResponder: () => true });
    s.engine.commit();
    assert.equal(s.painted().props['collapsable'], false);
  });

  it('is created with the flag rather than given it afterwards', () => {
    // Android decides whether a view exists from the props it was created with, so arriving one
    // commit late is the same as never arriving.
    const fabric = createFakeFabric();
    const created: Record<string, unknown>[] = [];
    const create = fabric.createNode.bind(fabric);
    fabric.createNode = (tag, viewName, rootTag, props, handle) => {
      created.push({ ...(props as Record<string, unknown>) });
      return create(tag, viewName, rootTag, props, handle);
    };
    const engine = new Engine(fabric, 1);
    const view = engine.createElement('view');
    engine.setResponder(view, { onStartShouldSetResponder: () => true });
    engine.appendChild(engine.root, view);
    engine.commit();
    assert.equal(created.at(-1)!['collapsable'], false);
  });

  it('does not flag a view that never wanted touches', () => {
    // The flag is not free: it is a native view that would otherwise not exist, on every node.
    const s = scene();
    s.engine.commit();
    assert.equal(s.painted().props['collapsable'], undefined);
  });

  it('gives the flag back when the responder is torn down', () => {
    const s = scene();
    const stop = s.engine.setResponder(s.view, { onStartShouldSetResponder: () => true });
    s.engine.commit();
    stop();
    s.engine.commit();
    assert.equal(s.painted().props['collapsable'], null, 'cleared, so it can be flattened again');
  });

  it('leaves an explicit collapsable alone', () => {
    // Someone writing `collapsable="true"` on a pressable means it; this is a floor, not an
    // override.
    const s = scene();
    s.engine.setProp(s.view, 'collapsable', true);
    s.engine.setResponder(s.view, { onStartShouldSetResponder: () => true });
    s.engine.commit();
    assert.equal(s.painted().props['collapsable'], true);
  });
});
