/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, Text, View } from '@solid-native/components/solid';
import { For } from '@solid-native/platform/solid';
import { accent } from '../flock.solid.ts';

/** Underline tabs, as X draws them on both platforms: bold when selected, an accent bar under it. */
export function Segments(props: {
  values: readonly string[];
  index: number;
  onChange: (index: number) => void;
}) {
  return (
    <View class="flex-row border-b-hairline border-zinc-200 dark:border-zinc-800">
      <For each={props.values}>
        {(label, i) => (
          <Pressable
            class="flex-1 items-center pt-3 active:bg-black/5"
            accessibilityRole="tab"
            accessibilityState={{ selected: props.index === i() }}
            onPress={() => props.onChange(i())}
          >
            <Text
              class={`pb-3 text-[15px] ${props.index === i() ? 'font-bold text-zinc-900 dark:text-white' : 'font-medium text-zinc-500'}`}
            >
              {label}
            </Text>
            <View
              class="h-1 w-14 rounded-full"
              style={{ backgroundColor: props.index === i() ? accent() : 'transparent' }}
            />
          </Pressable>
        )}
      </For>
    </View>
  );
}
