/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { For, Show, withNativeStyles } from '@solid-native/platform/solid';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  VirtualList,
} from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeSearchBar,
  useNavigation,
} from '@solid-native/router/solid';
import { type CatalogueItem, RecentSearches, type Scope, StoreSearch } from './catalogue.solid.ts';
import { createSearchState, type SearchRow } from './search-state.solid.ts';
import styles from './music-search.native.css';

const scopes: readonly { value: Scope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'artist', label: 'Artists' },
  { value: 'album', label: 'Albums' },
  { value: 'song', label: 'Songs' },
];
const rowHeight = (row: SearchRow) => (row.kind === 'heading' ? 40 : 60);

export function MusicSearch() {
  const recents = useService(RecentSearches);
  const state = createSearchState(useService(StoreSearch));
  const nav = useNavigation(),
    inFront = useService(SCREEN_IN_FRONT);
  const [focused, setFocused] = createSignal(false);
  let active = true;
  onCleanup(() => {
    active = false;
  });
  const submit = (query: string) => {
    recents.remember(query);
    if (active) state.submit(query);
  };
  const useRecent = (query: string) => {
    state.setQuery(query);
    if (active) submit(query);
  };
  const open = (item: CatalogueItem) => {
    recents.remember(state.query());
    if (active && inFront())
      void nav.push(`/search-demo/${encodeURIComponent(item.id)}`, {
        state: { title: item.title },
      });
  };
  return withNativeStyles(styles, () => (
    <>
      <NativeHeader title="Search" largeTitle>
        <NativeHeaderItem type="searchBar">
          <NativeSearchBar
            placeholder="Artists, albums, songs"
            placement="stacked"
            hideWhenScrolling={false}
            autoCapitalize="none"
            query={state.query()}
            onQueryChange={state.setQuery}
            onSearch={submit}
            onSearchFocus={() => setFocused(true)}
            onSearchBlur={() => setFocused(false)}
            onCancel={() => setFocused(false)}
          />
        </NativeHeaderItem>
      </NativeHeader>
      <VirtualList
        class="screen list"
        contentInsetAdjustmentBehavior="automatic"
        items={state.rows()}
        itemHeight={rowHeight}
        keyExtractor={(row) => row.id}
        keyboardDismissMode="on-drag"
        listHeader={
          <View>
            <View class="scopes">
              <For each={scopes}>
                {(option) => (
                  <Pressable
                    class={state.scope() === option.value ? 'chip chip-on' : 'chip'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: state.scope() === option.value }}
                    onPress={() => state.setScope(option.value)}
                  >
                    <Text class="chip-label">{option.label}</Text>
                  </Pressable>
                )}
              </For>
            </View>
            <Show when={focused() && recents.items().length > 0}>
              <View class="suggestions">
                <Show
                  when={!state.query().trim()}
                  fallback={
                    <For each={state.local().slice(0, 5)}>
                      {(item) => (
                        <Pressable
                          class="suggestion"
                          accessibilityRole="button"
                          onPress={() => useRecent(item.title)}
                        >
                          <Text class="body">{item.title}</Text>
                        </Pressable>
                      )}
                    </For>
                  }
                >
                  <Text class="hint">Recent</Text>
                  <For each={recents.items()}>
                    {(recent) => (
                      <View class="suggestion">
                        <Pressable
                          class="grow"
                          accessibilityRole="button"
                          onPress={() => useRecent(recent)}
                        >
                          <Text class="body">{recent}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={'Forget ' + recent}
                          onPress={() => recents.forget(recent)}
                        >
                          <Text class="hint">Forget</Text>
                        </Pressable>
                      </View>
                    )}
                  </For>
                </Show>
              </View>
            </Show>
          </View>
        }
        renderItem={(row) => (
          <>
            <Show when={row().kind === 'heading'}>
              <Text class="heading-row">
                {(row() as Extract<SearchRow, { kind: 'heading' }>).text}
              </Text>
            </Show>
            <Show when={row().kind === 'item'}>
              <Pressable
                class="result"
                accessibilityRole="button"
                onPress={() => open((row() as Extract<SearchRow, { kind: 'item' }>).item)}
              >
                <Text class="body">
                  {(row() as Extract<SearchRow, { kind: 'item' }>).item.title}
                </Text>
                <Text class="hint">
                  {(row() as Extract<SearchRow, { kind: 'item' }>).item.subtitle}
                </Text>
              </Pressable>
            </Show>
            <Show when={row().kind === 'status'}>
              <View class="status">
                <Show when={(row() as Extract<SearchRow, { kind: 'status' }>).status === 'loading'}>
                  <ActivityIndicator />
                </Show>
                <Show when={(row() as Extract<SearchRow, { kind: 'status' }>).status === 'failed'}>
                  <Text class="body danger">The store did not answer.</Text>
                  <Pressable accessibilityRole="button" onPress={state.reload}>
                    <Text class="action">Try again</Text>
                  </Pressable>
                </Show>
                <Show when={(row() as Extract<SearchRow, { kind: 'status' }>).status === 'none'}>
                  <Text class="hint">Nothing in the store for that.</Text>
                </Show>
              </View>
            </Show>
          </>
        )}
      />
    </>
  ));
}
