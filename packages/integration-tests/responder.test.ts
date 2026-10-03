/**
 * The JS responder system. These drive the engine directly: the negotiation is renderer-level
 * and has nothing to do with the UI framework. The pressable cases mount Solid's `Pressable`.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Engine, type EngineNode } from '@solidnative/fabric';
import {
  cleanup,
  createFakeFabric,
  fireEvent,
  render,
  screen,
  type FakeFabric,
} from '@solidnative/testing';
import { nestedPress } from './metro-nested-press.tsx';

/** The nested pressables, mounted, and the inner label a finger lands on. */
function mountNested() {
  const { log, Nested } = nestedPress();
  render(Nested);
  return { log, label: screen.getByText('inner') };
}

describe('responder negotiation', () => {
  let fabric: FakeFabric;
  let engine: Engine;
  let outer: EngineNode;
  let inner: EngineNode;
  let log: string[];

  beforeEach(() => {
    fabric = createFakeFabric();
    engine = new Engine(fabric, 1);
    outer = engine.createElement('view');
    inner = engine.createElement('pressable');
    engine.appendChild(engine.root, outer);
    engine.appendChild(outer, inner);
    engine.commit();
    log = [];
  });

  const handlers = (name: string, extra = {}) => ({
    onStartShouldSetResponder: () => true,
    onResponderGrant: () => log.push(`${name}:grant`),
    onResponderMove: () => log.push(`${name}:move`),
    onResponderRelease: () => log.push(`${name}:release`),
    onResponderTerminate: () => log.push(`${name}:terminate`),
    ...extra,
  });

  it('elects the innermost interested node on the bubble pass', () => {
    engine.setResponder(outer, handlers('outer'));
    engine.setResponder(inner, handlers('inner'));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    assert.equal(engine.responder, inner);
    assert.deepEqual(log, ['inner:grant']);
  });

  it('lets an ancestor pre-empt in the capture pass', () => {
    // This is how a scroll view claims a drag before a button inside it can.
    engine.setResponder(outer, handlers('outer', { onStartShouldSetResponderCapture: () => true }));
    engine.setResponder(inner, handlers('inner'));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    assert.equal(engine.responder, outer);
    assert.deepEqual(log, ['outer:grant']);
  });

  it('runs the full grant, move, release cycle on the responder only', () => {
    engine.setResponder(outer, handlers('outer'));
    engine.setResponder(inner, handlers('inner'));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    engine.dispatchEvent(inner, 'topTouchMove', {});
    engine.dispatchEvent(inner, 'topTouchEnd', {});

    assert.deepEqual(log, ['inner:grant', 'inner:move', 'inner:release']);
    assert.equal(engine.responder, null);
  });

  it('terminates rather than releases when the touch is cancelled', () => {
    engine.setResponder(inner, handlers('inner'));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    engine.dispatchEvent(inner, 'topTouchCancel', {});

    assert.deepEqual(log, ['inner:grant', 'inner:terminate']);
    assert.equal(engine.responder, null);
  });

  it('lets the current responder refuse to hand over', () => {
    engine.setResponder(inner, handlers('inner', { onResponderTerminationRequest: () => false }));
    engine.setResponder(outer, handlers('outer', { onMoveShouldSetResponder: () => true }));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    // The outer node asks for the gesture mid-drag and is refused.
    engine.dispatchEvent(inner, 'topTouchMove', {});

    assert.equal(engine.responder, inner, 'kept by the refusal');
    assert.deepEqual(log, ['inner:grant', 'inner:move']);
  });

  it('hands the gesture to a second touch elsewhere, terminating the first responder', () => {
    engine.setResponder(inner, handlers('inner'));
    engine.setResponder(outer, handlers('outer'));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    engine.dispatchEvent(outer, 'topTouchStart', {});

    assert.equal(engine.responder, outer);
    assert.deepEqual(log, ['inner:grant', 'inner:terminate', 'outer:grant']);
  });

  it('keeps the gesture from a second touch when the responder refuses to hand over', () => {
    engine.setResponder(inner, handlers('inner', { onResponderTerminationRequest: () => false }));
    engine.setResponder(outer, handlers('outer'));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    engine.dispatchEvent(outer, 'topTouchStart', {});

    assert.equal(engine.responder, inner);
    assert.deepEqual(log, ['inner:grant']);
  });

  it('runs the capture pass from the root down, so the outermost claim wins', () => {
    const middle = engine.createElement('view');
    engine.removeChild(outer, inner);
    engine.appendChild(outer, middle);
    engine.appendChild(middle, inner);
    engine.commit();
    const capture = { onStartShouldSetResponderCapture: () => true };
    engine.setResponder(outer, handlers('outer', capture));
    engine.setResponder(middle, handlers('middle', capture));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    assert.equal(engine.responder, outer);
  });

  it('leaves the responder alone when another node gives up its registration', () => {
    const stopOuter = engine.setResponder(outer, handlers('outer'));
    engine.setResponder(inner, handlers('inner'));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    stopOuter();

    assert.equal(engine.responder, inner);
    assert.equal(inner.active, true);
  });

  it('keeps the gesture of a scroll view that is itself the responder when it scrolls', () => {
    engine.setResponder(outer, handlers('outer'));

    engine.dispatchEvent(outer, 'topTouchStart', {});
    engine.dispatchEvent(outer, 'topScroll', {});

    assert.equal(engine.responder, outer);
    assert.deepEqual(log, ['outer:grant']);
  });

  it('tells native who owns the gesture, and whether to stop scrolling', () => {
    engine.setResponder(inner, handlers('inner', { blockNativeResponder: true }));

    engine.dispatchEvent(inner, 'topTouchStart', {});
    engine.dispatchEvent(inner, 'topTouchEnd', {});

    assert.deepEqual(fabric.responderCalls, [
      { viewName: 'View', isResponder: true, block: true },
      { viewName: 'View', isResponder: false, block: true },
    ]);
  });

  it('stops offering a node once its registration is disposed', () => {
    const stop = engine.setResponder(inner, handlers('inner'));
    stop();

    engine.dispatchEvent(inner, 'topTouchStart', {});
    assert.equal(engine.responder, null);
    assert.deepEqual(log, []);
  });
});

describe('nested pressables', () => {
  it('presses only the innermost one', async () => {
    const { log, label } = mountNested();

    // Touch the innermost text: with raw propagation both pressables fired, because every
    // ancestor with a listener got the event. The negotiation elects exactly one.
    await fireEvent.press(label);

    assert.deepEqual(log, ['inner']);
    cleanup();
  });
});

describe('event opt-in props', () => {
  it('sets onLayout on the node when something listens for layout', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const view = engine.createElement('view');
    engine.appendChild(engine.root, view);

    engine.setEventListener(view, 'topLayout', () => {});
    engine.commit();

    // Native checks the prop, not the listener: without it the view is never measured.
    const committed = fabric.committed[0]!;
    assert.equal(committed.props['onLayout'], true);
  });

  it('does not invent opt-in props for ordinary events', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const view = engine.createElement('view');
    engine.appendChild(engine.root, view);

    engine.setEventListener(view, 'topTouchStart', () => {});
    engine.commit();

    assert.deepEqual(Object.keys(fabric.committed[0]!.props), []);
  });
});

describe('press cancels when the touch turns into a drag', () => {
  it('presses when the finger barely moves', async () => {
    const { log, label } = mountNested();

    await fireEvent(label, 'touchStart', { pageX: 100, pageY: 100 });
    await fireEvent(label, 'touchMove', { pageX: 104, pageY: 103 });
    await fireEvent(label, 'touchEnd', { pageX: 104, pageY: 103 });

    assert.deepEqual(log, ['inner']);
    cleanup();
  });

  it('does not press when the finger drags away to scroll', async () => {
    const { log, label } = mountNested();

    // A drag to scroll starts on the button just like a tap does. Before this it fired a
    // press: on the canary that opened a modal, which then swallowed every later gesture and
    // presented as "scrolling does not work".
    await fireEvent(label, 'touchStart', { pageX: 100, pageY: 400 });
    await fireEvent(label, 'touchMove', { pageX: 100, pageY: 340 });
    await fireEvent(label, 'touchEnd', { pageX: 100, pageY: 200 });

    assert.deepEqual(log, []);
    cleanup();
  });
});

describe('Fabric event handler ownership', () => {
  // Fabric holds one event handler and `ReactFabric` installs React's at module scope. Anything
  // we leave unclaimed reaches React's event plugins, which throw on a name they have no view
  // config for. `RNSScreen` emits `onWillAppear` during a push with no listener anywhere, so a
  // lazily claimed handler let that throw unwind the native mounting transaction and the process
  // died in `RNSScreenStackView.updateProps` on the next commit.
  it('is claimed before any listener is attached', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const screen = engine.createElement('screen');
    engine.appendChild(engine.root, screen);
    engine.commit();

    const node = fabric.committed[0];
    assert.ok(node, 'expected the screen to be committed');
    assert.doesNotThrow(() => fabric.emit(node, 'topWillAppear', {}));
  });
});

describe('a responder torn down mid-gesture', () => {
  it('clears :active from the chain it had marked', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const outer = engine.createElement('view');
    const inner = engine.createElement('pressable');
    engine.appendChild(engine.root, outer);
    engine.appendChild(outer, inner);
    engine.commit();

    const stop = engine.setResponder(inner, { onStartShouldSetResponder: () => true });
    engine.dispatchEvent(inner, 'topTouchStart', {});
    assert.equal(outer.active, true, 'the press activates the chain');

    // The row is destroyed under the finger: an @for re-render, a swipe-to-delete.
    const commits = fabric.calls.completeRoot;
    stop();
    assert.equal(inner.active, false, 'the responder itself');
    assert.equal(outer.active, false, 'and every ancestor it had marked');
    assert.equal(fabric.calls.completeRoot, commits + 1, 'committed, since no binding moved');
    assert.equal(engine.responder, null);
  });
});
