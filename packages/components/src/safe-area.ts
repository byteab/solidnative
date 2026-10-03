/**
 * react-native-safe-area-context's two components, driven directly.
 *
 * The same arrangement as react-native-screens in the router: the native side is codegen'd Fabric
 * components, their React wrappers are unreachable, and the engine is taught the element names.
 * Registration happens when either component is first constructed, so importing one is the whole
 * setup.
 *
 * No decorators here: tests import this at runtime.
 */
import { registerViewName } from '@solidnative/fabric';

/** The edges of the screen, as both components name them. */
export type SafeAreaEdge = 'top' | 'right' | 'bottom' | 'left';

/** `['top', 'bottom']`, or `{ top: 'maximum', bottom: 'off' }` for per-edge control. */
export type SafeAreaEdges =
  readonly SafeAreaEdge[] | Readonly<Partial<Record<SafeAreaEdge, 'additive' | 'maximum' | 'off'>>>;

let registered = false;

/**
 * `safe-area-view` already had a mapping - React Native's own `SafeAreaView`, which is iOS-only,
 * insets every edge and is deprecated upstream - so this replaces it. An app without
 * `react-native-safe-area-context` installed therefore renders an unimplemented view rather than
 * the old behaviour, which is the honest failure: the alternative is a view that silently insets
 * nothing on half the platforms it runs on.
 */
export function registerSafeAreaComponents(): void {
  if (registered) return;
  registered = true;
  registerViewName('safe-area-view', 'RNCSafeAreaView');
  registerViewName('safe-area-provider', 'RNCSafeAreaProvider', { flex: 1 });
}
