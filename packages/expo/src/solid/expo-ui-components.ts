import {
  createMemo,
  createSignal,
  mapArray,
  mergeProps,
  onCleanup,
  untrack,
  type Accessor,
} from 'solid-js';
import { nativePlatform, type HostNode, type NativeSyntheticEvent } from '@solidnative/fabric';
import type { ViewProps } from '@solidnative/components/solid';
import { useHostAdapter } from '@solidnative/platform/solid';
import type { NativeState } from './native-state.ts';
import { nativeView, viewProps } from './view.ts';

/** Plain modifier data, including values returned by @expo/ui's modifier functions. */
export interface UiModifier {
  readonly $type: string;
  readonly [key: string]: unknown;
}
export interface UiProps extends ViewProps {
  modifiers?: readonly UiModifier[];
}
export interface UiHostProps extends ViewProps {
  matchContents?: boolean | { readonly vertical?: boolean; readonly horizontal?: boolean };
  ignoreSafeArea?: 'all' | 'keyboard' | 'container';
  useViewportSizeMeasurement?: boolean;
}
/** Register the existing native view table with registerExpoUiViews before rendering UI hosts. */
export function UiHost(props: UiHostProps): HostNode {
  return nativeView('ui-host', props, () => {
    const match = props.matchContents;
    return {
      ...viewProps(props, ['matchContents']),
      matchContentsVertical: typeof match === 'object' ? match.vertical : match,
      matchContentsHorizontal: typeof match === 'object' ? match.horizontal : match,
    };
  });
}
export interface UiMenuProps extends UiProps {
  label?: string;
  systemImage?: string;
}
export function UiMenu(props: UiMenuProps): HostNode {
  return nativeView('ui-menu', props);
}
export interface UiButtonProps extends Omit<UiProps, 'role'> {
  label?: string;
  systemImage?: string;
  role?: 'default' | 'cancel' | 'destructive';
  onButtonPress?: (event: NativeSyntheticEvent<Record<string, never>>) => void;
}
export function UiButton(props: UiButtonProps): HostNode {
  return nativeView('ui-button', props as ViewProps, () => ({
    ...viewProps(props as ViewProps, ['role']),
    role: props.role,
  }));
}
export function UiDivider(props: UiProps): HostNode {
  return nativeView('ui-divider', props);
}
export interface UiSlotProps extends ViewProps {
  name: string;
  extraProps?: Readonly<Record<string, unknown>>;
}
export function UiSlot(props: UiSlotProps): HostNode {
  return nativeView('ui-slot', props);
}
export function UiList(props: UiProps): HostNode {
  return nativeView('ui-list', props);
}
export function UiSwipeActions(props: UiProps): HostNode {
  return nativeView('ui-swipe-actions', props);
}
export type UiSliderChangeEvent = NativeSyntheticEvent<{ readonly value: number }>;
export interface UiSliderProps extends UiProps {
  value?: number;
  min?: number;
  max?: number;
  steps?: number;
  /** Compose only: its slider is tinted here rather than by a modifier. */
  colors?: {
    readonly thumbColor?: string;
    readonly activeTrackColor?: string;
    readonly inactiveTrackColor?: string;
  };
  onValueChanged?: (event: UiSliderChangeEvent) => void;
}
/** SwiftUI's slider sends `onValueChanged`, Compose's `onValueChange`; both arrive as the former. */
export function UiSlider(props: UiSliderProps): HostNode {
  if (nativePlatform() !== 'android') return nativeView('ui-slider', props);
  return nativeView('ui-slider', props, () => ({
    ...viewProps(props, ['onValueChanged']),
    onValueChange: props.onValueChanged,
  }));
}
export interface UiVStackProps extends UiProps {
  alignment?: 'leading' | 'center' | 'trailing';
  spacing?: number;
}
export function UiVStack(props: UiVStackProps): HostNode {
  return nativeView('ui-vstack', props);
}
export interface UiImageProps extends UiProps {
  systemName?: string;
  uiImage?: string;
  size?: number;
  color?: string;
}
/** SwiftUI's image takes neither as a prop: like `@expo/ui`'s wrapper, they become modifiers. */
export function UiImage(props: UiImageProps): HostNode {
  if (nativePlatform() !== 'ios') return nativeView('ui-image', props);
  return nativeView('ui-image', props, () => {
    const modifiers = props.modifiers ?? [];
    const sized = modifiers.some((modifier) => modifier.$type === 'font');
    return {
      ...viewProps(props, ['size', 'color', 'modifiers']),
      modifiers: [
        ...modifiers,
        ...(sized ? [] : [{ $type: 'font', size: props.size ?? 24 }]),
        ...(props.color == null
          ? []
          : [{ $type: 'foregroundStyle', style: { type: 'color', color: props.color } }]),
      ],
    };
  });
}
export interface UiTextProps extends UiProps {
  text?: string;
}
export function UiText(props: UiTextProps): HostNode {
  return nativeView('ui-text', props);
}

function withDisabled(modifiers: readonly UiModifier[] | undefined, disabled: boolean | undefined) {
  return disabled ? [...(modifiers ?? []), { $type: 'disabled', disabled: true }] : modifiers;
}
/** Controlled mode is selected once; undefined initially opts into local state. */
function control<T>(value: Accessor<T | undefined>, initial: T, notify: (next: T) => void) {
  const first = untrack(value);
  const controlled = first !== undefined;
  const [local, setLocal] = createSignal<T>(first ?? initial);
  return {
    value: () => (controlled ? (value() ?? initial) : local()),
    propose: (next: T) => {
      if (!controlled) setLocal(() => next);
      notify(next);
    },
  };
}
function eventLifetime() {
  const host = useHostAdapter();
  let active = true;
  onCleanup(() => {
    active = false;
  });
  return (node: HostNode) => active && host.isAttached(node);
}

export type UiDateChangeEvent = NativeSyntheticEvent<{ readonly date: number | string }>;
export interface UiDatePickerProps extends UiProps {
  title?: string;
  selection?: string;
  displayedComponents?: readonly ('date' | 'hourAndMinute')[];
  range?: { readonly start?: string; readonly end?: string };
  value?: Date | null;
  defaultValue?: Date | null;
  disabled?: boolean;
  onValueChange?: (value: Date) => void;
  onTouch?: () => void;
  onDateChange?: (event: UiDateChangeEvent) => void;
}
function validDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function UiDatePicker(props: UiDatePickerProps): HostNode {
  const android = nativePlatform() === 'android';
  const live = eventLifetime();
  const state = control<Date | null>(
    () => props.value,
    props.defaultValue ?? null,
    (next) => {
      if (next) props.onValueChange?.(next);
    },
  );
  const appeared = Date.now();
  let settled = false;
  let node!: HostNode;
  const change = (event: UiDateChangeEvent) => {
    if (!live(node)) return;
    const date = validDate(event.nativeEvent.date);
    if (!date) return;
    const describingItself =
      !settled && state.value() === null && !props.selection && Date.now() - appeared < 1000;
    settled = true;
    if (!describingItself && !props.disabled) {
      state.propose(date);
      if (live(node)) props.onTouch?.();
    }
    if (live(node)) props.onDateChange?.(event);
  };
  node = nativeView('ui-date-picker', props, () => ({
    ...viewProps(props, [
      'value',
      'defaultValue',
      'onValueChange',
      'onTouch',
      'onDateChange',
      'disabled',
      'selection',
      'modifiers',
    ]),
    selection: android ? undefined : (props.selection ?? state.value()?.toISOString()),
    initialDate: android ? (state.value()?.getTime() ?? null) : undefined,
    modifiers: android ? props.modifiers : withDisabled(props.modifiers, props.disabled),
    [android ? 'onDateSelected' : 'onDateChange']: change,
  }));
  return node;
}

export interface UiPickerOption {
  readonly value: string | number;
  readonly label: string;
}
export type UiPickerChangeEvent = NativeSyntheticEvent<{ readonly selection: string | number }>;
export interface UiPickerProps extends UiProps {
  label?: string;
  systemImage?: string;
  options?: readonly UiPickerOption[];
  pickerStyle?: 'automatic' | 'menu' | 'segmented' | 'wheel' | 'inline' | 'palette';
  value?: string | number | null;
  defaultValue?: string | number | null;
  disabled?: boolean;
  onValueChange?: (value: string | number) => void;
  onTouch?: () => void;
  onSelectionChange?: (event: UiPickerChangeEvent) => void;
}
function pickerOptions(props: UiPickerProps) {
  const options = createMemo(
    () => new Map((props.options ?? []).map((option) => [option.value, option.label])),
  );
  const rows = mapArray(
    () => [...options().keys()],
    (value) =>
      UiText({
        get text() {
          return options().get(value);
        },
        modifiers: [{ $type: 'tag', tag: value }],
      }),
  );
  const hasOptions = createMemo(() => props.options !== undefined);
  return createMemo(() =>
    hasOptions()
      ? UiSlot({
          name: 'content',
          get children() {
            return rows();
          },
        })
      : null,
  );
}
export function UiPicker(props: UiPickerProps): HostNode {
  const live = eventLifetime();
  const state = control<string | number | null>(
    () => props.value,
    props.defaultValue ?? null,
    (next) => {
      if (next !== null) props.onValueChange?.(next);
    },
  );
  const options = pickerOptions(props);
  let node!: HostNode;
  const change = (event: UiPickerChangeEvent) => {
    if (!live(node)) return;
    const next = event.nativeEvent.selection;
    if (typeof next !== 'string' && typeof next !== 'number') return;
    if (!props.disabled) {
      state.propose(next);
      if (live(node)) props.onTouch?.();
    }
    if (live(node)) props.onSelectionChange?.(event);
  };
  node = nativeView(
    'ui-picker',
    mergeProps(props, {
      get children() {
        return [options(), props.children];
      },
    }),
    () => ({
      ...viewProps(props, [
        'options',
        'pickerStyle',
        'value',
        'defaultValue',
        'onValueChange',
        'onTouch',
        'disabled',
        'modifiers',
        'onSelectionChange',
      ]),
      selection: state.value(),
      // The native picker renders nothing at all without a label or a label slot (which wins
      // over this); an empty one is what an unlabeled segmented or menu picker wants.
      label: props.label ?? (props.systemImage ? undefined : ''),
      modifiers: withDisabled(
        props.pickerStyle
          ? [{ $type: 'pickerStyle', style: props.pickerStyle }, ...(props.modifiers ?? [])]
          : props.modifiers,
        props.disabled,
      ),
      onSelectionChange: change,
    }),
  );
  return node;
}

export type UiToggleChangeEvent = NativeSyntheticEvent<{ readonly isOn: boolean }>;
export interface UiToggleProps extends UiProps {
  isOn?: boolean;
  label?: string;
  onIsOnChange?: (event: UiToggleChangeEvent) => void;
}
export function UiToggle(props: UiToggleProps): HostNode {
  return nativeView('ui-toggle', props);
}
export type UiStepperChangeEvent = NativeSyntheticEvent<{ readonly value: number }>;
export interface UiStepperProps extends UiProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  onValueChange?: (event: UiStepperChangeEvent) => void;
}
export function UiStepper(props: UiStepperProps): HostNode {
  return nativeView('ui-stepper', props);
}
export type UiTextFieldChangeEvent = NativeSyntheticEvent<{ readonly value: string }>;
export interface UiTextFieldProps extends UiProps {
  text?: NativeState<string> | null;
  placeholder?: string;
  onTextChange?: (event: UiTextFieldChangeEvent) => void;
}
export function UiTextField(props: UiTextFieldProps): HostNode {
  return nativeView('ui-text-field', props, () => ({
    ...viewProps(props, ['text']),
    text: props.text?.id,
  }));
}
export type UiColorChangeEvent = NativeSyntheticEvent<{ readonly value: string }>;
export interface UiColorPickerProps extends UiProps {
  selection?: string;
  label?: string;
  supportsOpacity?: boolean;
  onSelectionChange?: (event: UiColorChangeEvent) => void;
}
export function UiColorPicker(props: UiColorPickerProps): HostNode {
  return nativeView('ui-color-picker', props);
}
export interface UiGaugeProps extends UiProps {
  value?: number;
  min?: number;
  max?: number;
  type?: string;
  currentValueLabel?: string;
  minimumValueLabel?: string;
  maximumValueLabel?: string;
}
export function UiGauge(props: UiGaugeProps): HostNode {
  return nativeView('ui-gauge', props);
}
export interface UiProgressProps extends UiProps {
  value?: number;
}
export function UiProgress(props: UiProgressProps): HostNode {
  return nativeView('ui-progress', props);
}
export interface UiHStackProps extends UiProps {
  alignment?: 'top' | 'center' | 'bottom' | 'firstTextBaseline';
  spacing?: number;
}
export function UiHStack(props: UiHStackProps): HostNode {
  return nativeView('ui-hstack', props);
}
export function UiSpacer(props: UiProps): HostNode {
  return nativeView('ui-spacer', props);
}
export interface UiLabeledContentProps extends UiProps {
  label?: string;
}
export function UiLabeledContent(props: UiLabeledContentProps): HostNode {
  return nativeView('ui-labeled-content', props);
}
export function UiForm(props: UiProps): HostNode {
  return nativeView('ui-form', props);
}
export interface UiSectionProps extends UiProps {
  title?: string;
}
export function UiSection(props: UiSectionProps): HostNode {
  return nativeView('ui-section', props);
}
