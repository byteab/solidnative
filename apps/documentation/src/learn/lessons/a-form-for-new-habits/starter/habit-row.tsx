/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, Text } from '@solidnative/components/solid';

export interface HabitRowProps {
  readonly name: string;
  readonly done?: boolean;
  readonly onToggle?: () => void;
}

export function HabitRow(props: HabitRowProps) {
  return (
    <Pressable
      class="mt-2 flex-row items-center justify-between rounded-xl bg-white p-4 active:bg-zinc-200 android:rounded-md dark:bg-zinc-900 dark:active:bg-zinc-800"
      accessibilityRole="button"
      onPress={() => props.onToggle?.()}
    >
      <Text class="text-base text-zinc-900 dark:text-white">{props.name}</Text>
      <Text class={props.done ? 'text-emerald-600' : 'text-zinc-500'}>
        {props.done ? 'Done' : 'To do'}
      </Text>
    </Pressable>
  );
}
