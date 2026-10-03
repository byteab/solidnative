/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { For, withNativeStyles } from '@solid-native/platform/solid';
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
            <Pressable class="habit" accessibilityRole="button" onPress={() => toggle(habit.id)}>
              <Text>{habit.name}</Text>
              <Text class="status">{habit.done ? 'Done' : 'To do'}</Text>
            </Pressable>
          )}
        </For>
      </ScrollView>
    </View>
  ));
}
