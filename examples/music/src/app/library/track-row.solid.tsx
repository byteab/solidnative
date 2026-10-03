/** @jsxImportSource @solid-native/platform/solid */
import { Image, Text, View } from '@solid-native/components/solid';
import { formatDuration, type Album, type Track } from '../catalogue/catalogue.solid.ts';

/** One track: artwork, title, artist and album, and its length. Highlights while it is playing. */
export function TrackRow(props: { track: Track; album: Album; playing?: boolean }) {
  return (
    <View class="flex-row items-center gap-3">
      <Image source={props.album.artwork} class="size-11 rounded-lg" resizeMode="cover" />
      <View class="flex-1">
        <Text
          class={`font-semibold ${props.playing ? 'text-rose-600' : 'text-zinc-900 dark:text-white'}`}
          numberOfLines={1}
        >
          {props.track.title}
        </Text>
        <Text class="text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
          {`${props.track.artist} · ${props.album.title}`}
        </Text>
      </View>
      <Text class="text-xs text-zinc-400 dark:text-zinc-500">
        {formatDuration(props.track.duration)}
      </Text>
    </View>
  );
}
