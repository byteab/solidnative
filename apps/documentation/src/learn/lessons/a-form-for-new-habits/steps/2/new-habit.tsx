/** @jsxImportSource @solidnative/platform/solid */
import {
  bindFormField,
  createForm,
  formMaxLength,
  formRequired,
  Text,
  TextInput,
  View,
} from '@solidnative/components/solid';
import { Show } from '@solidnative/platform/solid';

export function NewHabit() {
  const form = createForm(
    { name: '' },
    { name: { validate: [formRequired({ message: 'Give the habit a name' }), formMaxLength(30)] } },
  );
  const name = form.fields.name;
  const error = () => (name.touched() ? name.errors()[0] : undefined);
  return (
    <>
      <View class="mt-2 flex-row gap-2">
        <TextInput
          class="flex-1 rounded-xl bg-white px-4 py-3 text-base text-zinc-900"
          placeholder="New habit"
          maxLength={30}
          {...bindFormField(name)}
        />
      </View>
      <Show when={error()}>
        {(error) => (
          <Text class="text-sm text-red-600" accessibilityRole="alert">
            {error().message}
          </Text>
        )}
      </Show>
    </>
  );
}
