/** @jsxImportSource @solid-native/platform/solid */
import { For, Show } from '@solid-native/platform/solid';
import { TextInput } from '../src/solid/text-input.ts';
import { Switch } from '../src/solid/switch.ts';
import { View, Text } from '../src/solid/primitive.ts';
import { createForm, bindFormField } from '../src/solid/forms.ts';
import { formRequired, formMinLength } from '../src/solid/forms-rules.ts';
import type { NativeForm } from '../src/solid/forms-types.ts';

interface Model {
  name: string;
  country: string;
  state: string;
  phone: string;
  sms: boolean;
  dependants: { name: string; born: Date | null }[];
}
export function formFixture() {
  let form!: NativeForm<Model>;
  const initial: Model = {
    name: '',
    country: 'GB',
    state: '',
    phone: '',
    sms: false,
    dependants: [
      { name: 'Alan', born: null },
      { name: 'Bea', born: null },
    ],
  };
  function Scene() {
    form = createForm(initial, {
      name: { validate: [formRequired(), formMinLength(3)] },
      state: { hidden: ({ values }) => values.country !== 'US', validate: formRequired() },
      sms: { disabled: ({ values }) => !values.phone },
      dependants: {
        each: { name: { validate: formRequired() }, born: { validate: formRequired() } },
      },
    });
    return (
      <View>
        <TextInput
          testID="name"
          {...bindFormField(form.fields.name)}
          onSubmitEditing={() => form.fields.phone.focusBoundControl()}
        />
        <TextInput testID="phone" {...bindFormField(form.fields.phone)} />
        <Switch testID="sms" {...bindFormField(form.fields.sms)} />
        <Show when={!form.fields.state.hidden()}>
          <TextInput testID="state" {...bindFormField(form.fields.state)} />
        </Show>
        <For each={form.fields.dependants.items()}>
          {(row, index) => (
            <TextInput testID={`dependant-${index()}`} {...bindFormField(row.name)} />
          )}
        </For>
        <Text testID="errors">{form.fields.name.errors().length}</Text>
      </View>
    );
  }
  return { Scene, form: () => form };
}
