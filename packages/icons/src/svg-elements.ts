/**
 * react-native-svg, driven directly.
 *
 * The same arrangement as react-native-screens in the router: the native side is a set of
 * codegen'd Fabric components, and their React wrappers are unreachable, so the engine is taught
 * the element names and the shapes are created with `createElement`. The app installs
 * `react-native-svg` for the native half; none of its JavaScript is imported.
 *
 * No decorators here: tests import this at runtime.
 */
import { nativePlatform, registerViewName } from '@solidnative/fabric';

/**
 * Element name -> Fabric component. Lowercase, because the compiler drops a template with a
 * capitalized element name, and prefixed, because `path` and
 * `line` are words an app might reasonably want for a component of its own.
 *
 * The root is the one that differs per platform: iOS draws into `RNSVGSvgView`, Android into
 * `RNSVGSvgViewAndroid`, and react-native-svg keeps them as separate specs because their props
 * are not the same.
 */
const SVG_VIEW_NAMES: Record<string, string> = {
  'svg-g': 'RNSVGGroup',
  'svg-path': 'RNSVGPath',
  'svg-circle': 'RNSVGCircle',
  'svg-ellipse': 'RNSVGEllipse',
  'svg-rect': 'RNSVGRect',
  'svg-line': 'RNSVGLine',
};

/**
 * The roots: element name -> Fabric component, same iOS/Android split as the shapes above.
 * `svg-icon` is `Icon`'s own host; a list because nothing stops two element names sharing one
 * native view.
 */
const SVG_ROOT_NAMES = ['svg-icon'];

let registered = false;

/**
 * Teach the engine the shape elements and both roots. Called by `Icon` and `ChartSvg`, so
 * importing either component is the whole setup - the same lesson as `AnimatedStyle`, which
 * stopped needing a bootstrap provider for the same reason. Exported for an app driving the
 * shapes directly.
 *
 * A name the native side does not know renders as `UnimplementedNativeView` rather than erroring,
 * so an app that has not installed `react-native-svg` sees blank boxes where its icons were.
 */
export function registerSvgComponents(): void {
  if (registered) return;
  registered = true;
  const rootViewName = nativePlatform() === 'android' ? 'RNSVGSvgViewAndroid' : 'RNSVGSvgView';
  for (const root of SVG_ROOT_NAMES) {
    registerViewName(root, rootViewName);
  }
  for (const [element, viewName] of Object.entries(SVG_VIEW_NAMES)) {
    registerViewName(element, viewName);
  }
}
