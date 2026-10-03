import { createSignal, untrack, type Accessor } from 'solid-js';
import type { FormStateProps, ViewProps } from './types.ts';

/** Mode is fixed on creation; an initially undefined value opts into local state. */
export function createControlled<T>(
  value: Accessor<T | undefined>,
  initial: T,
  notify: (value: T) => void,
) {
  const first = untrack(value);
  const controlled = first !== undefined;
  const [local, setLocal] = createSignal(first ?? initial);
  return {
    value: () => (controlled ? (value() ?? initial) : local()),
    propose(next: T) {
      if (!controlled) setLocal(() => next);
      notify(next);
    },
  };
}

export function formProps(props: FormStateProps & Pick<ViewProps, 'onBlur'>) {
  return {
    'data-disabled': props.disabled ? '' : undefined,
    'data-invalid': props.invalid ? '' : undefined,
    'data-touched': props.touched ? '' : undefined,
    onBlur: (event: Parameters<NonNullable<ViewProps['onBlur']>>[0]) => {
      props.onTouched?.();
      props.onBlur?.(event);
    },
  };
}
export const FORM_KEYS = [
  'value',
  'defaultValue',
  'onValueChange',
  'invalid',
  'touched',
  'onTouched',
];
