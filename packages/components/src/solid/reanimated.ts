import {
  makeMutable,
  startMapper,
  stopMapper,
  type SharedValue as Mutable,
} from 'react-native-reanimated';
/**
 * `updateProps` is what every animated style in Reanimated goes through, and there is no exported
 * equivalent. It is a worklet, so it is called from ours rather than from here.
 *
 * Two things about the import. It goes through `src/` because that is where the package's own
 * `react-native` field points and Metro prefers that field: the built `lib/` copy would be a
 * second Reanimated in the bundle, with module state of its own. And it is a `require`, so that
 * these sources stay out of our type-checking program, where they fail against settings they were
 * never written for.
 */
const { updateProps } = require('react-native-reanimated/src/updateProps/index.ts') as {
  updateProps(descriptors: object, updates: Record<string, unknown>): void;
};
import {
  WorkletScroll as bindScroll,
  WorkletStyle as bindStyle,
  type WorkletBackend,
  type WorkletScrollSpec,
  type WorkletStyleSpec,
  type BindingSpec,
} from './animation-bindings.ts';

export {
  workletScroll,
  workletStyle,
  type SharedValue,
  type WorkletScrollSpec,
  type WorkletStyleSpec,
} from './worklets.ts';

/**
 * A value both runtimes can see. Reanimated's own `useSharedValue` is this plus a React ref, and
 * the ref is the half that does not apply here. Typed as Reanimated's own, so it goes to
 * `cancelAnimation` and the rest of the library as one of theirs would.
 */
export function sharedValue<T>(initial: T): Mutable<T> {
  return makeMutable(initial);
}

export const nativeWorkletBackend: WorkletBackend = {
  bind: (target, style) => {
    // The shape `updateProps` takes: a `{ value }` holder of descriptors, so that the set of
    // views a style drives can change without the worklet being rebuilt. Ours never does - one
    // binding drives one node - so a plain object is enough.
    const descriptors = { value: [{ tag: target.tag, shadowNodeWrapper: target.shadowNode }] };
    const { values, updater } = style;
    const id = startMapper(() => {
      'worklet';
      updateProps(descriptors, updater(...values));
    }, values as unknown[]);
    return () => stopMapper(id);
  },

  scroll: (target, spec) => {
    const { values, handler } = spec;
    // The same registration a gesture uses, on the name React Native's scroll views emit. The
    // event still reaches our own listeners: Reanimated observes it rather than consuming it.
    const id = registerEventHandler(
      (event: never) => {
        'worklet';
        handler(event, ...values);
      },
      'onScroll',
      target.tag,
    );
    return () => unregisterEventHandler(id);
  },
};

/**
 * Not public, and the same call Reanimated's own `WorkletEventHandler` makes. Reached through
 * `src/` for the reason `updateProps` is, and required rather than imported so that those sources
 * stay out of our type-checking program.
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

export function WorkletStyle(
  spec: BindingSpec<WorkletStyleSpec>,
  backend: WorkletBackend = nativeWorkletBackend,
) {
  return bindStyle(spec, backend);
}
export function WorkletScroll(
  spec: BindingSpec<WorkletScrollSpec>,
  backend: WorkletBackend = nativeWorkletBackend,
) {
  return bindScroll(spec, backend);
}
