// For the side effect: evaluating the package's index is what starts its event receiver, which
// is what delivers a gesture whose callbacks are ordinary functions. An app importing `Gesture`
// does this too; this file does not depend on that.
import 'react-native-gesture-handler';
import { GestureRoot as Root } from './gesture-root.ts';
import type { ViewProps } from './types.ts';
import {
  gestureDispatcher,
  type GestureCallbacks,
  type GestureStateManager,
} from '../gesture-dispatch.ts';
import {
  NativeGesture as bindGesture,
  type GestureBackend,
  type GestureSpec,
  type BindingSpec,
} from './animation-bindings.ts';

export { type GestureSpec, type GestureTarget } from './animation-bindings.ts';

/**
 * The internals, required rather than imported, and each with a literal path because Metro builds
 * its graph from those.
 *
 * Not for laziness: a static import would put these TypeScript sources into our own type-checking
 * program, where they fail against settings of ours they were never written for
 * (`verbatimModuleSyntax`, `erasableSyntaxOnly`). `require` asks Metro for the module and leaves
 * the compiler out of it, which is the same trade `@solid-native/device` makes for React Native.
 */
const { attachHandlers } =
  require('react-native-gesture-handler/src/handlers/gestures/GestureDetector/attachHandlers.ts') as {
    attachHandlers(config: {
      preparedGesture: object;
      gestureConfig: object;
      gesturesToAttach: readonly object[];
      viewTag: number;
      webEventHandlersRef: object;
    }): void;
  };

const { dropHandlers } =
  require('react-native-gesture-handler/src/handlers/gestures/GestureDetector/dropHandlers.ts') as {
    dropHandlers(prepared: object): void;
  };

const { maybeInitializeFabric } = require('react-native-gesture-handler/src/init.ts') as {
  maybeInitializeFabric(): void;
};

const { GestureStateManager } =
  require('react-native-gesture-handler/src/handlers/gestures/gestureStateManager.ts') as {
    GestureStateManager: { create(handlerTag: number): GestureStateManager };
  };

/**
 * The same call Reanimated's own `WorkletEventHandler` makes: one registration per event name per
 * view tag, which is all a gesture needs to reach the UI runtime. Not public either.
 */
const { registerEventHandler, unregisterEventHandler } =
  require('react-native-reanimated/src/core.ts') as {
    registerEventHandler(
      worklet: (event: never) => void,
      eventName: string,
      emitterReactTag: number,
    ): number;
    unregisterEventHandler(id: number): void;
  };

/** The gesture object, as far as this file needs to know it. */
interface Attachable {
  initialize(): void;
  prepare(): void;
  toGestureArray(): { handlers: GestureCallbacks; shouldUseReanimated: boolean }[];
}

const EVENT_NAMES = ['onGestureHandlerStateChange', 'onGestureHandlerEvent'];

/**
 * A gesture's own state controller, for the touch callbacks: a worklet that accepts or rejects
 * the gesture while it is still being recognised. Wrapped in a worklet of ours because everything
 * the dispatcher closes over is serialised onto the UI runtime with it.
 */
const createManager = (handlerTag: number): GestureStateManager => {
  'worklet';
  return GestureStateManager.create(handlerTag);
};

export const nativeGestureBackend: GestureBackend = {
  attach: (target, gesture) => {
    maybeInitializeFabric();
    const config = gesture as Attachable;
    const gesturesToAttach = config.toGestureArray();
    // The library's own state object. Only `isMounted` is read back by anything of ours - the
    // microtasks `attachHandlers` queues check it, so a detector torn down in the same tick as
    // it was created does not attach a handler nobody will drop.
    const prepared = {
      attachedGestures: [],
      animatedEventHandler: null,
      animatedHandlers: null,
      shouldUseReanimated: gesturesToAttach.some((g) => g.shouldUseReanimated),
      isMounted: true,
    };
    const registrations: number[] = [];
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      prepared.isMounted = false;
      const errors: unknown[] = [];
      for (const id of registrations) {
        try {
          unregisterEventHandler(id);
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        dropHandlers(prepared);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length) throw new AggregateError(errors, 'Native gesture cleanup failed.');
    };
    try {
      attachHandlers({
        preparedGesture: prepared,
        gestureConfig: config,
        gesturesToAttach,
        viewTag: target.tag,
        webEventHandlersRef: { current: {} },
      });
      const animated = gesturesToAttach.filter((g) => g.shouldUseReanimated);
      const dispatch = gestureDispatcher(
        animated.map((g) => g.handlers),
        createManager,
      );
      if (animated.length)
        for (const name of EVENT_NAMES)
          registrations.push(registerEventHandler(dispatch, name, target.tag));
      return release;
    } catch (error) {
      try {
        release();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Native gesture acquisition failed.');
      }
      throw error;
    }
  },
};

export function NativeGesture(
  spec: BindingSpec<GestureSpec>,
  backend: GestureBackend = nativeGestureBackend,
) {
  return bindGesture(spec, backend);
}
export function GestureRoot(props: ViewProps) {
  maybeInitializeFabric();
  return Root(props);
}
