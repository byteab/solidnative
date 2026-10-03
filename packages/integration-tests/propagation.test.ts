/**
 * Halting a bubble: `stopPropagation()` on the event every listener receives.
 *
 * Two layers decide what a nested press does, and they are tested separately because they fail
 * separately. The responder negotiation elects one owner for the gesture, so an inner pressable's
 * `onPress` already keeps the row's from firing without anyone stopping anything. Element events
 * such as `onTouchEnd` and `onLayout` are not negotiated: they walk from the target to the root,
 * and only `stopPropagation` ends that walk early.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Engine, type NativeSyntheticEvent } from '@solidnative/fabric';
import { createFakeFabric } from '@solidnative/testing';
import { mountSolid } from './css-solid-harness.ts';
import { propagation } from './css-solid-fixtures.tsx';

describe('stopPropagation on the engine', () => {
  const tree = () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const outer = engine.createElement('view');
    const middle = engine.createElement('view');
    const inner = engine.createElement('view');
    engine.appendChild(engine.root, outer);
    engine.appendChild(outer, middle);
    engine.appendChild(middle, inner);
    engine.commit();
    return { engine, outer, middle, inner };
  };

  it('halts the bubble at the node whose listener called it', () => {
    const { engine, outer, middle, inner } = tree();
    const log: string[] = [];
    engine.setEventListener(inner, 'topTouchEnd', () => log.push('inner'));
    engine.setEventListener(middle, 'topTouchEnd', (event) => {
      log.push('middle');
      (event as NativeSyntheticEvent).stopPropagation();
    });
    engine.setEventListener(outer, 'topTouchEnd', () => log.push('outer'));

    engine.dispatchEvent(inner, 'topTouchEnd', {});
    assert.deepEqual(log, ['inner', 'middle']);
  });

  it('still runs the other listeners on the node that stopped it, as the DOM does', () => {
    const { engine, outer, inner } = tree();
    const log: string[] = [];
    engine.setEventListener(inner, 'topTouchEnd', (event) => {
      log.push('first');
      (event as NativeSyntheticEvent).stopPropagation();
    });
    engine.setEventListener(inner, 'topTouchEnd', () => log.push('second'));
    engine.setEventListener(outer, 'topTouchEnd', () => log.push('outer'));

    engine.dispatchEvent(inner, 'topTouchEnd', {});
    assert.deepEqual(log, ['first', 'second']);
  });

  it('reports whether it was stopped, and starts every dispatch unstopped', () => {
    const { engine, inner } = tree();
    const seen: boolean[] = [];
    engine.setEventListener(inner, 'topTouchEnd', (event) => {
      const synthetic = event as NativeSyntheticEvent;
      seen.push(synthetic.isPropagationStopped());
      synthetic.stopPropagation();
      seen.push(synthetic.isPropagationStopped());
    });

    engine.dispatchEvent(inner, 'topTouchEnd', {});
    engine.dispatchEvent(inner, 'topTouchEnd', {});
    assert.deepEqual(seen, [false, true, false, true]);
  });

  it('keeps nativeEvent where RN puts it', () => {
    const { engine, inner } = tree();
    let payload: unknown;
    engine.setEventListener(inner, 'topTouchEnd', (event) => {
      payload = (event as NativeSyntheticEvent).nativeEvent;
    });
    engine.dispatchEvent(inner, 'topTouchEnd', { pageX: 3 });
    assert.deepEqual(payload, { pageX: 3 });
  });
});

describe('a pressable row with a delete button inside it', () => {
  let mounted: ReturnType<typeof mountSolid>;
  let host: ReturnType<typeof propagation>['state'];

  beforeEach(() => {
    const fixture = propagation();
    host = fixture.state;
    mounted = mountSolid(fixture.View);
  });

  afterEach(() => mounted.root.dispose());

  /** A touch that starts and ends on the node, as a tap does. */
  const tap = (id: string) => {
    const node = mounted.byId(id);
    const touch = { identifier: 1, pageX: 1, pageY: 1, target: node.reactTag };
    mounted.fabric.emit(node, 'topTouchStart', {
      ...touch,
      changedTouches: [touch],
      touches: [touch],
    });
    mounted.fabric.emit(node, 'topTouchEnd', { ...touch, changedTouches: [touch], touches: [] });
    mounted.settle();
  };

  it('presses only the button, because the button owns the gesture', () => {
    // The responder half. Nobody calls stopPropagation here: the negotiation's bubble pass
    // elects the innermost pressable, and a press only ever fires on the responder.
    tap('delete');
    assert.deepEqual(
      host.log.filter((entry) => entry.endsWith(':press')),
      ['delete:press'],
    );
  });

  it('presses the row when the tap lands on the row itself', () => {
    tap('row');
    assert.deepEqual(
      host.log.filter((entry) => entry.endsWith(':press')),
      ['row:press'],
    );
  });

  it('bubbles a touch event to every ancestor by default', () => {
    tap('delete');
    assert.deepEqual(
      host.log.filter((entry) => entry.endsWith(':touchEnd')),
      ['delete:touchEnd', 'row:touchEnd', 'list:touchEnd'],
    );
  });

  it('stops the bubble when a component handler calls event.stopPropagation()', () => {
    host.stop = true;
    tap('delete');
    assert.deepEqual(
      host.log.filter((entry) => entry.endsWith(':touchEnd')),
      ['delete:touchEnd'],
    );
    // The press is the responder's business and is unaffected.
    assert.ok(host.log.includes('delete:press'));
    assert.ok(!host.log.includes('row:press'));
  });
});
