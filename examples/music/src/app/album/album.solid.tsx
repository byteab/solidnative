/** @jsxImportSource @solidnative/platform/solid */
import { Image, Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Icon } from '@solidnative/icons/solid';
import { For, Show } from '@solidnative/platform/solid';
import { NativeHeader, useRoute } from '@solidnative/router/solid';
import { album, tracksOf } from '../catalogue/catalogue.solid.ts';
import { TrackRow } from '../library/track-row.solid.tsx';
import { Playback } from '../player/playback.solid.ts';

/** One album in full: artwork, its tracks, and a button to play them all from the top. */
export function AlbumDetail() {
  const route = useRoute();
  const playback = useService(Playback);
  const id = () => String(route.inputs['id'] ?? '');
  const current = () => album(id());
  const tracks = () => tracksOf(id());
  const isPlaying = (trackId: string) => playback.playing() && playback.current()?.id === trackId;

  return (
    <>
      <NativeHeader title={current()?.title ?? 'Album'} />
      <ScrollView
        class="flex-1 bg-zinc-100 dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Show
          when={current()}
          fallback={<Text class="p-5 text-zinc-500">This album no longer exists.</Text>}
        >
          {(a) => (
            <>
              <View class="items-center gap-2 px-5 pt-6 pb-6">
                <Image source={a().artwork} class="size-48 rounded-3xl" resizeMode="cover" />
                <Text class="mt-3 text-xl font-bold text-zinc-900 dark:text-white">
                  {a().title}
                </Text>
                <Text class="text-sm text-zinc-500 dark:text-zinc-400">{a().artist}</Text>

                <Pressable
                  class="mt-4 flex-row items-center gap-2 rounded-full bg-rose-600 px-6 py-3 active:bg-rose-700"
                  accessibilityRole="button"
                  onPress={() => playback.playQueue(tracks())}
                >
                  <Icon name="Play" size={16} color="#ffffff" />
                  <Text class="font-semibold text-white">Play all</Text>
                </Pressable>
              </View>

              <View testID="album-tracks" class="mx-4 mb-8 rounded-xl bg-white dark:bg-zinc-900">
                <For each={tracks()}>
                  {(track, i) => (
                    <Pressable
                      class={`px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800 ${
                        i() === tracks().length - 1
                          ? ''
                          : 'border-b-hairline border-zinc-200 dark:border-zinc-800'
                      }`}
                      accessibilityRole="button"
                      onPress={() => playback.playQueue(tracks(), track.id)}
                    >
                      <TrackRow track={track} album={a()} playing={isPlaying(track.id)} />
                    </Pressable>
                  )}
                </For>
              </View>
            </>
          )}
        </Show>
      </ScrollView>
    </>
  );
}
