/** @jsxImportSource @solid-native/platform/solid */
import { Image, Pressable, ScrollView } from '@solid-native/components/solid';
import { For, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader, useNavigation } from '@solid-native/router/solid';
import { PHOTOS } from './photos.solid.ts';
import sheet from './gallery.native.css';

export function Gallery() {
  const nav = useNavigation(),
    photos = PHOTOS,
    grid = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4, padding: 4 };
  const open = (index: number) => {
    void nav.present(`/photos/${index}`, { as: 'pageSheet' });
  };
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title="Photos"></NativeHeader>
      <ScrollView class="screen" contentContainerStyle={grid}>
        <For each={photos}>
          {(photo, i) => (
            <>
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={photo.title}
                onPress={() => {
                  open(i());
                }}
              >
                <Image resizeMode="cover" class="thumb" source={{ uri: photo.uri }}></Image>
              </Pressable>
            </>
          )}
        </For>
      </ScrollView>
    </view>
  ));
}
