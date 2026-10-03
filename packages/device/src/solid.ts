/** Scoped Solid services; optional native modules are imported by their own capabilities. */
export { reactNative, type ReactNative, type NativeKeyboardEvent } from './react-native.ts';
export { AppState, appStateSource } from './solid/app-state.ts';
export type { AppStateSource, AppStatus } from './solid/app-state.ts';
export { Dialogs, dialogSource } from './solid/dialogs.ts';
export type { Choice, NativeDialogs } from './solid/dialogs.ts';
export {
  Direction,
  directionSource,
  type DirectionContext,
  type DirectionSource,
  type LayoutDirection,
} from './solid/direction.ts';
export {
  androidPermission,
  androidPermissionOf,
  type AndroidPermissions,
  type PermissionAnswer,
} from './solid/android-permissions.ts';
export { Sharing, sharingSource, type NativeSharing, type ShareRequest } from './solid/sharing.ts';
export { Vibration, type NativeVibration } from './solid/vibration.ts';
export { DevMenu, type DevMenuSource, type NativeDevMenu } from './solid/dev-menu.ts';
export {
  LayoutAnimation,
  type LayoutChange,
  type LayoutEasing,
  type NativeLayoutAnimation,
} from './solid/layout-animation.ts';
export {
  createServiceToken,
  provideService,
  ServiceScope,
  withServiceScope,
  useService,
  type ServiceToken,
  type ServiceBinding,
  type ServiceScopeProps,
} from './solid/service-scope.ts';
export { createObserved, type ObservedSource } from './solid/observed.ts';
export {
  ColorScheme,
  colorSchemeSource,
  type ColorSchemeSource,
  type Scheme,
} from './solid/color-scheme.ts';
export {
  SafeArea,
  createSafeArea,
  type SafeAreaSource,
  type SafeAreaMetrics,
  type Insets,
  type Frame,
} from './solid/safe-area.ts';
export {
  StatusBar,
  statusBarSource,
  useStatusBar,
  type StatusBarStyle,
  type StatusBarState,
  type StatusBarSource,
} from './solid/status-bar.ts';
export { SCREEN_IN_FRONT } from './solid/screen-in-front.ts';
export {
  Keyboard,
  keyboardSource,
  type KeyboardMetrics,
  type KeyboardSource,
} from './solid/keyboard.ts';
export { Screen, COMPACT_WIDTH } from './solid/screen.ts';
export {
  DeepLinks,
  Linking,
  deepLinkSource,
  pathOf,
  type DeepLinkSource,
} from './solid/deep-links.ts';
export {
  HardwareBack,
  BackHandler,
  hardwareBackSource,
  type HardwareBackSource,
} from './solid/hardware-back.ts';
export {
  Accessibility,
  accessibilitySource,
  type AccessibilitySettings,
  type AccessibilitySource,
} from './solid/accessibility.ts';
export {
  currentConditions,
  deviceTokens,
  watchConditions,
  type ConditionHost,
  type WatchOptions,
} from './solid/conditions.ts';
export {
  conditionSources,
  conditionSettingsSource,
  screenSource,
  type ConditionSources,
  type ConditionSettings,
  type ConditionSettingsSource,
  type Size,
  type Sizes,
  type ScreenSource,
} from './solid/condition-sources.ts';
