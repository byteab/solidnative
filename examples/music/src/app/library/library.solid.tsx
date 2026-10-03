/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Pressable, ScrollView, Text, View, VirtualList } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { For, Show } from '@solidnative/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeSearchBar,
  NativeStackOutlet,
  useNavigation,
} from '@solidnative/router/solid';
import { ALBUMS, TRACKS, album, type Album, type Track } from '../catalogue/catalogue.solid.ts';
import { MiniPlayerBar } from '../now-playing/mini-player-bar.solid.tsx';
import { Playback } from '../player/playback.solid.ts';
import { AlbumCard } from './album-card.solid.tsx';
import { TrackRow } from './track-row.solid.tsx';

/**
 * The library tab is a stack of its own: the native header its large title and search bar need.
 * The mini player sits over the whole stack, so it stays put as albums are pushed and popped.
 */
export function LibraryStack() {
  return (
    <>
      <NativeStackOutlet />
      <MiniPlayerBar />
    </>
  );
}

const albumOf = (track: Track): Album => album(track.albumId)!;

/**
 * Every album, in a horizontal row, and every track, searchable and in a virtual list below it -
 * the row rides as the list's `listHeader`, so both scroll together in one native scroll view.
 */
export function Library() {
  const playback = useService(Playback);
  const navigation = useNavigation();
  const rowHeight = 64;
  const [query, setQuery] = createSignal('');
  const searching = () => query().trim().length > 0;
  const shown = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return TRACKS;
    return TRACKS.filter((t) =>
      `${t.title} ${t.artist} ${albumOf(t).title}`.toLowerCase().includes(q),
    );
  });
  const isPlaying = (track: Track) => playback.playing() && playback.current()?.id === track.id;

  return (
    <>
      <NativeHeader title="Library" largeTitle>
        <NativeHeaderItem type="searchBar">
          <NativeSearchBar
            testID="search"
            placeholder="Search songs"
            query={query()}
            onQueryChange={setQuery}
          />
        </NativeHeaderItem>
      </NativeHeader>
      <VirtualList
        testID="tracks"
        class="flex-1 bg-white dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
        items={shown()}
        itemHeight={rowHeight}
        keyExtractor={(track) => track.id}
        listHeader={
          <Show when={!searching()}>
            <View class="px-5 pt-4 pb-2">
              <Text class="mb-3 text-lg font-bold text-zinc-900 dark:text-white">Albums</Text>
              <ScrollView class="h-52" horizontal showsHorizontalScrollIndicator={false}>
                <View class="flex-row gap-4 pb-2">
                  <For each={ALBUMS}>
                    {(a) => (
                      <Pressable
                        class="w-36"
                        accessibilityRole="button"
                        accessibilityLabel={a.title}
                        onPress={() => void navigation.push(`/library/album/${a.id}`)}
                      >
                        <AlbumCard album={a} />
                      </Pressable>
                    )}
                  </For>
                </View>
              </ScrollView>
              <Text class="mt-4 mb-1 text-lg font-bold text-zinc-900 dark:text-white">
                All songs
              </Text>
            </View>
          </Show>
        }
        renderItem={(track) => (
          <Pressable
            class="flex-1 justify-center px-5 active:bg-zinc-100 dark:active:bg-zinc-900"
            accessibilityRole="button"
            onPress={() => playback.playQueue(TRACKS, track().id)}
          >
            <TrackRow track={track()} album={albumOf(track())} playing={isPlaying(track())} />
          </Pressable>
        )}
      />
      <Show when={!shown().length}>
        <View class="absolute inset-x-0 top-1/3 items-center">
          <Text class="text-zinc-500">{`No songs match "${query()}"`}</Text>
        </View>
      </Show>
    </>
  );
}
