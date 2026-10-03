/**
 * The state machine between a gesture's raw events and the callbacks it declared.
 *
 * This is what `useAnimatedGesture` does with hooks in react-native-gesture-handler, and the only
 * part of a gesture we write rather than borrow. It is here, apart from the library, so it can be
 * driven by a test: on a device it is serialised onto the UI runtime and a mistake in it is a
 * callback that silently never runs.
 *
 * The numbers below are the ones on the wire. They are the library's `State` and `TouchEventType`,
 * restated rather than imported because importing them would reach React Native's Flow source and
 * make this package unloadable in Node - and because they are a protocol between native and us,
 * not an API surface: native puts these integers in the event.
 */

/** `State` in react-native-gesture-handler. */
export const GESTURE_STATE = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
} as const;

/** `TouchEventType` in react-native-gesture-handler. */
export const TOUCH_EVENT = {
  UNDETERMINED: 0,
  DOWN: 1,
  MOVE: 2,
  UP: 3,
  CANCELLED: 4,
} as const;

/** Lets a touch callback accept or reject the gesture from the UI thread. */
export interface GestureStateManager {
  begin(): void;
  activate(): void;
  fail(): void;
  end(): void;
}

/** A gesture's declared callbacks, as the library leaves them once it has prepared the gesture. */
export interface GestureCallbacks {
  handlerTag: number;
  onBegin?: (event: object) => void;
  onStart?: (event: object) => void;
  onUpdate?: (event: object) => void;
  onChange?: (event: object) => void;
  onEnd?: (event: object, success: boolean) => void;
  onFinalize?: (event: object, success: boolean) => void;
  onTouchesDown?: (event: object, manager: GestureStateManager) => void;
  onTouchesMove?: (event: object, manager: GestureStateManager) => void;
  onTouchesUp?: (event: object, manager: GestureStateManager) => void;
  onTouchesCancelled?: (event: object, manager: GestureStateManager) => void;
  changeEventCalculator?: (current: object, previous?: object) => object;
}

/** What native sends. Which of the three kinds it is, is told by which fields are present. */
export interface GestureEvent {
  handlerTag: number;
  state?: number;
  oldState?: number;
  eventType?: number;
}

/** Per-gesture memory the dispatcher keeps across events. */
interface Memory {
  previous: Record<number, object | undefined>;
  managers: Record<number, GestureStateManager | undefined>;
}

function stateChange(gesture: GestureCallbacks, event: GestureEvent, memory: Memory): void {
  'worklet';
  const state = event.state as number;
  // A state-change event is a transition, so `oldState !== state` always holds and the only part
  // of the old state that matters is whether the gesture had gone active: that is what decides
  // between an end and a finalize alone.
  const wasActive = event.oldState === GESTURE_STATE.ACTIVE;
  if (state === GESTURE_STATE.BEGAN) {
    gesture.onBegin?.(event);
  } else if (state === GESTURE_STATE.ACTIVE) {
    gesture.onStart?.(event);
    memory.previous[gesture.handlerTag] = undefined;
  } else if (
    state === GESTURE_STATE.END ||
    state === GESTURE_STATE.FAILED ||
    state === GESTURE_STATE.CANCELLED
  ) {
    const succeeded = state === GESTURE_STATE.END;
    if (wasActive) gesture.onEnd?.(event, succeeded);
    gesture.onFinalize?.(event, succeeded);
  }
}

function update(gesture: GestureCallbacks, event: GestureEvent, memory: Memory): void {
  'worklet';
  gesture.onUpdate?.(event);
  // `onChange` is `onUpdate` measured against the event before it, which is what makes a drag
  // accumulate rather than jump. The calculator belongs to the gesture; only the memory is ours.
  if (gesture.onChange && gesture.changeEventCalculator) {
    gesture.onChange(gesture.changeEventCalculator(event, memory.previous[gesture.handlerTag]));
    memory.previous[gesture.handlerTag] = event;
  }
}

function touches(
  gesture: GestureCallbacks,
  event: GestureEvent,
  memory: Memory,
  createManager: (handlerTag: number) => GestureStateManager,
): void {
  'worklet';
  let manager = memory.managers[gesture.handlerTag];
  if (!manager) {
    manager = createManager(gesture.handlerTag);
    memory.managers[gesture.handlerTag] = manager;
  }
  const type = event.eventType;
  if (type === TOUCH_EVENT.DOWN) gesture.onTouchesDown?.(event, manager);
  else if (type === TOUCH_EVENT.MOVE) gesture.onTouchesMove?.(event, manager);
  else if (type === TOUCH_EVENT.UP) gesture.onTouchesUp?.(event, manager);
  else if (type === TOUCH_EVENT.CANCELLED) gesture.onTouchesCancelled?.(event, manager);
}

/**
 * Build the worklet that receives a view's gesture events.
 *
 * `createManager` is the library's `GestureStateManager.create`, passed in rather than imported
 * for the reason the constants are restated. It has to be a worklet itself: everything this
 * closure holds is serialised onto the UI runtime with it.
 */
export function gestureDispatcher(
  callbacks: readonly GestureCallbacks[],
  createManager: (handlerTag: number) => GestureStateManager,
): (event: GestureEvent) => void {
  // Captured, not passed: a worklet's closure is serialised once and reused, so this is how what
  // one event knew survives to the next. Reanimated's own dispatcher keeps its state the same way.
  const memory: Memory = { previous: {}, managers: {} };
  return (event: GestureEvent) => {
    'worklet';
    for (const gesture of callbacks) {
      if (event.handlerTag !== gesture.handlerTag) continue;
      if (event.oldState != null) stateChange(gesture, event, memory);
      else if (event.eventType != null) touches(gesture, event, memory, createManager);
      else update(gesture, event, memory);
    }
  };
}
