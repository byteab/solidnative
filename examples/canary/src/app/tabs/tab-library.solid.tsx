/** @jsxImportSource @solidnative/platform/solid */
import { For } from '@solidnative/platform/solid';
import { Pressable, ScrollView, Text } from '@solidnative/components/solid';
import {
  NativeHeader,
  NativeStackOutlet,
  useNavigation,
  useRoute,
} from '@solidnative/router/solid';
import { page } from '../screen-styles.ts';

export function TabLibrary() {
  return <NativeStackOutlet />;
}

export function LibraryList() {
  const navigation = useNavigation();
  const albums = ['Kind of Blue', 'Blue Train', 'Giant Steps'];
  return (
    <>
      <NativeHeader title="Library" largeTitle />
      <ScrollView
        class="screen"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={page.content}
      >
        <Text class="hint">
          Pushing from here keeps the tab bar. Switch tabs and come back: the pushed screen is still
          there, because the whole tab was detached rather than destroyed.
        </Text>
        <For each={albums}>
          {(album) => (
            <Pressable
              class="card"
              onPress={() => {
                void navigation.push(`/tabs/library/${encodeURIComponent(album)}`);
              }}
            >
              <Text class="button-label">{album}</Text>
            </Pressable>
          )}
        </For>
      </ScrollView>
    </>
  );
}

export function LibraryAlbum() {
  const route = useRoute();
  const album = () => String(route.inputs['album'] ?? '');
  return (
    <>
      <NativeHeader title={album()} backTitle="Library" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="heading">{album()}</Text>
        <Text class="body">
          Still inside the library tab. The bar is native chrome around this stack, not part of it.
        </Text>
      </ScrollView>
    </>
  );
}
