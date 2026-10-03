/**
 * react-native-screens, driven directly.
 *
 * The native half of navigation already exists as codegen'd Fabric components. We register their
 * names and drive them with `createNode`; their React components are unreachable (hooks) and
 * `react-navigation` is not a dependency.
 *
 * Pure registration data: this native path imports no framework or upstream React component.
 */
import { registerHoist, registerViewName } from '@solid-native/fabric';

/**
 * Element name -> codegen'd Fabric component name, and the base style that component's React
 * wrapper would have applied in JS. The Solid adapter uses these shared lowercase host names behind semantic components.
 *
 * The header's styles are `ScreenStackHeaderConfig.tsx`'s own, and the absolute positioning is
 * load-bearing: without it the config view takes part in the screen's flex layout and every page
 * renders a header's height too far down. `alignItems` is iOS-only there; it is harmless on
 * Android, where the native side lays the bar out itself.
 */
export const SCREEN_VIEW_NAMES: Record<string, [viewName: string, defaults?: object]> = {
  // NativeStackOutlet's own host element is the stack.
  'native-stack-outlet': ['RNSScreenStack'],
  // Created by the outlet, one per activated route; nobody writes this in a template.
  screen: ['RNSScreen'],
  'native-header': [
    'RNSScreenStackHeaderConfig',
    {
      position: 'absolute',
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  ],
  // Placed in a `<native-header-item type="searchBar">`, as react-native-screens places its own.
  'native-search-bar': ['RNSSearchBar'],
  'native-header-item': [
    'RNSScreenStackHeaderSubview',
    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ],
  // Insets by what the screen it is in says is covered, the tab bar included. See
  // `tab-safe-area-view.ts`. The same name on both platforms.
  'tab-safe-area-view': ['RNSSafeAreaView'],
};

/**
 * The tabs half, which react-native-screens names per platform rather than sharing one component:
 * `RNSTabsHostIOS` wraps a `UITabBarController`, `RNSTabsHostAndroid` a bottom navigation bar,
 * and their props differ enough that the codegen specs are separate files.
 *
 * The fills are `TabsHost.ios.tsx`'s and `TabsScreen.ios.tsx`'s own. A tab screen is positioned
 * absolutely because it is one of several occupying the same space, only one of which is visible.
 */
const TAB_VIEW_NAMES: Record<string, [ios: string, android: string, defaults?: object]> = {
  'native-tabs-outlet': [
    'RNSTabsHostIOS',
    'RNSTabsHostAndroid',
    { flex: 1, width: '100%', height: '100%' },
  ],
  'native-tab': [
    'RNSTabsScreenIOS',
    'RNSTabsScreenAndroid',
    { position: 'absolute', flex: 1, width: '100%', height: '100%' },
  ],
};

/**
 * How visible a screen is. The native stack keeps every screen mounted and reads this rather
 * than adding and removing views, which is what preserves a pushed-away screen's native state.
 *
 * `Screen.tsx` throws if this ever *decreases* while in a native stack, so a screen goes
 * 0 -> 2 on push and is removed outright on pop rather than walked back down.
 */
export const ActivityState = {
  /** Off screen, and a candidate for freezing. */
  Inactive: 0,
  /** Mid transition: on screen but not the target. */
  Transitioning: 1,
  /** The screen the user is on. */
  Active: 2,
} as const;

export type ActivityStateValue = (typeof ActivityState)[keyof typeof ActivityState];

/**
 * Call once at startup, before the first navigation.
 *
 * The app must also have `react-native-screens` installed so the native side registers these
 * components; this only teaches the engine the element-to-view-name mapping. A name the native
 * side does not know renders as `UnimplementedNativeView`, not an error. None of its JavaScript
 * is imported - Expo Go happens to bundle the native half, which is why the canary worked before
 * it declared the dependency at all, and why an app that forgets it fails only once it ships.
 */
export function registerScreenComponents(): void {
  for (const [element, [viewName, defaults]] of Object.entries(SCREEN_VIEW_NAMES)) {
    registerViewName(element, viewName, defaults as Record<string, unknown> | undefined);
  }
  // By platform, chosen when the view is looked up: registration may run before the native root reports the platform.
  // A window of its own on iOS; see `full-window-overlay.ts`. Its fill is the component's.
  registerViewName('full-window-overlay', { ios: 'RNSFullWindowOverlay', android: 'RCTView' });
  for (const [element, [ios, android, defaults]] of Object.entries(TAB_VIEW_NAMES)) {
    registerViewName(element, { ios, android }, defaults as Record<string, unknown>);
  }
  // `findHeaderConfig` in `RNSScreen.mm` looks at the screen's direct children and no deeper, so
  // a header a page wrote inside a `safe-area-view` or a component of its own commits beside it.
  // Nothing in `RNSScreen.mm` updates the bar when its config is unmounted, so a conditionally removed header
  // leaves a config behind that hides the bar, and one that comes back adopts it.
  registerHoist('native-header', 'screen', { standIn: { hidden: true } });
}
