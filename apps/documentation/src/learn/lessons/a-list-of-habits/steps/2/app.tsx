/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Text, View } from '@solidnative/components/solid';
import { For, withNativeStyles } from '@solidnative/platform/solid';
import sheet from './app.native.css';

interface Habit {
  readonly id: string;
  readonly name: string;
  readonly done: boolean;
}

export function App() {
  const [habits] = createSignal<readonly Habit[]>([
    { id: 'water', name: 'Drink water', done: false },
    { id: 'read', name: 'Read ten pages', done: false },
    { id: 'walk', name: 'Walk', done: true },
  ]);
  const remaining = createMemo(() => habits().filter((habit) => !habit.done).length);

  return withNativeStyles(sheet, () => (
    <View class="screen">
      <Text class="title">Today</Text>
      <Text class="summary">{remaining()} left to do</Text>
      <For each={habits()} fallback={<Text class="summary">No habits yet</Text>}>
        {(habit) => (
          <View class="habit">
            <Text>{habit.name}</Text>
            <Text class="status">{habit.done ? 'Done' : 'To do'}</Text>
          </View>
        )}
      </For>
    </View>
  ));
}
