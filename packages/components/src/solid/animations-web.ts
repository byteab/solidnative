/**
 * `animations.ts`, for a browser build.
 *
 * A web bundler resolves `@solidnative/components/animations` (and `./solid/animations`) here,
 * through the `browser` condition in this package's `exports`; Metro, on a device, never sets that
 * condition and gets the native file. The names are the same on both sides, so a component that
 * imports `AnimatedStyle`, `Animated` and `Easing` from there is one component on both platforms.
 *
 * Nothing here reaches React Native. The graph is `animated.ts`, stepped by
 * `requestAnimationFrame`, and every frame is written through the same binding the device uses.
 */
import { animationBackend } from '../animated.ts';
import {
  AnimatedStyle as bindStyle,
  type AnimationBackend,
  type BindingSpec,
} from './animation-bindings.ts';

export { Animated } from '../animated.ts';
export { Easing } from '../easing.ts';

/** The browser graph, under the native file's name so either build resolves the same exports. */
export const nativeAnimationBackend: AnimationBackend = animationBackend;

export function AnimatedStyle(
  spec: BindingSpec<Record<string, unknown>>,
  backend: AnimationBackend = animationBackend,
) {
  return bindStyle(spec, backend);
}
