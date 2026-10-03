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
      class="mt-2 flex-row items-center justify-between rounded-xl bg-white p-4 active:bg-zinc-200 android:rounded-md"
      accessibilityRole="button"
      onPress={() => props.onToggle?.()}
    >
      <Text class="text-base text-zinc-900">{props.name}</Text>
      <Text class={props.done ? 'text-emerald-600' : 'text-zinc-500'}>
        {props.done ? 'Done' : 'To do'}
      </Text>
    </Pressable>
  );
}
