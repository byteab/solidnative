/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { SafeAreaView, ScrollView, Switch, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { SecureStorage } from '@solidnative/expo/solid/store';
import { For } from '@solidnative/platform/solid';

interface Toggle {
  (): boolean;
  set(value: boolean): void;
}
function toggle(initial: boolean): Toggle {
  const [on, set] = createSignal(initial);
  return Object.assign(on, { set: (value: boolean) => void set(value) });
}

/**
 * One screen that follows each platform's conventions: an inset grouped list with a large title
 * on iOS, a flat list under a tinted section header on Android. The ios: and android: variants
 * do it; nothing branches in TypeScript.
 */
export function Settings() {
  const sections = [
    {
      title: 'Privacy',
      rows: [
        // Kept in the keychain, and the same signal the home screen's card reads.
        { label: 'Hide balance', on: useService(SecureStorage).signal('hide-balance', false) },
      ],
    },
    {
      title: 'Notifications',
      rows: [
        { label: 'Payments', on: toggle(true) },
        { label: 'Salary arrived', on: toggle(true) },
        { label: 'Offers', on: toggle(false) },
      ],
    },
  ];
  return (
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
                  {(row, index) => (
                    <View
                      class={`flex-row items-center justify-between px-4 ios:py-3 android:py-4 ${index() === section.rows.length - 1 ? '' : 'border-b-hairline border-zinc-200 dark:border-zinc-800'}`}
                    >
                      <Text class="text-zinc-900 dark:text-white">{row.label}</Text>
                      <Switch
                        accessibilityLabel={row.label}
                        value={row.on()}
                        onValueChange={(value) => row.on.set(value)}
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
  );
}
