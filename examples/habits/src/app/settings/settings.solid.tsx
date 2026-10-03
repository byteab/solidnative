/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Flame } from 'lucide-static';
import { SafeAreaView, ScrollView, Switch, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Notifications, TriggerType } from '@solidnative/expo/solid/notifications';
import { Icon, IconProvider } from '@solidnative/icons/solid';
import { For, Show } from '@solidnative/platform/solid';
import { Habits } from '../data/habits.solid.ts';

const icons = { Flame };

/**
 * Reminders and a quick look at every streak. The `Notifications` service covers the permission
 * dialog, the denied state and the scheduling: one daily notification per habit that has a
 * reminder time.
 */
export function Settings() {
  const habits = useService(Habits);
  const notifications = useService(Notifications);
  const permission = notifications.permission;
  const [remindersOn, setRemindersOn] = createSignal(false);

  async function scheduleReminders() {
    await notifications.cancelAll();
    for (const habit of habits.habits()) {
      if (!habit.reminderTime) continue;
      const [hour, minute] = habit.reminderTime.split(':').map(Number);
      await notifications.schedule({
        identifier: habit.id,
        content: { title: habit.name, body: "Don't forget today." },
        trigger: { type: TriggerType.DAILY, hour: hour ?? 9, minute: minute ?? 0 },
      });
    }
  }

  async function toggleReminders(wants: boolean) {
    if (!wants) {
      setRemindersOn(false);
      await notifications.cancelAll();
      return;
    }
    const granted = await permission.ensure();
    setRemindersOn(granted);
    if (granted) await scheduleReminders();
  }

  return (
    <IconProvider icons={icons}>
      <SafeAreaView class="flex-1 bg-zinc-100 dark:bg-black" edges={['top']}>
        <ScrollView class="flex-1">
          <Text class="px-5 pt-4 pb-3 text-3xl font-bold text-zinc-900 dark:text-white">
            Settings
          </Text>

          <Text class="px-5 pt-4 pb-2 text-xs text-zinc-500 uppercase">Reminders</Text>
          <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-xl">
            <View class="flex-row items-center justify-between px-4 py-3">
              <Text class="text-zinc-900 dark:text-white">Daily reminders</Text>
              <Switch
                accessibilityLabel="Daily reminders"
                value={remindersOn()}
                onValueChange={(wants) => void toggleReminders(wants)}
              />
            </View>
            <Show when={permission.blocked()}>
              <Text class="px-4 pb-3 text-sm text-rose-600">
                Notifications are turned off for Habits. Enable them in the system Settings app to
                get reminders.
              </Text>
            </Show>
          </View>

          <Text class="px-5 pt-6 pb-2 text-xs text-zinc-500 uppercase">Streaks</Text>
          <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-xl">
            <For
              each={habits.habits()}
              fallback={<Text class="px-4 py-3 text-zinc-500">No habits yet.</Text>}
            >
              {(habit, index) => (
                <View
                  class={`flex-row items-center justify-between px-4 py-3 ${
                    index() === habits.habits().length - 1
                      ? ''
                      : 'border-b-hairline border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <View class="flex-row items-center gap-3">
                    <View class="size-3 rounded-full" style={{ backgroundColor: habit.colour }} />
                    <Text class="text-zinc-900 dark:text-white">{habit.name}</Text>
                  </View>
                  <View class="flex-row items-center gap-1">
                    <Icon name="Flame" size={14} color="#f97316" />
                    <Text class="text-sm font-semibold text-zinc-500">
                      {habits.streak(habit.id)}
                    </Text>
                  </View>
                </View>
              )}
            </For>
          </View>
        </ScrollView>
      </SafeAreaView>
    </IconProvider>
  );
}
