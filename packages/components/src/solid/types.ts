import type { HostNode, NativeSyntheticEvent, WindowFrame } from '@solidnative/fabric';
import type { HostChild } from '@solidnative/platform/solid';
import type {
  Insets,
  LayoutEvent,
  TouchEvent,
  KeyPressEvent,
  TextInputEditingEvent,
  TextInputContentSizeEvent,
  TextInputScrollEvent,
} from '../events.ts';

export type NativeStyle = Record<string, unknown> | readonly unknown[] | null;
export interface NativeRef {
  readonly node: HostNode;
  isAttached(): boolean;
  /** Commands are deferred until the next host commit; disposed refs do nothing. */
  dispatchCommand(name: string, args?: readonly unknown[]): void;
  focus(): void;
  measure(callback: (frame: WindowFrame) => void): void;
}
export interface TextSelection {
  readonly start: number;
  readonly end?: number;
}
export interface TextInputRef extends NativeRef {
  blur(): void;
  /** Propose an empty value; a controlled parent may reject it. */
  clear(): void;
  isFocused(): boolean;
  setSelection(start: number, end?: number): void;
}
export interface AccessibilityState {
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly checked?: boolean | 'mixed';
  readonly busy?: boolean;
  readonly expanded?: boolean;
}
export interface AccessibilityValue {
  readonly min?: number;
  readonly max?: number;
  readonly now?: number;
  readonly text?: string;
}
export interface ViewProps {
  children?: HostChild;
  ref?: (ref: NativeRef) => void;
  style?: NativeStyle;
  class?: string;
  classList?: Record<string, boolean | undefined>;
  id?: string;
  nativeID?: string;
  testID?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
  'aria-label'?: string;
  accessibilityLabelledBy?: string | readonly string[];
  'aria-labelledby'?: string | readonly string[];
  accessibilityHint?: string;
  accessibilityRole?: string;
  role?: string;
  accessibilityState?: AccessibilityState;
  'aria-disabled'?: boolean;
  'aria-checked'?: boolean | 'mixed';
  'aria-busy'?: boolean;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  accessibilityValue?: AccessibilityValue;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
  accessibilityActions?: readonly { name: string; label?: string }[];
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  'aria-live'?: 'off' | 'polite' | 'assertive';
  accessibilityElementsHidden?: boolean;
  'aria-hidden'?: boolean;
  accessibilityViewIsModal?: boolean;
  'aria-modal'?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  accessibilityLanguage?: string;
  focusable?: boolean;
  tabIndex?: 0 | -1;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  hitSlop?: Insets | number;
  collapsable?: boolean;
  onLayout?: (event: LayoutEvent) => void;
  onTouchStart?: (event: TouchEvent) => void;
  onTouchMove?: (event: TouchEvent) => void;
  onTouchEnd?: (event: TouchEvent) => void;
  onTouchCancel?: (event: TouchEvent) => void;
  onFocus?: (event: NativeSyntheticEvent) => void;
  onBlur?: (event: NativeSyntheticEvent) => void;
  onAccessibilityAction?: (event: NativeSyntheticEvent<{ actionName: string }>) => void;
  [key: `data-${string}`]: unknown;
}
export interface PressableState {
  readonly pressed: boolean;
  readonly hovered: boolean;
}
export interface PressBehaviorProps {
  disabled?: boolean;
  cancelable?: boolean;
  pressRetentionOffset?: Insets | number;
  delayPressIn?: number;
  delayPressOut?: number;
  delayLongPress?: number;
  minPressDuration?: number;
  onPress?: (event: TouchEvent) => void;
  onPressIn?: (event: TouchEvent) => void;
  onPressOut?: (event: TouchEvent) => void;
  onLongPress?: (event: TouchEvent) => void;
}
/** Android's ripple, drawn natively. `foreground` paints it over the content rather than behind. */
export interface AndroidRipple {
  color?: string | number;
  borderless?: boolean;
  radius?: number;
  foreground?: boolean;
}
export interface PressableProps extends Omit<ViewProps, 'children' | 'style'>, PressBehaviorProps {
  /** Android: a native ripple on press. */
  android_ripple?: AndroidRipple;
  children?: HostChild | ((state: PressableState) => HostChild);
  style?: NativeStyle | ((state: PressableState) => NativeStyle);
}
export interface TextProps extends ViewProps, PressBehaviorProps {
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  selectable?: boolean;
  selectionColor?: string;
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number;
  suppressHighlighting?: boolean;
}
export interface FormStateProps {
  disabled?: boolean;
  invalid?: boolean;
  touched?: boolean;
  onTouched?: () => void;
}
export interface TextChangePayload {
  text?: string;
  eventCount?: number;
  /** Host-supplied composition signal; availability depends on the native input. */
  isComposing?: boolean;
}
export type KeyboardType =
  | 'default'
  | 'number-pad'
  | 'decimal-pad'
  | 'numeric'
  | 'email-address'
  | 'phone-pad'
  | 'url'
  | 'ascii-capable'
  | 'numbers-and-punctuation'
  | 'name-phone-pad'
  | 'twitter'
  | 'web-search'
  | 'visible-password';
export type ReturnKeyType =
  | 'done'
  | 'go'
  | 'next'
  | 'search'
  | 'send'
  | 'none'
  | 'previous'
  | 'default'
  | 'emergency-call'
  | 'google'
  | 'join'
  | 'route'
  | 'yahoo';
export type SubmitBehavior = 'submit' | 'blurAndSubmit' | 'newline';
export interface TextInputProps extends Omit<ViewProps, 'children' | 'ref'>, FormStateProps {
  ref?: (ref: TextInputRef) => void;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: (event: NativeSyntheticEvent<TextChangePayload>) => void;
  /** Accepted native changes, including proposals rejected by a controlled parent. */
  onChangeText?: (text: string) => void;
  readOnly?: boolean;
  editable?: boolean;
  multiline?: boolean;
  scrollEnabled?: boolean;
  placeholder?: string;
  placeholderTextColor?: string;
  keyboardType?: KeyboardType;
  returnKeyType?: ReturnKeyType;
  submitBehavior?: SubmitBehavior;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  /** Autofill hint; common web names are translated to the native platform's names. */
  autoComplete?: string;
  /** Explicit iOS content hint, taking precedence over autoComplete's iOS mapping. */
  textContentType?: string;
  /** iOS: nativeID of the InputAccessoryView shown above this input's keyboard. */
  inputAccessoryViewID?: string;
  autoFocus?: boolean;
  maxLength?: number;
  numberOfLines?: number;
  selection?: TextSelection;
  selectionColor?: string;
  selectTextOnFocus?: boolean;
  caretHidden?: boolean;
  contextMenuHidden?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number;
  clearButtonMode?: 'never' | 'while-editing' | 'unless-editing' | 'always';
  clearTextOnFocus?: boolean;
  enablesReturnKeyAutomatically?: boolean;
  keyboardAppearance?: 'default' | 'light' | 'dark';
  passwordRules?: string;
  spellCheck?: boolean;
  smartInsertDelete?: boolean;
  dataDetectorTypes?: string | readonly string[];
  cursorColor?: string;
  selectionHandleColor?: string;
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
  importantForAutofill?: 'auto' | 'no' | 'noExcludeDescendants' | 'yes' | 'yesExcludeDescendants';
  showSoftInputOnFocus?: boolean;
  disableFullscreenUI?: boolean;
  inlineImageLeft?: string;
  inlineImagePadding?: number;
  textBreakStrategy?: 'simple' | 'highQuality' | 'balanced';
  underlineColorAndroid?: string;
  onSelectionChange?: (
    event: NativeSyntheticEvent<{ selection: TextSelection; eventCount?: number }>,
  ) => void;
  onSubmitEditing?: (event: TextInputEditingEvent) => void;
  onEndEditing?: (event: TextInputEditingEvent) => void;
  onKeyPress?: (event: KeyPressEvent) => void;
  onContentSizeChange?: (event: TextInputContentSizeEvent) => void;
  onScroll?: (event: TextInputScrollEvent) => void;
}
export interface SwitchProps extends Omit<ViewProps, 'children'>, FormStateProps {
  value?: boolean;
  defaultValue?: boolean;
  onValueChange?: (value: boolean) => void;
  onChange?: (event: NativeSyntheticEvent<{ value?: boolean }>) => void;
  thumbColor?: string;
  trackColor?: { readonly false?: string; readonly true?: string };
  ios_backgroundColor?: string;
}
