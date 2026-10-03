/*
 * @jsxImportSource @solidnative/platform/solid
 *
 * Tailwind, with the native preset's variants: one component that follows each platform's
 * conventions (`ios:`, `android:`) and the system appearance (`dark:`). On iOS an inset grouped
 * list with rounded groups; on Android flat, full-width rows under tinted section headers.
 * Nothing branches in TypeScript.
 */
import { createSignal } from 'solid-js';
import { Switch, Text, View } from '@solidnative/components/solid';
import { ColorScheme, useService, useStatusBar } from '@solidnative/device/solid';
import { Icon } from '@solidnative/icons/solid';
import { For } from '@solidnative/platform/solid';
import { lucideSvg, type IconName } from '../icon.data.ts';

interface Row {
  readonly label: string;
  readonly icon: IconName;
  readonly tint: string;
}

const ROWS: readonly (Row & { readonly on: boolean })[] = [
  { label: 'Notifications', icon: 'bell', tint: '#ef4444', on: true },
  { label: 'Location', icon: 'map-pin', tint: '#3b82f6', on: false },
  { label: 'Face ID unlock', icon: 'shield', tint: '#10b981', on: true },
];

const ACCOUNT: readonly (Row & { readonly value: string })[] = [
  { label: 'Subscription', icon: 'crown', tint: '#f59e0b', value: 'Pro' },
  { label: 'Storage', icon: 'hard-drive', tint: '#71717a', value: '12.4 GB' },
];

function PreferenceRow(props: { row: Row & { on: boolean }; last: boolean }) {
  const [on, setOn] = createSignal(props.row.on);
  return (
    <View
      class={`flex-row items-center gap-3 px-4 ios:py-3 android:py-4 ${props.last ? '' : 'border-b border-zinc-200 dark:border-zinc-800 android:border-0'}`}
    >
      <View
        class="size-8 items-center justify-center ios:rounded-lg android:rounded-full"
        style={{ backgroundColor: props.row.tint }}
      >
        <Icon svg={lucideSvg(props.row.icon)} size={17} color="#ffffff" />
      </View>
      <Text class="flex-1 text-base text-zinc-950 dark:text-white">{props.row.label}</Text>
      <Switch value={on()} onValueChange={setOn} />
    </View>
  );
}

export default function Settings() {
  // Dark icons over the light screen, light ones over the dark one.
  const scheme = useService(ColorScheme);
  useStatusBar(() => ({ style: scheme.current() === 'dark' ? 'light' : 'dark' }));

  return (
    <View class="flex-1 bg-zinc-100 pt-16 dark:bg-black android:bg-white android:dark:bg-zinc-950">
      <Text class="px-5 text-zinc-950 dark:text-white ios:text-[34px] ios:font-bold android:text-2xl">
        Settings
      </Text>

      {/* excerpt: tsx */}
      <View class="mt-4 flex-row items-center gap-4 bg-white p-4 dark:bg-zinc-900 ios:mx-4 ios:rounded-2xl android:mx-4 android:rounded-3xl android:bg-rose-50 android:dark:bg-rose-950/40">
        <View class="size-14 items-center justify-center rounded-full bg-linear-to-br from-rose-500 to-amber-400">
          <Text class="text-lg font-bold text-white">AL</Text>
        </View>
        <View class="flex-1">
          <Text class="text-lg font-semibold text-zinc-950 dark:text-white">Ada Lovelace</Text>
          <Text class="text-sm text-zinc-500">Pro member since 2024</Text>
        </View>
        <Icon svg={lucideSvg('chevron-right')} size={20} color="#a1a1aa" />
      </View>
      {/* excerpt end */}

      <Text class="mt-6 px-5 pb-2 text-[13px] text-zinc-500 ios:uppercase android:font-semibold android:text-rose-600">
        Preferences
      </Text>
      <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-2xl android:bg-transparent">
        <For each={ROWS}>
          {(row, index) => <PreferenceRow row={row} last={index() === ROWS.length - 1} />}
        </For>
      </View>

      <Text class="mt-6 px-5 pb-2 text-[13px] text-zinc-500 ios:uppercase android:font-semibold android:text-rose-600">
        Account
      </Text>
      <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-2xl android:bg-transparent">
        <For each={ACCOUNT}>
          {(row, index) => (
            <View
              class={`flex-row items-center gap-3 px-4 py-3.5 android:py-4 ${index() === ACCOUNT.length - 1 ? '' : 'border-b border-zinc-200 dark:border-zinc-800 android:border-0'}`}
            >
              <View
                class="size-8 items-center justify-center ios:rounded-lg android:rounded-full"
                style={{ backgroundColor: row.tint }}
              >
                <Icon svg={lucideSvg(row.icon)} size={17} color="#ffffff" />
              </View>
              <Text class="flex-1 text-base text-zinc-950 dark:text-white">{row.label}</Text>
              <Text class="text-base text-zinc-500">{row.value}</Text>
              <Icon svg={lucideSvg('chevron-right')} size={18} color="#a1a1aa" />
            </View>
          )}
        </For>
      </View>
    </View>
  );
}
