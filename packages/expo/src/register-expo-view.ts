/**
 * Expo's native views, driven directly.
 *
 * An Expo module that renders something registers a Fabric component whose name it derives
 * rather than declares, and `requireNativeViewManager` is the only place that derivation is
 * written down. Everything else that function does is React: it caches a host component, builds
 * a view config for React's renderer, and wraps the result in a class whose whole job is to hold
 * a ref. None of that is reachable without React, and none of it is needed - the engine writes
 * props onto the shadow node itself, and Expo's Fabric views take their props as an untyped map,
 * so there is no codegen'd prop list to satisfy.
 *
 * What is left is the name. That is what this package is.
 *
 * No components here on purpose: this is a registration, and the views it registers are ordinary
 * native elements in JSX.
 */
import { registerViewName } from '@solidnative/fabric';

/**
 * What Expo installs on the global when the app starts. Only the app identifier matters here;
 * `getViewConfig` is for React's renderer, which never runs.
 */
interface ExpoGlobal {
  readonly __expo_app_identifier__?: string;
}

/**
 * The Fabric component name for a module's view, exactly as `requireNativeViewManager` computes
 * it in `expo-modules-core`.
 *
 * The app identifier is the part that cannot be hardcoded. Expo Go runs many projects in one
 * binary, so it namespaces every view name with a per-app suffix; a standalone build has no
 * identifier and no suffix. Get it wrong and the view commits as `UnimplementedNativeView`
 * with no error, which is the same failure mode as a misspelled name.
 *
 * A module with more than one view names the extra ones (`viewName`); the default view is the
 * module itself.
 */
export function expoViewName(moduleName: string, viewName?: string): string {
  const identifier = (globalThis as { expo?: ExpoGlobal }).expo?.__expo_app_identifier__ ?? '';
  const suffix = identifier ? `_${identifier}` : '';
  const module = viewName ? `${moduleName}_${viewName}` : moduleName;
  return `ViewManagerAdapter_${module}${suffix}`;
}

export interface ExpoViewOptions {
  /** A named view on a module that has several. Omit for the module's default view. */
  readonly viewName?: string;
  /**
   * Props the module's React component would have applied before native saw them. Expo's
   * wrappers do less of this than React Native's, but they do some: `expo-image` resolves a
   * source to an array and a `contentFit` to a string native understands.
   */
  readonly defaultProps?: Record<string, unknown>;
}

/**
 * Teach the engine an element name for an Expo module's view, e.g.
 * `registerExpoView('expo-image', 'ExpoImage')` makes `<expo-image>` commit as one.
 *
 * Call it at startup, before the first commit that uses the element. The app must have the
 * module installed so the native side registers the component; this is the JavaScript half only.
 */
export function registerExpoView(
  elementName: string,
  moduleName: string,
  options?: ExpoViewOptions,
): void {
  registerViewName(elementName, expoViewName(moduleName, options?.viewName), options?.defaultProps);
}

/**
 * The views worth knowing the names of, so an app does not have to look each one up.
 *
 * Deliberately names and defaults, not components. A wrapper component per Expo view, prop for
 * prop, is a maintenance burden with no end and a second place for every prop to be wrong; the
 * element plus the module's own documentation covers the common case, and an app that wants a
 * nicer surface writes the one component it actually needs.
 *
 * A module still has to be installed for its element to commit as anything: this is the
 * JavaScript half. An element whose native side is missing commits as `UnimplementedNativeView`.
 */
export const EXPO_VIEWS: Readonly<Record<string, [string, ExpoViewOptions?]>> = {
  /** `expo-image`. Takes `source` as a list, so a single `{uri}` is wrapped by the caller. */
  'expo-image': ['ExpoImage', { defaultProps: { contentFit: 'cover' } }],
  /** `expo-blur`. The one thing CSS cannot express: a blur of what is *behind* a view. */
  'expo-blur': ['ExpoBlurView', { defaultProps: { intensity: 50, tint: 'default' } }],
  /** `expo-video`. The player itself is a shared object the module hands out; this is its view. */
  'expo-video': ['ExpoVideo', { viewName: 'VideoView' }],
  /**
   * `expo-camera`. Its module's first view, so its default: `ExpoCamera_CameraView` exists only on
   * iOS, after the Swift class, and commits as nothing on Android. `Camera` takes its pictures.
   */
  'expo-camera': ['ExpoCamera'],
  /** `expo-apple-authentication`: Apple's Sign in with Apple button. iOS only. */
  'apple-sign-in-button': ['ExpoAppleAuthentication'],
  /** `expo-symbols`: SF Symbols, iOS only, and the reason `icons` is not needed for them. */
  'expo-symbol': ['SymbolModule', { defaultProps: { type: 'monochrome' } }],
  /** `expo-gl`, whose context is reached through an event rather than a prop. */
  'expo-gl': ['ExpoGL'],
  /** `expo-glass-effect`: the iOS 26 material. Renders as a plain view where it is unavailable. */
  'expo-glass': ['ExpoGlassEffect', { viewName: 'GlassView' }],
  /** Glass views that merge into one another when they come within `spacing` points. */
  'expo-glass-container': ['ExpoGlassEffect', { viewName: 'GlassContainer' }],
  /** `expo-mesh-gradient`: the one gradient CSS cannot express, because it has no CSS spelling. */
  'expo-mesh-gradient': ['ExpoMeshGradient', { viewName: 'MeshGradientView' }],
  /** `expo-live-photo`, iOS only. */
  'expo-live-photo': ['ExpoLivePhoto', { viewName: 'LivePhotoView' }],
  /**
   * `expo-maps`, Google's on Android and Apple's on iOS: two modules, each with one view, so each
   * its module's default. `ExpoMaps` itself is the permissions module and has no view.
   * `MapView` (`<expo-map>`) types both as one element.
   */
  'expo-maps-google': ['ExpoGoogleMaps'],
  'expo-maps-apple': ['ExpoAppleMaps'],
};

/**
 * Register several of the known views by element name.
 *
 * ```ts
 * registerExpoViews('expo-image', 'expo-blur');
 * ```
 *
 * Named one at a time rather than all at once on purpose: registering a view for a module the app
 * has not installed produces an element that commits as nothing, and finding out at startup which
 * modules are present is not something JavaScript can do without importing them all.
 */
export function registerExpoViews(...elements: readonly (keyof typeof EXPO_VIEWS)[]): void {
  for (const element of elements) {
    const known = EXPO_VIEWS[element];
    if (!known) throw new Error(`[solidnative] no Expo view is known as '${element}'`);
    registerExpoView(element, known[0], known[1]);
  }
}
