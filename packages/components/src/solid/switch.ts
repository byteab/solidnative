import { nativePlatform, type HostNode, type NativeSyntheticEvent } from '@solidnative/fabric';
import { spreadHostProps, useHostEngine } from '@solidnative/platform/solid';
import { createControlled, FORM_KEYS, formProps } from './controlled.ts';
import { hostProps, primitiveNode } from './primitive.ts';
import { commitTask, createNativeRef } from './ref.ts';
import type { SwitchProps } from './types.ts';

export function Switch(props: SwitchProps): HostNode {
  const node = primitiveNode('switch');
  const engine = useHostEngine();
  const schedule = commitTask(node);
  const control = createControlled(
    () => props.value,
    props.defaultValue ?? false,
    (value) => props.onValueChange?.(value),
  );
  let nativeValue: boolean | undefined;
  const reconcile = () => {
    const actual = nativeValue;
    nativeValue = undefined;
    if (actual === undefined || actual === control.value()) return;
    engine.dispatchCommand(node, nativePlatform() === 'android' ? 'setNativeValue' : 'setValue', [
      control.value(),
    ]);
  };
  const onChange = (event: NativeSyntheticEvent<{ value?: boolean }>) => {
    nativeValue = event.nativeEvent.value ?? false;
    try {
      if (!props.disabled) control.propose(nativeValue);
      props.onChange?.(event);
    } finally {
      schedule(reconcile);
    }
  };
  spreadHostProps(
    node,
    () => ({
      ...hostProps(props, { role: 'switch', checked: control.value(), disabled: props.disabled }, [
        ...FORM_KEYS,
        'thumbColor',
        'trackColor',
        'ios_backgroundColor',
      ]),
      ...formProps(props),
      value: control.value(),
      on: control.value(),
      enabled: props.disabled === undefined ? undefined : !props.disabled,
      thumbTintColor: props.thumbColor,
      tintColor: props.trackColor?.false,
      onTintColor: props.trackColor?.true,
      trackColorForTrue: props.trackColor?.true,
      trackColorForFalse: props.trackColor?.false,
      trackTintColor: control.value() ? props.trackColor?.true : props.trackColor?.false,
      style: props.ios_backgroundColor
        ? [{ backgroundColor: props.ios_backgroundColor, borderRadius: 16 }, props.style]
        : props.style,
      onChange,
    }),
    true,
  );
  props.ref?.(createNativeRef(node));
  return node;
}
