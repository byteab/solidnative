/** @jsxImportSource @solidnative/platform/solid */
import {
  bindFormField,
  createForm,
  formMaxLength,
  formRequired,
  Pressable,
  Text,
  TextInput,
  View,
} from '@solidnative/components/solid';
import { Show } from '@solidnative/platform/solid';

export interface NewHabitProps {
  readonly onAdd?: (name: string) => void;
}

export function NewHabit(props: NewHabitProps) {
  const form = createForm(
    { name: '' },
    { name: { validate: [formRequired({ message: 'Give the habit a name' }), formMaxLength(30)] } },
  );
  const name = form.fields.name;
  const error = () => (name.touched() ? name.errors()[0] : undefined);

  function save() {
    void form.submit((value) => {
      props.onAdd?.(value.name);
      form.reset();
    });
  }

  return (
    <>
      <View class="mt-2 flex-row gap-2">
        <TextInput
          class="flex-1 rounded-xl bg-white px-4 py-3 text-base text-zinc-900 dark:bg-zinc-900 dark:text-white"
          placeholder="New habit"
          maxLength={30}
          returnKeyType="done"
          submitBehavior="submit"
          {...bindFormField(name)}
          onSubmitEditing={save}
        />
        <Pressable
          class="justify-center rounded-xl bg-emerald-600 px-4 active:bg-emerald-700"
          accessibilityRole="button"
          onPress={save}
        >
          <Text class="font-semibold text-white">Add</Text>
        </Pressable>
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
