/** @jsxImportSource @solidnative/platform/solid */
import { bindFormField, createForm, TextInput, View } from '@solidnative/components/solid';

export function NewHabit() {
  const form = createForm({ name: '' });
  return (
    <View class="mt-2 flex-row gap-2">
      <TextInput
        class="flex-1 rounded-xl bg-white px-4 py-3 text-base text-zinc-900"
        placeholder="New habit"
        {...bindFormField(form.fields.name)}
      />
    </View>
  );
}
