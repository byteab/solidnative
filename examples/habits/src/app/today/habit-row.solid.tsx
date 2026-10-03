/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, Text, View } from '@solid-native/components/solid';
import { Icon } from '@solid-native/icons/solid';
import { Show, withNativeStyles } from '@solid-native/platform/solid';
import type { Habit } from '../data/habits.solid.ts';
import sheet from './habit-row.native.css';

export interface HabitRowProps {
  habit: Habit;
  done: boolean;
  streak: number;
  onToggle: () => void;
  onOpen: () => void;
}

/**
 * One habit on the Today screen: a checkbox, its name and streak, done two ways - a tap on the
 * checkbox, or a long press anywhere on the row.
 */
export function HabitRow(props: HabitRowProps) {
  const streakLabel = () => `${props.streak} day${props.streak === 1 ? '' : 's'}`;
  return withNativeStyles(sheet, () => (
    <View class="row">
      <Pressable
        class="checkbox"
        accessibilityRole="checkbox"
        accessibilityLabel={props.habit.name}
        accessibilityState={{ checked: props.done }}
        data-done={props.done ? '' : undefined}
        style={{
          borderColor: props.habit.colour,
          backgroundColor: props.done ? props.habit.colour : 'transparent',
        }}
        onPress={() => props.onToggle()}
        onLongPress={() => props.onToggle()}
      >
        <Show when={props.done}>
          <Icon class="mark" name="Check" size={18} color="#ffffff" />
        </Show>
      </Pressable>

      <Pressable
        class="body"
        accessibilityRole="button"
        accessibilityLabel={props.habit.name}
        onPress={() => props.onOpen()}
        onLongPress={() => props.onToggle()}
      >
        <Text class="name" classList={{ done: props.done }}>
          {props.habit.name}
        </Text>
        <Show
          when={props.streak > 0}
          fallback={<Text class="streak-label muted">Not started yet</Text>}
        >
          <View class="streak">
            <Icon name="Flame" size={13} color="#f97316" />
            <Text class="streak-label">{streakLabel()}</Text>
          </View>
        </Show>
      </Pressable>
    </View>
  ));
}
