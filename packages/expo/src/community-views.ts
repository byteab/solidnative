/**
 * Native views from the libraries an Expo app already reaches for, by element name.
 *
 * These are not Expo modules, so their Fabric names are their own - what codegen produced from
 * each library's spec - rather than the `ViewManagerAdapter_` names `registerExpoView` derives.
 * They are here because they are in Expo's own bundled module list, which is the list an app
 * actually installs from, and because the alternative is every app looking each name up in a
 * library's generated code.
 *
 * Names and defaults, not components. A wrapper component per native view, prop for prop, is a
 * maintenance burden with no end and a second place for every prop to be wrong. An app writes the
 * small component for the one it uses - the element, and a typed prop per prop it passes through -
 * which keeps its JSX checked; see `ExpoImage` for the shape.
 *
 * A library still has to be installed for its element to commit as anything. This is the
 * JavaScript half; an element whose native side is missing commits as `UnimplementedNativeView`.
 */
import { registerViewName } from '@solidnative/fabric';

/** Element name -> the Fabric component name, and the props its React wrapper would default. */
export const NATIVE_VIEWS: Readonly<Record<string, [string, Record<string, unknown>?]>> = {
  /** `react-native-webview`. */
  'web-view': ['RNCWebView', { javaScriptEnabled: true, domStorageEnabled: true }],
  /** `@react-native-community/slider`. */
  slider: ['RNCSlider', { maximumValue: 1, minimumValue: 0, step: 0 }],
  /** `@react-native-community/datetimepicker`. Android renders a dialog, iOS an inline view. */
  'date-time-picker': ['RNDateTimePicker'],
  /** `@react-native-picker/picker`, whose items are `<picker-item>` children. */
  picker: ['RNCPicker'],
  'picker-item': ['RNCPickerItem'],
  /**
   * `@react-native-segmented-control/segmented-control`. iOS only.
   *
   * A view manager from before Fabric, run through the interop layer, which only installs the
   * `onChange` block when the prop is set - as React's handler does by being there. Without it
   * the control changes on screen and nothing hears about it.
   */
  'segmented-control': ['RNCSegmentedControl', { onChange: true }],
  /** `@react-native-masked-view/masked-view`: its `maskElement` is a prop, not a child. */
  'masked-view': ['RNCMaskedView'],
  /** `react-native-pager-view`, the swipeable pager a tab layout is built on. */
  'pager-view': ['RNCViewPager', { initialPage: 0 }],
  /** `lottie-react-native`. */
  'lottie-view': ['LottieAnimationView', { autoPlay: true, loop: true }],
  /**
   * `@shopify/react-native-skia`.
   *
   * The view is real and this name is right, but it is worth being plain: Skia's drawing model is
   * React elements through a reconciler of its own - `<Canvas><Path/></Canvas>` - and none of that
   * is reachable here. What a `<skia-view>` will take is a `picture`, built with Skia's imperative
   * `PictureRecorder` API, which has no React in it. Anything drawn declaratively does not come
   * across, and a component that renders nothing is what that looks like.
   */
  'skia-view': ['SkiaPictureView'],
  /** `react-native-view-shot`, which captures whatever it wraps. */
  'view-shot': ['RNCViewShot'],
};

/**
 * Register several of the known views by element name.
 *
 * ```ts
 * registerNativeViews('web-view', 'slider');
 * ```
 *
 * Named one at a time rather than all at once on purpose: registering a view for a library the
 * app has not installed produces an element that commits as nothing, and finding out at startup
 * which libraries are present is not something JavaScript can do without importing them all.
 */
export function registerNativeViews(...elements: readonly (keyof typeof NATIVE_VIEWS)[]): void {
  for (const element of elements) {
    const known = NATIVE_VIEWS[element];
    if (!known) throw new Error(`[solid-native] no native view is known as '${element}'`);
    registerViewName(element, known[0], known[1]);
  }
}
