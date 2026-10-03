/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Cloud, CloudOff, Plus, RefreshCw } from 'lucide-static';
import { Icon, IconProvider } from '@solid-native/icons/solid';
import { ColorScheme, useService } from '@solid-native/device/solid';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { For, Show } from '@solid-native/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeSearchBar,
  NativeStackOutlet,
  useNavigation,
} from '@solid-native/router/solid';
import { matchesQuery } from '../data/note.ts';
import { Notes, type SyncStatus } from '../sync/notes.solid.ts';
import { NoteRow } from './note-row.solid.tsx';

/** The Notes tab is a stack of its own, for the native header's large title and search bar. */
export function NotesStack() {
  return <NativeStackOutlet />;
}

const STATUS_ICON: Record<SyncStatus, string> = {
  synced: 'Cloud',
  pending: 'RefreshCw',
  offline: 'CloudOff',
};

const STATUS_COLOUR: Record<SyncStatus, string> = {
  synced: '#22c55e',
  pending: '#f59e0b',
  offline: '#a1a1aa',
};

/** Every note, pinned first, searchable from the navigation bar. Pull down to sync now. */
export function NotesList() {
  const notes = useService(Notes);
  const navigation = useNavigation();
  const haptics = useService(Haptics);
  const colorScheme = useService(ColorScheme);
  const [query, setQuery] = createSignal('');

  /** The header button's icon: near-black on the light header, near-white on the dark one. */
  const iconColour = () => (colorScheme.current() === 'dark' ? '#fafafa' : '#18181b');
  const shown = createMemo(() => notes.notes().filter((note) => matchesQuery(note, query())));
  const statusLabel = createMemo(() => {
    const status = notes.status();
    if (status === 'offline') return 'Offline';
    if (status === 'pending') return `${notes.pendingCount()} pending`;
    return 'Synced';
  });

  const openNote = (id: string) => void navigation.push(`/note/${id}`);
  const togglePin = (id: string) => {
    void notes.togglePin(id);
    haptics.select();
  };

  return (
    <IconProvider icons={{ Cloud, CloudOff, Plus, RefreshCw }}>
      <NativeHeader title="Notes" largeTitle>
        <NativeHeaderItem type="searchBar">
          <NativeSearchBar
            testID="search"
            placeholder="Search notes"
            query={query()}
            onQueryChange={setQuery}
          />
        </NativeHeaderItem>
        <NativeHeaderItem type="right">
          <Pressable
            class="size-8 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="New note"
            onPress={() => void navigation.push('/note/new')}
          >
            <Icon name="Plus" size={22} color={iconColour()} />
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>

      <ScrollView
        class="flex-1 bg-white dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
        testID="notes-list"
        refreshControl={{
          get refreshing() {
            return notes.isRefreshing();
          },
          onRefresh: () => void notes.refresh(),
        }}
      >
        <View class="flex-row items-center gap-1.5 border-b-hairline border-zinc-200 px-5 py-2 dark:border-zinc-800">
          <Icon
            name={STATUS_ICON[notes.status()]}
            size={12}
            color={STATUS_COLOUR[notes.status()]}
          />
          <Text class="text-xs text-zinc-500">{statusLabel()}</Text>
        </View>

        <Show
          when={shown().length > 0}
          fallback={
            <View class="items-center px-8 py-16">
              <Text class="text-base font-semibold text-zinc-900 dark:text-white">
                {query() ? 'No matching notes' : 'No notes yet'}
              </Text>
              <Text class="mt-1 text-center text-sm text-zinc-500">
                {query() ? 'Try a different search.' : 'Tap + to write the first one.'}
              </Text>
            </View>
          }
        >
          <For each={shown().map((note) => note.id)}>
            {(id) => (
              <NoteRow
                note={notes.find(id)!}
                onOpen={() => openNote(id)}
                onPin={() => togglePin(id)}
              />
            )}
          </For>
        </Show>
      </ScrollView>
    </IconProvider>
  );
}
