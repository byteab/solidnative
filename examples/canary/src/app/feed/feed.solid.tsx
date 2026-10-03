/** @jsxImportSource @solid-native/platform/solid */
import { createEffect, createSignal, onMount, untrack } from 'solid-js';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  VirtualList,
  type VirtualListRef,
} from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { Engine } from '@solid-native/fabric';
import { Show, useHostEngine, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { FeedBackend, type Post } from './feed-backend.solid.ts';
import { FeedPost } from './feed-post.solid.tsx';
import { createFeedStore } from './feed-store.solid.ts';
import sheet from './feed.native.css';
const READING = 40;
export function FeedPage() {
  const backend = useService(FeedBackend),
    store = createFeedStore(backend),
    front = useService(SCREEN_IN_FRONT),
    engine = useHostEngine();
  const [offline, setOffline] = createSignal(backend.offline),
    [reading, setReading] = createSignal(false),
    [stats, setStats] = createSignal('');
  let feed: VirtualListRef | undefined;
  const hold = { minIndexForVisible: 0, autoscrollToTopThreshold: READING };
  const estimate = (post: Post) =>
    110 +
    Math.ceil(post.text.length / 42) * 21 +
    (post.images.length ? 360 / (post.images[0]!.aspect || 1.5) : 0);
  createEffect(() => {
    if (store.unseen() > 0 && !reading()) untrack(store.markSeen);
  });
  onMount(() => void store.loadMore());
  function sample() {
    if (!(engine instanceof Engine)) return;
    const stats = engine.stats,
      round = (value: number) => Math.round(value * 10) / 10;
    setStats(
      `${stats.commits} commits, worst ${round(stats.worstCommitMs)}ms, ${stats.slowCommits} slow, ${stats.createdNodes} created, ${stats.clonedNodes} cloned`,
    );
  }
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Feed" />
      <View class="screen">
        <View class="toolbar">
          <Pressable
            class="chip"
            accessibilityRole="button"
            onPress={() => front() && void store.refresh()}
          >
            <Text class="chip-label">3 new</Text>
          </Pressable>
          <Pressable
            class="chip"
            accessibilityRole="button"
            onPress={() => front() && void store.loadMany(5000)}
          >
            <Text class="chip-label">5,000 posts</Text>
          </Pressable>
          <Pressable
            class="chip"
            accessibilityRole="switch"
            accessibilityState={{ checked: offline() }}
            onPress={() => {
              if (front()) {
                setOffline(!offline());
                backend.offline = offline();
              }
            }}
          >
            <Text class="chip-label">{offline() ? 'Offline' : 'Online'}</Text>
          </Pressable>
          <Pressable class="chip" accessibilityRole="button" onPress={sample}>
            <Text class="chip-label">Stats</Text>
          </Pressable>
        </View>
        <Text class="hint stats">
          {store.posts().length} posts. {stats()}
        </Text>
        <Show
          when={!store.initialLoading()}
          fallback={
            <View class="centre">
              <ActivityIndicator size="large" />
            </View>
          }
        >
          <Show
            when={store.posts().length > 0 || store.pageState() !== 'failed'}
            fallback={
              <View class="centre">
                <Text class="body">The feed could not be loaded.</Text>
                <Pressable
                  class="button"
                  accessibilityRole="button"
                  onPress={() => void store.reset()}
                >
                  <Text class="button-label">Try again</Text>
                </Pressable>
              </View>
            }
          >
            <VirtualList
              ref={(ref) => {
                feed = ref;
              }}
              class="list"
              items={store.posts()}
              estimatedItemHeight={estimate}
              keyExtractor={(post) => post.id}
              itemType={(post) => post.kind}
              recycleItems
              maintainVisibleContentPosition={hold}
              endReachedThreshold={3}
              refreshControl={{
                refreshing: store.refreshing(),
                onRefresh: () => front() && void store.refresh(),
              }}
              onEndReached={() => front() && void store.loadMore()}
              onScroll={(event) => {
                if (!front()) return;
                const next = (event.nativeEvent?.contentOffset?.y ?? 0) > READING;
                setReading(next);
                if (!next) store.markSeen();
              }}
              renderItem={(post) => (
                <View>
                  <FeedPost
                    post={post()}
                    galleryPage={store.galleryPage(post().id)}
                    onLike={() => store.toggleLike(post().id)}
                    onBookmark={() => store.toggleBookmark(post().id)}
                    onEdit={() => store.edit(post().id)}
                    onRemove={() => store.remove(post().id)}
                    onGalleryPage={(page) => store.setGalleryPage(post().id, page)}
                  />
                </View>
              )}
              listFooter={
                <View class="footer">
                  <Show when={store.pageState() === 'loading'}>
                    <ActivityIndicator />
                  </Show>
                  <Show when={store.pageState() === 'failed'}>
                    <Text class="body">Could not load more posts.</Text>
                    <Pressable
                      class="button"
                      accessibilityRole="button"
                      onPress={() => void store.loadMore()}
                    >
                      <Text class="button-label">Retry</Text>
                    </Pressable>
                  </Show>
                  <Show when={store.pageState() === 'done'}>
                    <Text class="hint">You are all caught up.</Text>
                  </Show>
                </View>
              }
            />
          </Show>
        </Show>
        <Show when={store.unseen() > 0 && reading()}>
          <Pressable
            class="pill"
            accessibilityRole="button"
            onPress={() => {
              if (front()) {
                store.markSeen();
                feed?.scrollToOffset({ offset: 0, animated: true });
              }
            }}
          >
            <Text class="pill-label">{store.unseen()} new posts</Text>
          </Pressable>
        </Show>
        <Show when={store.notice()}>
          {(notice) => (
            <Pressable class="toast" accessibilityRole="alert" onPress={store.dismissNotice}>
              <Text class="toast-label">{notice()}</Text>
            </Pressable>
          )}
        </Show>
      </View>
    </>
  ));
}
