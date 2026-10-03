import type { ScrollPayload } from '../events.ts';
/** One element's animated props, for as long as that element is alive. */
export interface AnimatedPropsHandle {
  /** Start observing the values. Until this runs, nothing reports a frame. */
  attach(): void;
  /** Stop observing, and release the native side if it was driving. */
  detach(): void;
  /** The current values, flattened the way a style object is. */
  read(): Record<string, unknown>;
  /**
   * Tell the graph which view the native driver should write to, by react tag. Safe to call
   * before any animation starts: React Native connects then, or later when one goes native.
   */
  connect(tag: number): void;
}

export interface AnimationBackend {
  /**
   * Wrap a style that may contain animated values. `onFrame` fires on every frame the graph
   * advances in JavaScript, and never while the native driver owns the animation.
   */
  props(style: Record<string, unknown>, onFrame: () => void): AnimatedPropsHandle;
}

/**
 * A gesture built by the library's own `Gesture` API: `Gesture.Pan()`, or a composition of
 * several. Opaque here on purpose - the shape is the library's, and this package does not know it.
 */
export type GestureSpec = object;

/** What a gesture is attached to: a node's react tag. */
export interface GestureTarget {
  readonly tag: number;
}

export interface GestureBackend {
  /** Attach `gesture` to `target`, and return the function that detaches it. */
  attach(target: GestureTarget, gesture: GestureSpec): () => void;
}

/** A Reanimated shared value. During an animation only the UI runtime reads one. */
export interface SharedValue<T = number> {
  value: T;
}

/**
 * A style, and the shared values it is computed from.
 *
 * The values are arguments to the worklet rather than things it captures, and that is the whole
 * reason this is a function of its inputs. A worklet captures its free variables by value when it
 * is created, so one written inside a component that reads its props or state would capture them -
 * every signal, store and closure in reach - and try to serialise all of it onto the other runtime.
 * Taking the values as arguments makes that impossible to write by accident, and makes the
 * dependency list the thing the UI runtime is subscribed to rather than a guess.
 */
export interface WorkletStyleSpec {
  readonly values: readonly unknown[];
  /**
   * Called with `values`. Declared as a method rather than a property so that a spec built from
   * a known tuple of shared values is still a `WorkletStyleSpec`: the parameter types are checked
   * in the factory below, against the values it was handed, and widen on the way in.
   */
  updater(...values: readonly unknown[]): Record<string, unknown>;
}

/** A worklet run on every scroll frame, and the shared values it is given. */
export interface WorkletScrollSpec {
  readonly values: readonly unknown[];
  /**
   * Called on the UI runtime with the event and `values`. See `WorkletStyleSpec.updater`.
   *
   * The payload rather than the wrapped event a listener gets: Reanimated hands a worklet what
   * native put in the event, with no `nativeEvent` around it.
   */
  handler(event: ScrollPayload, ...values: readonly unknown[]): void;
}

/** What the UI runtime writes to: a node's react tag and the shadow node behind it. */
export interface WorkletTarget {
  readonly tag: number;
  readonly shadowNode: unknown;
}

export interface WorkletBackend {
  /**
   * Run `style.updater` on the UI runtime whenever one of its values changes, writing what it
   * returns onto `target`. Returns the function that stops it.
   */
  bind(target: WorkletTarget, style: WorkletStyleSpec): () => void;

  /**
   * Run `spec.handler` on the UI runtime for every scroll event `target` emits. Returns the
   * function that stops it.
   */
  scroll(target: WorkletTarget, spec: WorkletScrollSpec): () => void;
}
