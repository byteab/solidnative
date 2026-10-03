/** @jsxImportSource @solidnative/platform/solid */
import { createMemo } from 'solid-js';
import { Dialogs, useService } from '@solidnative/device/solid';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from '@solidnative/components/solid';
import { Show } from '@solidnative/platform/solid';
import { Notes } from '../sync/notes.solid.ts';

export function formatLastSynced(timestamp: number | null): string {
  if (timestamp === null) return 'Never';
  const diffMinutes = Math.round((Date.now() - timestamp) / 60_000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return new Date(timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Sync, and a way to wipe the local cache - the fake server that makes offline demonstrable. */
export function Settings() {
  const notes = useService(Notes);
  const dialogs = useService(Dialogs);
  const lastSynced = createMemo(() => formatLastSynced(notes.lastSyncedAt()));

  async function clearLocalData(): Promise<void> {
    const sure = await dialogs.confirm('Clear local data?', {
      message: 'Every note on this device is deleted. Anything already synced stays on the server.',
      destructive: true,
    });
    if (!sure) return;
    await notes.clearLocalData();
  }

  return (
    <SafeAreaView class="flex-1 bg-zinc-100 dark:bg-black" edges={['top']}>
      <ScrollView class="flex-1">
        <Text class="px-5 pt-4 pb-3 text-3xl font-bold text-zinc-900 dark:text-white">
          Settings
        </Text>

        <Text class="px-5 pt-4 pb-2 text-xs text-zinc-500 uppercase">Sync</Text>
        <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-xl">
          <View class="flex-row items-center justify-between px-4 py-3">
            <Text class="text-zinc-900 dark:text-white">Sync notes</Text>
            <Switch
              accessibilityLabel="Sync notes"
              value={notes.syncEnabled()}
              onValueChange={(on) => notes.syncEnabled.set(on)}
            />
          </View>
          <View class="flex-row items-center justify-between border-t-hairline border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Text class="text-zinc-900 dark:text-white">Last synced</Text>
            <Text class="text-zinc-500">{lastSynced()}</Text>
          </View>
          <Show when={notes.pendingCount() > 0}>
            <Text class="px-4 pb-3 text-sm text-amber-600">
              {notes.pendingCount()} note{notes.pendingCount() === 1 ? '' : 's'} waiting to sync.
            </Text>
          </Show>
        </View>

        <Text class="px-5 pt-6 pb-2 text-xs text-zinc-500 uppercase">Data</Text>
        <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-xl">
          <Pressable
            class="px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800"
            accessibilityRole="button"
            onPress={() => void clearLocalData()}
          >
            <Text class="text-rose-600">Clear local data</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
