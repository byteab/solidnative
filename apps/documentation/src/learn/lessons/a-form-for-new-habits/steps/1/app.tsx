/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { ScrollView, Text, View } from '@solidnative/components/solid';
import { For } from '@solidnative/platform/solid';
import { HabitRow } from './habit-row';
import { NewHabit } from './new-habit';

interface Habit {
  readonly id: string;
  readonly name: string;
  readonly done: boolean;
}

export function App() {
  const [habits, setHabits] = createSignal<readonly Habit[]>([
    { id: 'water', name: 'Drink water', done: false },
    { id: 'read', name: 'Read ten pages', done: false },
    { id: 'walk', name: 'Walk', done: true },
  ]);
  const remaining = createMemo(() => habits().filter((habit) => !habit.done).length);

  const toggle = (id: string) =>
    setHabits((list) =>
      list.map((habit) => (habit.id === id ? { ...habit, done: !habit.done } : habit)),
    );

  return (
    <View class="flex-1 gap-2 bg-zinc-100 px-5 pt-safe dark:bg-black">
      <Text class="pt-4 text-3xl font-bold text-zinc-900 android:text-2xl android:font-medium dark:text-white">
        Today
      </Text>
      <Text class="text-zinc-500 ios:text-xs ios:font-semibold ios:uppercase dark:text-zinc-400">
        {remaining()} left to do
      </Text>
      <NewHabit />
      <ScrollView contentContainerStyle={{ gap: 8 }}>
        <For each={habits()} fallback={<Text class="text-zinc-500">No habits yet</Text>}>
          {(habit) => (
            <HabitRow name={habit.name} done={habit.done} onToggle={() => toggle(habit.id)} />
          )}
        </For>
      </ScrollView>
    </View>
  );
}
