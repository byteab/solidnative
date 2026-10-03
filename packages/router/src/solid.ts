/** Direct native stacks and retained Solid route ownership, independent of DOM routing. */
export { createRouteOwner, type RouteOwner, type RouteOwnerOptions } from './solid/route-owner.ts';
export {
  createRetainedStack,
  type RetainedStack,
  type StackTransition,
  type StackTransitionOptions,
} from './solid/retained-stack.ts';
export {
  createNativeNavigation,
  type NativeNavigation,
  type NativeNavigationOptions,
  type NativeNavigationActionOptions,
  type PresentOptions,
  type NativeRoute,
  type NativeRouteProps,
  type NativeRouteComponent,
  type NativeRouteEntry,
  type NavigationContext,
  type NativeStackEvents,
} from './solid/native-navigation.ts';
export { NativeStackOutlet, type NativeStackOutletProps } from './solid/native-stack-outlet.ts';
export { NativeHeader, type NativeHeaderProps } from './solid/native-header.ts';
export {
  NativeHeaderItem,
  type NativeHeaderItemProps,
  type HeaderItemType,
} from './solid/native-header-item.ts';
export { useNativeDismissGuard } from './solid/native-dismiss.ts';
export { FullWindowOverlay, type FullWindowOverlayProps } from './solid/full-window-overlay.ts';
export {
  TabSafeAreaView,
  type TabSafeAreaViewProps,
  type TabSafeAreaEdge,
} from './solid/tab-safe-area-view.ts';
export { useNavigation, useRoute } from './solid/route-context.ts';
export {
  bindNativeNavigation,
  followLink,
  linkAncestry,
  type LinkParent,
  type NavigationLinks,
  type NavigationBack,
  type NativeNavigationBinding,
  type NativeNavigationBindingOptions,
} from './solid/native-links.ts';
export {
  NativeBarDefaults,
  DEFAULT_HEADER_PALETTE,
  type NativeBarDefaultsProps,
  type HeaderDefaults,
  type TabDefaults,
  type SchemeDefaults,
} from './solid/native-bar-defaults.ts';
export {
  NativeTabsOutlet,
  type NativeTabsOutletProps,
  type NativeTabProps,
} from './solid/native-tabs-outlet.ts';
export {
  tabIconProps,
  type TabIcon,
  type TabSystemItem,
  type TabBarBlurEffect,
  type TabStateAppearance,
  type TabItemAppearance,
  type TabAppearance,
  type TabIconProps,
} from './solid/tab-appearance.ts';
export {
  ActivityState,
  registerScreenComponents,
  type ActivityStateValue,
} from './solid/screens.ts';
export type { RouteLocation, RouteMatch, RouteData, RouteQuery } from './solid/route-match.ts';
export type {
  ScreenPresentation,
  StackPresentation,
  StackAnimation,
  SwipeDirection,
  ReplaceAnimation,
  GestureResponseDistance,
} from './solid/screen-presentation.ts';

export {
  NativeSearchBar,
  type NativeSearchBarProps,
  type NativeSearchBarRef,
  type SearchBarPlacement,
} from './solid/native-search-bar.ts';
