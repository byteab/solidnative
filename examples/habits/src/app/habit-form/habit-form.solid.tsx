/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import {
  bindFormField,
  createForm,
  formRequired,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Haptics } from '@solidnative/expo/solid/haptics';
import { For, Show } from '@solidnative/platform/solid';
import { useNavigation, useRoute } from '@solidnative/router/solid';
import { Habits } from '../data/habits.solid.ts';

const REMINDER_TIMES = ['07:00', '08:00', '09:00', '12:00', '18:00', '21:00'];

/**
 * Adding or editing a habit: a form over native fields, presented as a modal. The same screen does
 * both - an `id` route param is set when editing, and its absence is what "new" means.
 */
export function HabitForm() {
  const habits = useService(Habits);
  const haptics = useService(Haptics);
  const navigation = useNavigation();
  const id = useRoute().params['id'];
  const editing = id === undefined ? undefined : habits.find(id);

  const form = createForm(
    {
      name: editing?.name ?? '',
      colour: editing?.colour ?? habits.palette[0]!,
      reminderTime: editing?.reminderTime ?? REMINDER_TIMES[1]!,
    },
    {
      name: {
        validate: [
          formRequired({ message: 'Give it a name' }),
          (value: string) => {
            const name = value.trim();
            if (name && habits.nameTaken(name, id)) {
              return { kind: 'unique', message: 'Already tracking a habit with this name' };
            }
            return undefined;
          },
        ],
      },
    },
  );
  const [reminderOn, setReminderOn] = createSignal(editing?.reminderTime != null);
  const name = form.fields.name;
  const data = form.value;
  const nameError = () => (name.touched() ? name.errors()[0] : undefined);

  function choose(field: 'colour' | 'reminderTime', value: string) {
    form.fields[field].setValue(value);
    haptics.select();
  }

  function submit() {
    if (form.invalid()) {
      haptics.notify('error');
      return;
    }
    const { name, colour, reminderTime } = data();
    const reminder = reminderOn() ? reminderTime : null;
    if (editing) habits.update(editing.id, { name, colour, reminderTime: reminder });
    else habits.create({ name, colour, reminderTime: reminder });
    haptics.notify('success');
    void navigation.back();
  }

  return (
    <SafeAreaView class="flex-1 bg-zinc-100 dark:bg-black" edges={['top', 'bottom']}>
      <View class="flex-row items-center justify-between px-5 py-3">
        <Pressable accessibilityRole="button" onPress={() => void navigation.back()}>
          <Text class="text-base text-rose-600">Cancel</Text>
        </Pressable>
        <Text class="text-base font-semibold text-zinc-900 dark:text-white">
          {editing ? 'Edit habit' : 'New habit'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: form.invalid() }}
          onPress={submit}
        >
          <Text
            class={`text-base font-semibold ${form.invalid() ? 'text-zinc-400 dark:text-zinc-600' : 'text-rose-600'}`}
          >
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView class="flex-1" keyboardShouldPersistTaps="handled">
        <View class="gap-2 px-5 pb-8">
          <Text class="mt-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Name</Text>
          <TextInput
            class="rounded-2xl border border-zinc-200 bg-white p-4 text-[16px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            placeholder="Drink water"
            accessibilityLabel="Habit name"
            autoCapitalize="sentences"
            {...bindFormField(name)}
          />
          <Show when={nameError()}>
            {(error) => <Text class="text-sm text-rose-600">{error().message}</Text>}
          </Show>

          <Text class="mt-5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Colour
          </Text>
          <View class="flex-row flex-wrap gap-3">
            <For each={habits.palette}>
              {(colour) => (
                <Pressable
                  class="size-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: colour }}
                  accessibilityRole="button"
                  accessibilityLabel={`Colour ${colour}`}
                  accessibilityState={{ selected: data().colour === colour }}
                  onPress={() => choose('colour', colour)}
                >
                  <Show when={data().colour === colour}>
                    <View class="size-3 rounded-full bg-white" />
                  </Show>
                </Pressable>
              )}
            </For>
          </View>

          <View class="mt-5 flex-row items-center justify-between">
            <Text class="text-base text-zinc-900 dark:text-white">Daily reminder</Text>
            <Switch
              accessibilityLabel="Daily reminder"
              value={reminderOn()}
              onValueChange={setReminderOn}
            />
          </View>

          <Show when={reminderOn()}>
            <View class="mt-1 flex-row flex-wrap gap-2">
              <For each={REMINDER_TIMES}>
                {(time) => (
                  <Pressable
                    class={`rounded-full border px-4 py-2 ${
                      data().reminderTime === time
                        ? 'border-rose-600 bg-rose-600'
                        : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                    }`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: data().reminderTime === time }}
                    onPress={() => choose('reminderTime', time)}
                  >
                    <Text
                      class={`text-sm font-semibold ${
                        data().reminderTime === time
                          ? 'text-white'
                          : 'text-zinc-900 dark:text-white'
                      }`}
                    >
                      {time}
                    </Text>
                  </Pressable>
                )}
              </For>
            </View>
          </Show>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
