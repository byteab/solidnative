/** @jsxImportSource @solid-native/platform/solid */
import { createMemo } from 'solid-js';
import { Text, View, type FormField } from '@solid-native/components/solid';
import { Show, withNativeStyles, type HostChild } from '@solid-native/platform/solid';
import styles from './form-row.native.css';

export function FormRow(props: {
  label: string;
  field: Pick<FormField<unknown>, 'errors' | 'pending' | 'touched'>;
  hint?: string;
  children?: HostChild;
}) {
  // Projected controls belong to the caller's stylesheet, just as their field owners do.
  const content = createMemo(() => props.children);
  const error = () => (props.field.touched() ? props.field.errors()[0]?.message : undefined);
  return withNativeStyles(styles, () => (
    <View class="row">
      <Text class="label">{props.label}</Text>
      {content()}
      <Show
        when={props.field.pending()}
        fallback={
          <Show
            when={error()}
            fallback={
              <Show when={props.hint}>
                <Text class="hint">{props.hint}</Text>
              </Show>
            }
          >
            {(message) => (
              <Text class="hint danger" accessibilityRole="alert">
                {message()}
              </Text>
            )}
          </Show>
        }
      >
        <Text class="hint">Checking</Text>
      </Show>
    </View>
  ));
}
