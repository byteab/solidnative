// @ts-expect-error React Native ships its internals as Flow, so the deep import has no types.
// The shape used here is declared just below; it is four methods.
import Untyped from 'react-native/Libraries/Animated/nodes/AnimatedProps';
import {
  AnimatedStyle as bindStyle,
  type AnimationBackend,
  type BindingSpec,
} from './animation-bindings.ts';

// The graph an app builds its values from, under the names a browser build exports too (see
// `animations-web.ts`), so one import serves a component on both platforms.
export { Animated, Easing } from 'react-native';

/**
 * What `AnimatedProps` gives us. `setNativeView` takes anything `findNodeHandle` accepts, and
 * that includes a plain number, which is how an animated graph reaches one of our nodes with no
 * React instance in sight.
 */
interface AnimatedPropsNode {
  __attach(): void;
  __detach(): void;
  __getValue(): { style?: Record<string, unknown> };
  setNativeView(viewTag: number): void;
}

/**
 * `AnimatedProps` is what `createAnimatedComponent` uses, and there is no public equivalent.
 * Everything above it in that file is React, and none of it is wanted here.
 */
const AnimatedProps = Untyped as new (
  props: { [key: string]: unknown },
  callback: () => void,
) => AnimatedPropsNode;
export const nativeAnimationBackend: AnimationBackend = {
  props: (style, onFrame) => {
    const props = new AnimatedProps({ style }, onFrame);
    return {
      attach: () => props.__attach(),
      detach: () => props.__detach(),
      read: () => props.__getValue().style ?? {},
      // A number is all `findNodeHandle` needs, so the graph can address one of our nodes with no
      // React instance anywhere. React Native connects the view now if an animation has already
      // gone native, and remembers the tag for the moment one does.
      connect: (tag) => props.setNativeView(tag),
    };
  },
};

export function AnimatedStyle(
  spec: BindingSpec<Record<string, unknown>>,
  backend: AnimationBackend = nativeAnimationBackend,
) {
  return bindStyle(spec, backend);
}
