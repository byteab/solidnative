/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Text, View } from '@solid-native/components/solid';
import { For, withNativeStyles } from '@solid-native/platform/solid';
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

  return withNativeStyles(sheet, () => (
    <View class="screen">
      <Text class="title">Today</Text>
      <Text class="summary">3 left to do</Text>
      <For each={habits()}>
        {(habit) => (
          <View class="habit">
            <Text>{habit.name}</Text>
            <Text class="status">To do</Text>
          </View>
        )}
      </For>
    </View>
  ));
}
