/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { For, Show } from '@solid-native/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeSearchBar,
  useNavigation,
} from '@solid-native/router/solid';
import { ME, USERS, accent, isFollowing, timeline, toggleFollow, user } from '../flock.solid.ts';
import { Avatar } from '../ui/avatar.solid.tsx';
import { Glyph } from '../ui/glyph.solid.tsx';
import { PostRow, useMuted, useTabPath } from '../ui/post-row.solid.tsx';

const TRENDS = [
  { topic: 'Technology · Trending', title: '#SolidNative', posts: '42.1K posts' },
  { topic: 'Programming · Trending', title: 'createSignal', posts: '18.7K posts' },
  { topic: 'Programming', title: 'Fine-grained reactivity', posts: '9,312 posts' },
  { topic: 'Trending in Mobile', title: 'Expo UI', posts: '6,040 posts' },
  { topic: 'Technology', title: 'Solid stores', posts: '3,877 posts' },
];

export function FollowButton(props: { handle: string }) {
  const following = () => isFollowing(props.handle);
  return (
    <Pressable
      class="rounded-full px-4 py-1.5 active:opacity-80"
      style={{
        backgroundColor: following() ? 'transparent' : accent(),
        borderWidth: following() ? 1 : 0,
        borderColor: '#cfd9de',
      }}
      accessibilityRole="button"
      onPress={() => toggleFollow(props.handle)}
    >
      <Text
        class={`text-sm font-bold ${following() ? 'text-zinc-900 dark:text-white' : 'text-white'}`}
      >
        {following() ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

function PersonRow(props: { handle: string }) {
  const navigation = useNavigation();
  const muted = useMuted();
  const tabPath = useTabPath();
  return (
    <Pressable
      class="flex-row items-center gap-3 px-4 py-3 active:bg-black/5"
      onPress={() => void navigation.push(tabPath(`user/${props.handle}`))}
    >
      <Avatar handle={props.handle} />
      <View class="flex-1">
        <View class="flex-row items-center gap-1">
          <Text class="font-bold text-zinc-900 dark:text-white">{user(props.handle).name}</Text>
          <Show when={user(props.handle).verified}>
            <Glyph name="checkmark.seal.fill" size={15} color={accent()} />
          </Show>
        </View>
        <Text style={{ color: muted() }}>@{props.handle}</Text>
      </View>
      <FollowButton handle={props.handle} />
    </Pressable>
  );
}

/** A native search field in the bar, filtering people and posts as you type. */
export function Explore() {
  const muted = useMuted();
  const [query, setQuery] = createSignal('');
  const q = () => query().trim().toLowerCase();
  const people = createMemo(() =>
    Object.values(USERS)
      .filter((u) => u.handle !== ME)
      .filter((u) => !q() || `${u.name} ${u.handle}`.toLowerCase().includes(q())),
  );
  const posts = createMemo(() =>
    q() ? timeline().filter((p) => p.text.toLowerCase().includes(q())) : [],
  );
  return (
    <>
      <NativeHeader title="Explore">
        <NativeHeaderItem type="searchBar">
          <NativeSearchBar
            placeholder="Search Flock"
            hideWhenScrolling={false}
            query={query()}
            onQueryChange={setQuery}
            tintColor={accent()}
          />
        </NativeHeaderItem>
      </NativeHeader>
      <ScrollView
        class="flex-1 bg-white dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
      >
        <Show when={!q()}>
          <Text class="px-4 pt-4 pb-1 text-xl font-extrabold text-zinc-900 dark:text-white">
            Trends for you
          </Text>
          <For each={TRENDS}>
            {(trend) => (
              <Pressable class="px-4 py-3 active:bg-black/5" onPress={() => setQuery(trend.title)}>
                <Text class="text-[13px]" style={{ color: muted() }}>
                  {trend.topic}
                </Text>
                <Text class="text-base font-bold text-zinc-900 dark:text-white">{trend.title}</Text>
                <Text class="text-[13px]" style={{ color: muted() }}>
                  {trend.posts}
                </Text>
              </Pressable>
            )}
          </For>
        </Show>
        <Show when={people().length}>
          <Text class="px-4 pt-5 pb-1 text-xl font-extrabold text-zinc-900 dark:text-white">
            {q() ? 'People' : 'Who to follow'}
          </Text>
          <For each={people()}>{(u) => <PersonRow handle={u.handle} />}</For>
        </Show>
        <Show when={posts().length}>
          <Text class="px-4 pt-5 pb-1 text-xl font-extrabold text-zinc-900 dark:text-white">
            Posts
          </Text>
          <For each={posts()}>{(p) => <PostRow post={p} />}</For>
        </Show>
        <Show when={q() && !people().length && !posts().length}>
          <Text class="px-8 pt-16 text-center" style={{ color: muted() }}>
            {`No results for "${query()}"`}
          </Text>
        </Show>
        <View class="h-32" />
      </ScrollView>
    </>
  );
}
