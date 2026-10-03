import { createRenderEffect, createSignal } from 'solid-js';
import type { HostNode, NativeSyntheticEvent } from '@solid-native/fabric';
import { Keyboard, useService, withServiceScope } from '@solid-native/device/solid';
import { onHostCleanup, spreadHostProps, useHostEngine } from '@solid-native/platform/solid';
import { createControlled, FORM_KEYS, formProps } from './controlled.ts';
import { hostProps, primitiveNode } from './primitive.ts';
import { commitTask, createNativeRef } from './ref.ts';
import { autofillProps } from './text-input-autofill.ts';
import type { TextChangePayload, TextInputProps, TextInputRef, TextSelection } from './types.ts';

function sameSelection(a: TextSelection | undefined, b: TextSelection | undefined) {
  return a?.start === b?.start && (a?.end ?? a?.start) === (b?.end ?? b?.start);
}
function selectionArgs(selection: TextSelection | undefined) {
  return [selection?.start ?? -1, selection?.end ?? selection?.start ?? -1];
}
function submitBehavior(props: TextInputProps) {
  if (props.submitBehavior && (props.multiline || props.submitBehavior !== 'newline'))
    return props.submitBehavior;
  return props.multiline ? 'newline' : 'blurAndSubmit';
}
export function TextInput(props: TextInputProps): HostNode {
  const node = primitiveNode('text-input');
  const engine = useHostEngine();
  const keyboard = withServiceScope([], () => useService(Keyboard));
  let active = true;
  onHostCleanup(node, () => {
    active = false;
  });
  const schedule = commitTask(node);
  const control = createControlled(
    () => props.value,
    props.defaultValue ?? '',
    (value) => props.onValueChange?.(value),
  );
  const [count, setCount] = createSignal(0);
  const [revision, setRevision] = createSignal(0);
  const [composing, setComposing] = createSignal(false);
  let nativeText: string | undefined;
  let nativeSelection: TextSelection | undefined;
  const reconcile = () => {
    if (composing()) return;
    const desired = control.value(),
      selection = props.selection;
    const textChanged = nativeText !== undefined && nativeText !== desired;
    const selectionChanged = selection !== undefined && !sameSelection(selection, nativeSelection);
    if (!textChanged && !selectionChanged) return;
    engine.dispatchCommand(node, 'setTextAndSelection', [
      count(),
      textChanged ? desired : null,
      ...selectionArgs(selection),
    ]);
    if (textChanged) {
      nativeText = desired;
      engine.remeasure(node);
    }
    if (selection) nativeSelection = selection;
  };
  const notifyChange = (text: string, event: NativeSyntheticEvent<TextChangePayload>) => {
    if (active) props.onChangeText?.(text);
    if (active) props.onChange?.(event);
  };
  const onChange = (event: NativeSyntheticEvent<TextChangePayload>) => {
    const payload = event.nativeEvent;
    const nextCount = payload.eventCount ?? count() + 1;
    if (nextCount < count()) return;
    if (nextCount === count() && !(composing() && payload.isComposing === false)) return;
    nativeText = payload.text ?? '';
    setCount(nextCount);
    setComposing(payload.isComposing ?? composing());
    setRevision((value) => value + 1);
    if (!props.disabled && !props.readOnly && props.editable !== false) control.propose(nativeText);
    notifyChange(nativeText, event);
  };
  const onSelectionChange: NonNullable<TextInputProps['onSelectionChange']> = (event) => {
    const payload = event.nativeEvent;
    if (payload.eventCount !== undefined && payload.eventCount < count()) return;
    nativeSelection = payload.selection;
    setRevision((value) => value + 1);
    props.onSelectionChange?.(event);
  };
  createRenderEffect(() => {
    control.value();
    count();
    revision();
    composing();
    props.selection;
    schedule(reconcile);
  });
  spreadHostProps(
    node,
    () => ({
      ...hostProps(props, { disabled: props.disabled }, [
        ...FORM_KEYS,
        'disabled',
        'readOnly',
        'onChangeText',
      ]),
      ...formProps(props),
      ...autofillProps(props),
      text: composing() && nativeText !== undefined ? nativeText : control.value(),
      mostRecentEventCount: count(),
      selection: composing() ? undefined : props.selection,
      editable: props.disabled || props.readOnly ? false : props.editable,
      submitBehavior: submitBehavior(props),
      underlineColorAndroid: props.underlineColorAndroid ?? 'transparent',
      onFocus: (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
        const { height, screenY } = keyboard.metrics();
        if (height > 0 && screenY !== undefined) engine.reveal(node, { visibleBottom: screenY });
        if (active) props.onFocus?.(event);
      },
      onChange,
      onSelectionChange,
    }),
    true,
  );
  const base = createNativeRef(node);
  const selectionTask = commitTask(node);
  const ref: TextInputRef = {
    ...base,
    blur: () => base.dispatchCommand('blur'),
    clear: () => {
      if (active) {
        control.propose('');
        schedule(reconcile);
      }
    },
    isFocused: () => base.isAttached() && engine.focused === node,
    setSelection: (start, end = start) =>
      selectionTask(() =>
        engine.dispatchCommand(node, 'setTextAndSelection', [count(), null, start, end]),
      ),
  };
  props.ref?.(ref);
  return node;
}
