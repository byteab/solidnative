/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { SafeAreaView, ScrollView, Switch, Text, View } from '@solidnative/components/solid';
import { For } from '@solidnative/platform/solid';
import { MiniPlayerBar } from '../now-playing/mini-player-bar.solid.tsx';

const row = (label: string, on: boolean) => {
  const [value, setValue] = createSignal(on);
  return { label, value, setValue };
};

/**
 * One template that follows each platform's conventions: an inset grouped list with a large
 * title on iOS, a flat list under a tinted section header on Android - the `ios:` and `android:`
 * variants do it, the same pattern the wallet example's settings screen uses.
 */
export function Settings() {
  const sections = [
    {
      title: 'Playback',
      rows: [row('High quality audio', true), row('Autoplay related songs', false)],
    },
    { title: 'Notifications', rows: [row('New releases', true)] },
  ];
  return (
    <>
      <SafeAreaView
        class="flex-1 bg-zinc-100 dark:bg-black android:bg-white android:dark:bg-zinc-950"
        edges={['top']}
      >
        <ScrollView class="flex-1">
          <Text class="px-5 pt-4 pb-3 text-zinc-900 dark:text-white ios:text-3xl ios:font-bold android:text-2xl">
            Settings
          </Text>
          <For each={sections}>
            {(section) => (
              <>
                <Text class="px-5 pt-4 pb-2 text-xs text-zinc-500 ios:uppercase android:font-semibold android:text-rose-600">
                  {section.title}
                </Text>
                <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-xl android:bg-transparent">
                  <For each={section.rows}>
                    {(r, i) => (
                      <View
                        class={`flex-row items-center justify-between px-4 ios:py-3 android:py-4 ${
                          i() === section.rows.length - 1
                            ? ''
                            : 'border-b-hairline border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        <Text class="text-zinc-900 dark:text-white">{r.label}</Text>
                        <Switch
                          accessibilityLabel={r.label}
                          value={r.value()}
                          onValueChange={r.setValue}
                        />
                      </View>
                    )}
                  </For>
                </View>
              </>
            )}
          </For>
        </ScrollView>
      </SafeAreaView>
      <MiniPlayerBar />
    </>
  );
}
