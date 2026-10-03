/** Solid host primitives. Native-only handles remain in the platform adapter. */
export { View, Text } from './solid/primitive.ts';
export { Pressable } from './solid/pressable.ts';
export { ActivityIndicator, type ActivityIndicatorProps } from './solid/activity-indicator.ts';
export {
  KEYBOARD_CONTROLLER,
  provideKeyboardController,
  KeyboardControllerProvider,
  type KeyboardControllerProviderProps,
} from './solid/keyboard-controller.ts';
export { TextInput } from './solid/text-input.ts';
export { Switch } from './solid/switch.ts';
export { SafeAreaProvider, type SafeAreaProviderProps } from './solid/safe-area-provider.ts';
export {
  SafeAreaView,
  type SafeAreaViewProps,
  type SafeAreaEdge,
  type SafeAreaEdges,
  type SafeAreaEdgeMode,
} from './solid/safe-area-view.ts';
export {
  ScrollView,
  type ScrollViewProps,
  type ScrollViewRef,
  type ScrollEvent,
  type ScrollPayload,
} from './solid/scroll-view.ts';
export type {
  NativeStyle,
  NativeRef,
  TextInputRef,
  AccessibilityState,
  AccessibilityValue,
  ViewProps,
  TextProps,
  PressBehaviorProps,
  PressableProps,
  FormStateProps,
  TextChangePayload,
  TextInputProps,
  SwitchProps,
  PressableState,
  AndroidRipple,
  TextSelection,
} from './solid/types.ts';

export {
  VirtualList,
  type VirtualListProps,
  type VirtualListRef,
  type VirtualRow,
  type VirtualListViewability,
  type VirtualItemHeight,
  type VirtualListVisiblePosition,
} from './solid/virtual-list.ts';
export {
  SectionList,
  type SectionListProps,
  type SectionListRef,
  type SectionListSection,
} from './solid/section-list.ts';
export { RefreshControl, type RefreshControlProps } from './solid/refresh-control.ts';
export {
  Image,
  type ImageProps,
  type ImageSource,
  type ImageURISource,
  type ImageResizeMode,
} from './solid/image.ts';
export { ImageBackground, type ImageBackgroundProps } from './solid/image-background.ts';
export {
  Modal,
  type ModalProps,
  type ModalPresentationStyle,
  type ModalOrientation,
} from './solid/modal.ts';
export { TouchableOpacity, type TouchableOpacityProps } from './solid/touchable-opacity.ts';
export { InputAccessoryView, type InputAccessoryViewProps } from './solid/input-accessory-view.ts';
export {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
  type KeyboardAvoidingBehavior,
} from './solid/keyboard-avoiding-view.ts';
export { GestureRoot } from './solid/gesture-root.ts';
export {
  AnimatedStyle,
  WorkletStyle,
  WorkletScroll,
  NativeGesture,
  type RefBinding,
  type BindingSpec,
  type AnimationBackend,
  type AnimatedPropsHandle,
  type WorkletBackend,
  type WorkletStyleSpec,
  type WorkletScrollSpec,
  type SharedValue,
  type WorkletTarget,
  type GestureBackend,
  type GestureSpec,
  type GestureTarget,
} from './solid/animation-bindings.ts';
export { workletStyle, workletScroll } from './solid/worklets.ts';

/** Shared native prop/ref contracts for optional native view adapters. */
export { hostProps } from './solid/primitive.ts';
export { createNativeRef } from './solid/ref.ts';

export { Presence, type PresenceProps } from './solid/presence.ts';
export {
  KeyboardDock,
  KeyboardLift,
  type KeyboardDockProps,
  type KeyboardDockRef,
} from './solid/keyboard-dock.ts';
export type { KeyboardType, ReturnKeyType, SubmitBehavior } from './solid/types.ts';

export * from './solid/forms.ts';
export * from './solid/forms-rules.ts';
export type * from './solid/forms-types.ts';

/** The `nativeEvent` payloads native sends, so a handler can be typed rather than cast. */
export type * from './events.ts';
