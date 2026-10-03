/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, Text } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './habit-row.native.css';

export interface HabitRowProps {
  readonly name: string;
  readonly done?: boolean;
  readonly onToggle?: () => void;
}

export function HabitRow(props: HabitRowProps) {
  return withNativeStyles(sheet, () => (
    <Pressable class="habit" accessibilityRole="button" onPress={() => props.onToggle?.()}>
      <Text>{props.name}</Text>
      <Text class="status">{props.done ? 'Done' : 'To do'}</Text>
    </Pressable>
  ));
}
