/** @jsxImportSource @solid-native/platform/solid */
import { Image, Text, View } from '@solid-native/components/solid';
import type { Album } from '../catalogue/catalogue.solid.ts';

/** One album, in the library's horizontal row: artwork, title and artist. */
export function AlbumCard(props: { album: Album }) {
  return (
    <View class="w-36">
      <Image source={props.album.artwork} class="size-36 rounded-2xl" resizeMode="cover" />
      <Text class="mt-2 font-semibold text-zinc-900 dark:text-white" numberOfLines={1}>
        {props.album.title}
      </Text>
      <Text class="text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
        {props.album.artist}
      </Text>
    </View>
  );
}
