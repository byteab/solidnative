/** @jsxImportSource @solid-native/platform/solid */
import { onCleanup } from 'solid-js';
import { Pressable, ScrollView, Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Show } from '@solid-native/platform/solid';
import { NativeHeader, useNavigation, useRoute } from '@solid-native/router/solid';
import { Toasts } from './toasts.solid.ts';

/** The same app-owned overlay can cover a screen or its presented sheet. */
export function OverlaysPage() {
  const toasts = useService(Toasts),
    nav = useNavigation(),
    route = useRoute();
  const sheet = () => route.inputs['sheet'] === true;
  let active = true;
  const pending = new Set<() => void>();
  onCleanup(() => {
    active = false;
    for (const cancel of [...pending]) cancel();
  });
  const load = () => {
    if (!active) return;
    const work = new Promise<boolean>((resolve) => {
      const finish = (completed: boolean) => {
        clearTimeout(timer);
        pending.delete(cancel);
        resolve(completed);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(() => finish(true), 1500);
      pending.add(cancel);
    });
    void toasts.while(work).then((completed) => {
      if (active && completed) toasts.show('Loaded');
    });
  };
  return (
    <>
      <NativeHeader title={sheet() ? 'Sheet' : 'Overlays'} />
      <ScrollView class="screen" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Pressable
          class="button"
          accessibilityRole="button"
          onPress={() => toasts.show(sheet() ? 'Shown above the sheet' : 'Shown above the screen')}
        >
          <Text class="button-label">Show a toast</Text>
        </Pressable>
        <Pressable class="button" accessibilityRole="button" onPress={load}>
          <Text class="button-label">Load for a moment</Text>
        </Pressable>
        <Show when={!sheet()}>
          <Pressable
            class="button"
            accessibilityRole="button"
            onPress={() => {
              void nav.present('/overlays/sheet', { as: 'formSheet' });
            }}
          >
            <Text class="button-label">Open a sheet</Text>
          </Pressable>
        </Show>
      </ScrollView>
    </>
  );
}
