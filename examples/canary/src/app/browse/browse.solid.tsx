/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createRenderEffect, createSignal, onCleanup } from 'solid-js';
import {
  Pressable,
  Text,
  View,
  VirtualList,
  type VirtualListRef,
} from '@solidnative/components/solid';
import {
  SCREEN_IN_FRONT,
  ServiceScope,
  provideService,
  useService,
} from '@solidnative/device/solid';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, useNavigation } from '@solidnative/router/solid';
import { BrowseShelf } from './browse-shelf.solid.tsx';
import {
  ShelfPositions,
  ShelfPositionsSource,
  rowsOf,
  shelves,
  type Album,
} from './browse-shelves.solid.ts';
import sheet from './browse.native.css';
const jumps = [
  { name: 'Jazz', index: 0 },
  { name: 'Gospel', index: 8 },
  { name: 'Vocal', index: 30 },
  { name: 'Electronic', index: 46 },
];
export function Browse() {
  return (
    <ServiceScope services={[provideService(ShelfPositions, () => new ShelfPositionsSource())]}>
      <BrowseScreen />
    </ServiceScope>
  );
}
function BrowseScreen() {
  const nav = useNavigation(),
    front = useService(SCREEN_IN_FRONT);
  const [list, setList] = createSignal(shelves()),
    [refreshing, setRefreshing] = createSignal(false),
    [far, setFar] = createSignal(false);
  const rows = createMemo(() => rowsOf(list())),
    headings = createMemo(() =>
      rows().flatMap((row, index) => (row.kind === 'heading' ? [index] : [])),
    );
  let page: VirtualListRef | undefined,
    round = 0,
    active = true,
    epoch = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    epoch++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    setRefreshing(false);
  };
  createRenderEffect(() => {
    if (!front()) cancel();
  });
  onCleanup(() => {
    active = false;
    cancel();
  });
  const refresh = () => {
    if (!front() || !active || refreshing()) return;
    const mine = ++epoch;
    setRefreshing(true);
    if (!active || !front() || epoch !== mine) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (active && front() && epoch === mine) {
        setList(shelves(++round));
        setRefreshing(false);
      }
    }, 600);
  };
  const open = (album: Album) => {
    if (front()) void nav.push(`/search-demo/${album.id}`, { state: { title: album.title } });
  };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Browse" />
      <View class="screen">
        <View class="toolbar">
          <For each={jumps}>
            {(genre) => (
              <Pressable
                class="chip"
                accessibilityRole="button"
                accessibilityLabel={'Jump to ' + genre.name}
                onPress={() =>
                  front() && page?.scrollToIndex({ index: genre.index, animated: true })
                }
              >
                <Text class="chip-label">{genre.name}</Text>
              </Pressable>
            )}
          </For>
        </View>
        <VirtualList
          ref={(ref) => {
            page = ref;
          }}
          class="list"
          items={rows()}
          estimatedItemHeight={(row) => (row.kind === 'heading' ? 44 : 170)}
          keyExtractor={(row) => `${row.kind}-${row.shelf.id}`}
          itemType={(row) => row.kind}
          recycleItems
          stickyIndices={headings()}
          scrollEventThrottle={16}
          refreshControl={{ refreshing: refreshing(), onRefresh: refresh }}
          onScroll={(event) => {
            if (front()) setFar((event.nativeEvent?.contentOffset?.y ?? 0) > 900);
          }}
          renderItem={(row) => (
            <View nativeID={'row-' + row().kind + '-' + row().shelf.id}>
              <Show
                when={row().kind === 'heading'}
                fallback={<BrowseShelf shelf={row().shelf} onOpen={open} />}
              >
                <View class="heading-row">
                  <Text class="section" accessibilityRole="header">
                    {row().shelf.genre}
                  </Text>
                </View>
              </Show>
            </View>
          )}
        />
        <Show when={far()}>
          <Pressable
            class="pill"
            accessibilityRole="button"
            onPress={() => front() && page?.scrollToOffset({ offset: 0, animated: true })}
          >
            <Text class="pill-label">Top</Text>
          </Pressable>
        </Show>
      </View>
    </>
  ));
}
