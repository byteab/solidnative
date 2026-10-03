/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Image, Pressable, Text, View, VirtualList } from '@solidnative/components/solid';
import { For, Show } from '@solidnative/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  useNavigation,
  useRoute,
} from '@solidnative/router/solid';
import { ME, accent, compact, likedPosts, postsBy, user } from '../flock.solid.ts';
import { openSettings } from '../sheets.solid.ts';
import { FollowButton } from '../explore/explore.solid.tsx';
import { Avatar } from '../ui/avatar.solid.tsx';
import { Glyph } from '../ui/glyph.solid.tsx';
import { PostRow, useMuted } from '../ui/post-row.solid.tsx';
import { Segments } from '../ui/segments.solid.tsx';

/** The Profile tab (yourself) and any pushed `user/:handle`: banner, bio, numbers, then posts. */
export function Profile() {
  const route = useRoute();
  const navigation = useNavigation();
  const muted = useMuted();
  const handle = () => route.params['handle'] ?? ME;
  const me = () => handle() === ME;
  const u = () => user(handle());
  const [tab, setTab] = createSignal(0);
  const shown = createMemo(() => {
    const all = postsBy(handle());
    if (tab() === 0) return all.filter((p) => !p.replyTo);
    if (tab() === 1) return all.filter((p) => p.replyTo);
    return me() ? likedPosts() : [];
  });

  const header = (
    <View>
      <View class="h-28">
        <View class="absolute inset-0" style={{ backgroundColor: u().color, opacity: 0.85 }} />
        <Show when={u().cover}>
          {(cover) => (
            <Image class="absolute inset-0" source={{ uri: cover() }} resizeMode="cover" />
          )}
        </Show>
      </View>
      <View class="px-4">
        <View class="-mt-10 flex-row items-end justify-between">
          <View class="rounded-full border-4 border-white dark:border-black">
            <Avatar handle={handle()} size={76} />
          </View>
          <Show when={me()} fallback={<FollowButton handle={handle()} />}>
            <Pressable
              class="rounded-full border border-zinc-300 px-4 py-1.5 dark:border-zinc-700"
              accessibilityRole="button"
              onPress={() => openSettings(navigation)}
            >
              <Text class="text-sm font-bold text-zinc-900 dark:text-white">Edit profile</Text>
            </Pressable>
          </Show>
        </View>
        <View class="mt-2 flex-row items-center gap-1">
          <Text class="text-xl font-extrabold text-zinc-900 dark:text-white">{u().name}</Text>
          <Show when={u().verified}>
            <Glyph name="checkmark.seal.fill" size={18} color={accent()} />
          </Show>
        </View>
        <Text style={{ color: muted() }}>@{u().handle}</Text>
        <Text class="mt-3 text-[15px] text-zinc-900 dark:text-white">
          <For each={u().bio.split(/(@\w+)/)}>
            {(part) => (
              <Text style={part.startsWith('@') ? { color: accent() } : undefined}>{part}</Text>
            )}
          </For>
        </Text>
        <View class="mt-3 flex-row flex-wrap gap-x-4 gap-y-1">
          <Show when={u().location}>
            {(location) => (
              <View class="flex-row items-center gap-1">
                <Glyph name="mappin.and.ellipse" size={15} color={muted()} />
                <Text style={{ color: muted() }}>{location()}</Text>
              </View>
            )}
          </Show>
          <Show when={u().website}>
            {(website) => (
              <View class="flex-row items-center gap-1">
                <Glyph name="link" size={15} color={muted()} />
                <Text style={{ color: accent() }}>{website()}</Text>
              </View>
            )}
          </Show>
          <Show when={u().joined}>
            {(joined) => (
              <View class="flex-row items-center gap-1">
                <Glyph name="calendar" size={15} color={muted()} />
                <Text style={{ color: muted() }}>{`Joined ${joined()}`}</Text>
              </View>
            )}
          </Show>
        </View>
        <View class="mt-3 mb-3 flex-row gap-4">
          <Text style={{ color: muted() }}>
            <Text class="font-bold text-zinc-900 dark:text-white">{compact(u().following)}</Text>{' '}
            Following
          </Text>
          <Text style={{ color: muted() }}>
            <Text class="font-bold text-zinc-900 dark:text-white">{compact(u().followers)}</Text>{' '}
            Followers
          </Text>
        </View>
      </View>
      <Segments values={['Posts', 'Replies', 'Likes']} index={tab()} onChange={setTab} />
    </View>
  );

  return (
    <>
      <NativeHeader title={me() ? 'Profile' : u().name} backTitle="Back">
        <Show when={me()}>
          <NativeHeaderItem type="right">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={10}
              onPress={() => openSettings(navigation)}
            >
              <Glyph name="gearshape" size={20} color={accent()} />
            </Pressable>
          </NativeHeaderItem>
        </Show>
      </NativeHeader>
      <VirtualList
        class="flex-1 bg-white dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
        items={shown()}
        estimatedItemHeight={140}
        keyExtractor={(post) => post.id}
        listHeader={header}
        listFooter={
          <Show when={!shown().length}>
            <Text class="px-8 pt-12 text-center" style={{ color: muted() }}>
              {tab() === 2 && !me() ? 'Likes are private.' : 'Nothing here yet.'}
            </Text>
          </Show>
        }
        renderItem={(post) => <PostRow post={post()} />}
      />
    </>
  );
}
