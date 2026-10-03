/**
 * The gesture state machine: raw events in, a gesture's own callbacks out.
 *
 * This is the one part of a gesture we write rather than borrow, it runs on the UI runtime where
 * nothing reports a mistake, and every branch of it is a callback an app declared and would
 * otherwise never see run. So it is tested here against the events native actually sends.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GESTURE_STATE,
  TOUCH_EVENT,
  gestureDispatcher,
  type GestureCallbacks,
  type GestureStateManager,
} from '../components/src/gesture-dispatch.ts';

const TAG = 7;

/** A gesture that records the order its callbacks ran in, and what they were given. */
function recording(extra: Partial<GestureCallbacks> = {}) {
  const calls: [string, unknown?][] = [];
  const callbacks: GestureCallbacks = {
    handlerTag: TAG,
    onBegin: () => calls.push(['begin']),
    onStart: () => calls.push(['start']),
    onUpdate: (event) => calls.push(['update', event]),
    onEnd: (_event, success) => calls.push(['end', success]),
    onFinalize: (_event, success) => calls.push(['finalize', success]),
    ...extra,
  };
  return { calls, callbacks };
}

const manager: GestureStateManager = {
  begin: () => {},
  activate: () => {},
  fail: () => {},
  end: () => {},
};
const managers = (tag: number) => {
  seen.push(tag);
  return manager;
};
const seen: number[] = [];

const change = (oldState: number, state: number) => ({ handlerTag: TAG, oldState, state });

describe('gesture dispatch', () => {
  it('runs a whole successful gesture in order', () => {
    const { calls, callbacks } = recording();
    const dispatch = gestureDispatcher([callbacks], managers);

    dispatch(change(GESTURE_STATE.UNDETERMINED, GESTURE_STATE.BEGAN));
    dispatch(change(GESTURE_STATE.BEGAN, GESTURE_STATE.ACTIVE));
    dispatch({ handlerTag: TAG, translationX: 4 } as never);
    dispatch(change(GESTURE_STATE.ACTIVE, GESTURE_STATE.END));

    assert.deepEqual(
      calls.map(([name]) => name),
      ['begin', 'start', 'update', 'end', 'finalize'],
    );
    assert.equal(calls[3]![1], true, 'ended successfully');
  });

  it('finalizes without ending when the gesture never activated', () => {
    const { calls, callbacks } = recording();
    const dispatch = gestureDispatcher([callbacks], managers);

    dispatch(change(GESTURE_STATE.UNDETERMINED, GESTURE_STATE.BEGAN));
    dispatch(change(GESTURE_STATE.BEGAN, GESTURE_STATE.FAILED));

    assert.deepEqual(
      calls.map(([name]) => name),
      ['begin', 'finalize'],
      'no onEnd: a gesture that never started never ended',
    );
    assert.equal(calls[1]![1], false, 'and it did not succeed');
  });

  it('reports a cancelled gesture as an unsuccessful end', () => {
    const { calls, callbacks } = recording();
    const dispatch = gestureDispatcher([callbacks], managers);

    dispatch(change(GESTURE_STATE.BEGAN, GESTURE_STATE.ACTIVE));
    dispatch(change(GESTURE_STATE.ACTIVE, GESTURE_STATE.CANCELLED));

    assert.deepEqual(calls[1], ['end', false]);
    assert.deepEqual(calls[2], ['finalize', false]);
  });

  it('measures onChange against the event before it, and restarts each time', () => {
    const changes: number[] = [];
    const { callbacks } = recording({
      onChange: (event) => changes.push((event as { delta: number }).delta),
      changeEventCalculator: (current, previous) => ({
        delta: (current as { x: number }).x - ((previous as { x: number } | undefined)?.x ?? 0),
      }),
    });
    const dispatch = gestureDispatcher([callbacks], managers);

    dispatch(change(GESTURE_STATE.BEGAN, GESTURE_STATE.ACTIVE));
    dispatch({ handlerTag: TAG, x: 10 } as never);
    dispatch({ handlerTag: TAG, x: 25 } as never);
    // A second gesture on the same handler: the memory of the first must not carry into it.
    dispatch(change(GESTURE_STATE.ACTIVE, GESTURE_STATE.END));
    dispatch(change(GESTURE_STATE.BEGAN, GESTURE_STATE.ACTIVE));
    dispatch({ handlerTag: TAG, x: 3 } as never);

    assert.deepEqual(changes, [10, 15, 3]);
  });

  it('hands the touch callbacks one state manager per handler', () => {
    seen.length = 0;
    const got: string[] = [];
    const { callbacks } = recording({
      onTouchesDown: (_event, m) => got.push(m === manager ? 'down' : 'wrong'),
      onTouchesMove: () => got.push('move'),
      onTouchesUp: () => got.push('up'),
      onTouchesCancelled: () => got.push('cancelled'),
    });
    const dispatch = gestureDispatcher([callbacks], managers);

    for (const eventType of [
      TOUCH_EVENT.DOWN,
      TOUCH_EVENT.MOVE,
      TOUCH_EVENT.UP,
      TOUCH_EVENT.CANCELLED,
      TOUCH_EVENT.UNDETERMINED,
    ]) {
      dispatch({ handlerTag: TAG, eventType });
    }

    assert.deepEqual(got, ['down', 'move', 'up', 'cancelled'], 'and nothing for UNDETERMINED');
    assert.deepEqual(seen, [TAG], 'the manager is made once and kept');
  });

  it('ignores an event belonging to another gesture', () => {
    const { calls, callbacks } = recording();
    const dispatch = gestureDispatcher([callbacks], managers);

    dispatch({ handlerTag: TAG + 1, oldState: GESTURE_STATE.BEGAN, state: GESTURE_STATE.ACTIVE });

    assert.deepEqual(calls, [], 'a composition shares one dispatcher across its gestures');
  });
});
