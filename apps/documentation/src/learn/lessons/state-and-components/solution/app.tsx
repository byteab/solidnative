/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { ScrollView, Text, View } from '@solidnative/components/solid';
import { For, withNativeStyles } from '@solidnative/platform/solid';
import { HabitRow } from './habit-row';
import sheet from './app.native.css';

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

  return withNativeStyles(sheet, () => (
    <View class="screen">
      <Text class="title">Today</Text>
      <Text class="summary">{remaining()} left to do</Text>
      <ScrollView contentContainerStyle={{ gap: 8 }}>
        <For each={habits()} fallback={<Text class="summary">No habits yet</Text>}>
          {(habit) => (
            <HabitRow name={habit.name} done={habit.done} onToggle={() => toggle(habit.id)} />
          )}
        </For>
      </ScrollView>
    </View>
  ));
}
