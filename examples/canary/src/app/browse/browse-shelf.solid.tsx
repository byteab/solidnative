/** @jsxImportSource @solidnative/platform/solid */
import { createRenderEffect, createSignal } from 'solid-js';
import {
  Pressable,
  Text,
  View,
  VirtualList,
  type VirtualListRef,
} from '@solidnative/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import { ShelfPositions, type Album, type Shelf } from './browse-shelves.solid.ts';
import sheet from './browse-shelf.native.css';
const CARD = 132;
export function BrowseShelf(props: { shelf: Shelf; onOpen: (album: Album) => void }) {
  const positions = useService(ShelfPositions),
    front = useService(SCREEN_IN_FRONT);
  const [list, setList] = createSignal<VirtualListRef>();
  createRenderEffect(() => {
    const shelf = props.shelf;
    if (front()) list()?.scrollToOffset({ offset: positions.get(shelf.id), animated: false });
  });
  return withNativeStyles(sheet, () => (
    <VirtualList
      ref={setList}
      class="shelf"
      nativeID={'shelf-' + props.shelf.id}
      horizontal
      items={props.shelf.albums}
      itemHeight={CARD}
      keyExtractor={(album) => album.id}
      recycleItems
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(event) => {
        if (front()) positions.set(props.shelf.id, event.nativeEvent?.contentOffset?.x ?? 0);
      }}
      renderItem={(album) => (
        <Pressable
          nativeID={'card-' + album().id}
          accessibilityRole="button"
          accessibilityLabel={album().title}
          onPress={() => front() && props.onOpen(album())}
        >
          <View class="cover" style={{ backgroundColor: 'hsl(' + album().hue + ', 55%, 55%)' }} />
          <Text class="body" numberOfLines={1}>
            {album().title}
          </Text>
        </Pressable>
      )}
    />
  ));
}
