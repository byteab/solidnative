/**
 * What a test gets for `react-native-gesture-handler`, whose source Node cannot load.
 *
 * `Gesture.Pan()`, `Gesture.Tap()`, `Gesture.Simultaneous(...)` and every other builder returns a
 * gesture that takes any configuration call, `.minDistance(10).onUpdate(...)`, and returns itself,
 * so a component builds its gestures in a test exactly as it does on a device. The callbacks it was
 * given are kept on `callbacks`, by name, for a test that wants to call one. `State` and
 * `Directions` are the library's own numbers.
 */

/** The configuration and callback calls gestures take, as far as a test types them. */
type GestureMethod =
  | 'onBegin'
  | 'onStart'
  | 'onUpdate'
  | 'onChange'
  | 'onEnd'
  | 'onFinalize'
  | 'onTouchesDown'
  | 'onTouchesMove'
  | 'onTouchesUp'
  | 'onTouchesCancelled'
  | 'enabled'
  | 'runOnJS'
  | 'minDistance'
  | 'minPointers'
  | 'maxPointers'
  | 'numberOfTaps'
  | 'minDuration'
  | 'maxDuration'
  | 'direction'
  | 'activeOffsetX'
  | 'activeOffsetY'
  | 'failOffsetX'
  | 'failOffsetY'
  | 'hitSlop'
  | 'shouldCancelWhenOutside'
  | 'manualActivation'
  | 'simultaneousWithExternalGesture'
  | 'requireExternalGestureToFail'
  | 'blocksExternalGesture'
  | 'withRef'
  | 'withTestId';

/**
 * A gesture built in a test: every configuration call returns it, and callbacks are kept. `kind`
 * is the builder that made it, `Pan` or `Race`, and `gestures` what a composed one was made of.
 */
export type TestGesture = {
  readonly kind: string;
  readonly gestures: readonly TestGesture[];
  readonly callbacks: Record<string, (...args: never[]) => unknown>;
} & { readonly [M in GestureMethod]: (...args: readonly unknown[]) => TestGesture };

type Builder =
  | 'Pan'
  | 'Tap'
  | 'LongPress'
  | 'Pinch'
  | 'Rotation'
  | 'Fling'
  | 'Hover'
  | 'Manual'
  | 'Native'
  | 'ForceTouch'
  | 'Race'
  | 'Simultaneous'
  | 'Exclusive';

function gesture(kind: string, gestures: readonly TestGesture[]): TestGesture {
  const callbacks: Record<string, (...args: never[]) => unknown> = {};
  // What `@solid-native/components/gestures` calls to prepare a gesture for attaching; nothing native
  // is attached here, so there is nothing to prepare.
  const fields: Record<string, unknown> = {
    kind,
    gestures,
    callbacks,
    initialize() {},
    prepare() {},
    toGestureArray: () => [],
  };
  const self = new Proxy(fields as TestGesture, {
    get(target, key) {
      if (typeof key === 'string' && key in fields) return fields[key];
      // Not a thenable, and nothing to say to a symbol such as `Symbol.toPrimitive`.
      if (typeof key === 'symbol' || key === 'then') return undefined;
      return (...args: unknown[]) => {
        if (key.startsWith('on') && typeof args[0] === 'function') {
          callbacks[key] = args[0] as (...args: never[]) => unknown;
        }
        return self;
      };
    },
  });
  return self;
}

export const Gesture = new Proxy(
  {},
  {
    get:
      (_target, kind) =>
      (...gestures: unknown[]) =>
        gesture(String(kind), gestures as TestGesture[]),
  },
) as Readonly<Record<Builder, (...gestures: readonly unknown[]) => TestGesture>>;

export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
} as const;

export const Directions = { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 } as const;
