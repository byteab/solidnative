/**
 * `@expo/ui`: real SwiftUI and Jetpack Compose views, as elements.
 *
 * This is the closest thing in the ecosystem to what this project is for. Every one of these is a
 * platform control - a real `Picker`, a real `BottomSheet`, a real `Gauge` - rather than something
 * drawn to look like one, and `@expo/ui` reaches them through `requireNativeView('ExpoUI', ...)`,
 * which is the same derivation `registerExpoView` already mirrors. So the whole surface is
 * available here for the price of a table of names.
 *
 * The element names are platform-neutral where both platforms have the control, because an app
 * should write `<ui-slider>` once. Where only one platform has it - a `Gauge` is SwiftUI's, a
 * `SearchBar` is Compose's - the element exists only there, and registering for the wrong platform
 * would be an element that commits as nothing.
 *
 * ```ts
 * registerExpoUiViews(Platform.OS);
 * ```
 * ```html
 * <ui-host style="height: 44">
 *   <ui-slider [value]="volume()" (valueChanged)="volume.set($event.value)" />
 * </ui-host>
 * ```
 *
 * **A `<ui-host>` is required around any of these.** SwiftUI and Compose lay out their own
 * subtrees, and the host view is what bridges Yoga's layout to theirs; without one the control has
 * no size and does not appear - which looks exactly like a module that failed to install.
 *
 * Names, not components. There are ninety-odd of these, each with its own props and its own
 * modifier system, and a component per view prop-for-prop would be a second place for every one of
 * them to be wrong. The module's own documentation describes the props; this makes them reachable.
 */
import { registerExpoView } from './register-expo-view.ts';

/** Host platform values accepted without importing React Native declarations. */
export type ExpoViewPlatform = 'ios' | 'android' | 'macos' | 'windows' | 'web' | 'native';

/** Element name -> the `ExpoUI` view on iOS and on Android. Null where the platform has no such. */
export const EXPO_UI_VIEWS: Readonly<Record<string, readonly [string | null, string | null]>> = {
  'accessory-widget-background': ['AccessoryWidgetBackgroundView', null],
  alert: ['AlertView', 'AlertDialogView'],
  'animated-visibility': [null, 'AnimatedVisibilityView'],
  'assist-chip': [null, 'AssistChipView'],
  background: ['BackgroundView', null],
  badge: [null, 'BadgeView'],
  'badged-box': [null, 'BadgedBoxView'],
  'basic-alert-dialog': [null, 'BasicAlertDialogView'],
  'bottom-sheet': ['BottomSheetView', 'ModalBottomSheetView'],
  button: ['Button', null],
  capsule: ['CapsuleView', null],
  chart: ['ChartView', null],
  checkbox: [null, 'CheckboxView'],
  circle: ['CircleView', null],
  'color-picker': ['ColorPickerView', null],
  'confirmation-dialog': ['ConfirmationDialogView', null],
  'content-unavailable': ['ContentUnavailableView', null],
  'context-menu': ['ContextMenu', null],
  'control-group': ['ControlGroupView', null],
  'date-picker': ['DatePickerView', 'DateTimePickerView'],
  'date-picker-dialog': [null, 'DatePickerDialogView'],
  'disclosure-group': ['DisclosureGroupView', null],
  divider: ['DividerView', null],
  'docked-search-bar': [null, 'DockedSearchBarView'],
  ellipse: ['EllipseView', null],
  'exposed-dropdown-menu-box': [null, 'ExposedDropdownMenuBoxView'],
  'filter-chip': [null, 'FilterChipView'],
  'floating-action-button': [null, 'FloatingActionButtonView'],
  'flow-row': [null, 'FlowRowView'],
  form: ['FormView', null],
  gauge: ['GaugeView', null],
  'glass-effect-container': ['GlassEffectContainerView', null],
  grid: ['GridView', null],
  'grid-row': ['GridRowView', null],
  group: ['GroupView', null],
  'horizontal-floating-toolbar': [null, 'HorizontalFloatingToolbarView'],
  // Compose's host is `HostView` too; `RNHostView` is the reverse, React Native content inside Compose.
  host: ['HostView', 'HostView'],
  hstack: ['HStackView', 'RowView'],
  icon: [null, 'IconView'],
  image: ['ImageView', 'ImageView'],
  'input-chip': [null, 'InputChipView'],
  label: ['LabelView', null],
  list: ['ListView', null],
  'labeled-content': ['LabeledContentView', null],
  'lazy-hstack': ['LazyHStackView', 'LazyRowView'],
  'lazy-vstack': ['LazyVStackView', 'LazyColumnView'],
  link: ['LinkView', null],
  'list-item': [null, 'ListItemView'],
  mask: ['MaskView', null],
  menu: ['MenuView', 'DropdownMenuView'],
  'multi-choice-segmented-button-row': [null, 'MultiChoiceSegmentedButtonRowView'],
  'navigation-bar': [null, 'NavigationBarView'],
  'navigation-bar-item': [null, 'NavigationBarItemView'],
  overlay: ['OverlayView', null],
  pager: [null, 'HorizontalPagerView'],
  picker: ['PickerView', null],
  'plain-tooltip': [null, 'PlainTooltipView'],
  popover: ['PopoverView', null],
  progress: ['ProgressView', null],
  'pull-to-refresh-box': [null, 'PullToRefreshBoxView'],
  'radio-button': [null, 'RadioButtonView'],
  rectangle: ['RectangleView', null],
  'rich-tooltip': [null, 'RichTooltipView'],
  'rounded-rectangle': ['RoundedRectangleView', null],
  'scroll-view-component': ['ScrollViewComponent', null],
  'search-bar': [null, 'SearchBarView'],
  section: ['SectionView', null],
  'secure-field': ['SecureFieldView', null],
  'segmented-button': [null, 'SegmentedButtonView'],
  shape: [null, 'ShapeView'],
  'share-link': ['ShareLinkView', null],
  'single-choice-segmented-button-row': [null, 'SingleChoiceSegmentedButtonRowView'],
  slider: ['SliderView', 'SliderView'],
  /**
   * Both platforms, though it looks Android-only at a glance.
   *
   * SwiftUI's `SlotView` lives in a top-level `SlotView.tsx` rather than in a directory of its
   * own, which is how it was missed. Twenty SwiftUI components put their children through one:
   * a picker's options, a section's rows, a labelled content's value. Without it those children
   * mount into a plain `UIView` and SwiftUI refuses them, which is a red screen on iOS and an
   * empty control everywhere else.
   */
  slot: ['SlotView', 'SlotView'],
  snackbar: [null, 'SnackbarView'],
  'snackbar-host': [null, 'SnackbarHostView'],
  spacer: ['SpacerView', 'SpacerView'],
  stepper: ['StepperView', null],
  'suggestion-chip': [null, 'SuggestionChipView'],
  surface: [null, 'SurfaceView'],
  'swipe-actions': ['SwipeActionsView', null],
  'sync-toggle': ['SyncToggleView', 'SyncSwitchView'],
  tab: ['TabView', null],
  text: ['TextView', 'TextView'],
  'text-field': ['TextFieldView', null],
  'time-picker-dialog': [null, 'TimePickerDialogView'],
  toggle: ['ToggleView', 'SwitchView'],
  'tooltip-box': [null, 'TooltipBoxView'],
  'tri-state-checkbox': [null, 'TriStateCheckboxView'],
  'uneven-rounded-rectangle': ['UnevenRoundedRectangleView', null],
  'vertical-slider': [null, 'VerticalSliderView'],
  vstack: ['VStackView', 'ColumnView'],
  zstack: ['ZStackView', 'BoxView'],
};

/**
 * Register every `@expo/ui` view the platform has.
 *
 * All of them at once, unlike the other registrations here, because they are all one module: an
 * app that has `@expo/ui` installed has all of these, and an app that does not has none of them.
 *
 * Takes `Platform.OS` itself - `'ios' | 'android' | 'macos' | 'windows' | 'web'` - rather than the
 * two platforms `@expo/ui` actually ships for (also accepting RN's `'native'` fallback), so an app can pass it straight through
 * without narrowing. Anything other than iOS or Android registers nothing, the same "not
 * installed" outcome as never calling this at all.
 */
export function registerExpoUiViews(platform: ExpoViewPlatform): void {
  if (platform !== 'ios' && platform !== 'android') return;
  const index = platform === 'ios' ? 0 : 1;
  for (const [element, views] of Object.entries(EXPO_UI_VIEWS)) {
    const viewName = views[index];
    if (viewName) registerExpoView(`ui-${element}`, 'ExpoUI', { viewName });
  }
}
