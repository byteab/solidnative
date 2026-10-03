/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { For, Show } from '@solidnative/platform/solid';
import { NativeHeader, useNavigation, useRoute } from '@solidnative/router/solid';
import { accent, compact, post, repliesTo, textSize, user } from '../flock.solid.ts';
import { Avatar } from '../ui/avatar.solid.tsx';
import { Glyph } from '../ui/glyph.solid.tsx';
import { ActionBar, PostMedia, PostRow, useMuted, useTabPath } from '../ui/post-row.solid.tsx';

const stamp = (time: number) =>
  new Date(time).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** A pushed screen: the post in full, its numbers, and the replies under it. */
export function PostDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const muted = useMuted();
  const tabPath = useTabPath();
  const current = () => post(route.params['id']!);
  const stat = (n: number, label: string) => (
    <Text style={{ color: muted() }}>
      <Text class="font-bold text-zinc-900 dark:text-white">{compact(n)}</Text> {label}
    </Text>
  );
  return (
    <>
      <NativeHeader title="Post" backTitle="Back" />
      <ScrollView class="flex-1 bg-white dark:bg-black" contentInsetAdjustmentBehavior="automatic">
        <Show when={current()}>
          {(p) => (
            <>
              <View class="px-4 pt-3">
                <Pressable
                  class="flex-row items-center gap-3"
                  onPress={() => void navigation.push(tabPath(`user/${p().author}`))}
                >
                  <Avatar handle={p().author} size={48} />
                  <View class="flex-1">
                    <View class="flex-row items-center gap-1">
                      <Text class="text-base font-bold text-zinc-900 dark:text-white">
                        {user(p().author).name}
                      </Text>
                      <Show when={user(p().author).verified}>
                        <Glyph name="checkmark.seal.fill" size={16} color={accent()} />
                      </Show>
                    </View>
                    <Text style={{ color: muted() }}>@{p().author}</Text>
                  </View>
                </Pressable>
                <Text
                  class="mt-3 text-zinc-900 dark:text-white"
                  style={{ fontSize: textSize() + 4, lineHeight: (textSize() + 4) * 1.3 }}
                  selectable
                >
                  {p().text}
                </Text>
                <Show when={p().image}>{(image) => <PostMedia image={image()} />}</Show>
                <Text class="mt-3" style={{ color: muted() }}>
                  {`${stamp(p().createdAt)} · `}
                  <Text class="font-bold text-zinc-900 dark:text-white">{compact(p().views)}</Text>
                  {' Views'}
                </Text>
                <View class="mt-3 flex-row gap-4 border-y-hairline border-zinc-200 py-3 dark:border-zinc-800">
                  {stat(p().reposts, 'Reposts')}
                  {stat(p().likes, 'Likes')}
                  {stat(p().replies, 'Replies')}
                </View>
                <View class="border-b-hairline border-zinc-200 dark:border-zinc-800">
                  <ActionBar post={p()} large />
                </View>
              </View>
              <For each={repliesTo(p().id)}>{(reply) => <PostRow post={reply} />}</For>
              <View class="h-40" />
            </>
          )}
        </Show>
      </ScrollView>
    </>
  );
}
