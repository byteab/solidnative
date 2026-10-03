/** @jsxImportSource @solidnative/platform/solid */
import { Image, Pressable, Text, View } from '@solidnative/components/solid';
import { ColorScheme, Dialogs, Sharing, useService } from '@solidnative/device/solid';
import { UiButton, UiDivider, UiHost, UiImage, UiMenu, UiSlot } from '@solidnative/expo/solid';
import { Haptics } from '@solidnative/expo/solid/haptics';
import { nativePlatform } from '@solidnative/fabric';
import { Show } from '@solidnative/platform/solid';
import { useNavigation, useRoute } from '@solidnative/router/solid';
import {
  accent,
  ago,
  compact,
  mute,
  textSize,
  toggleBookmark,
  toggleLike,
  toggleRepost,
  user,
  type Post,
  type PostImage,
} from '../flock.solid.ts';
import { openCompose } from '../sheets.solid.ts';
import { Avatar } from './avatar.solid.tsx';
import { Glyph } from './glyph.solid.tsx';

export const LIKE = '#f91880';
export const REPOST = '#00ba7c';

/** The tab this screen is in, so a push stays inside that tab's own stack. */
export function useTabPath() {
  const route = useRoute();
  return (rest: string) => `/${route.pathname.split('/')[1]}/${rest}`;
}

export function useMuted() {
  const scheme = useService(ColorScheme);
  return () => (scheme.current() === 'dark' ? '#71767b' : '#536471');
}

/** The ⋯ button: a real SwiftUI Menu on iOS, the platform's own dialog on Android. */
function MoreMenu(props: { post: Post }) {
  const dialogs = useService(Dialogs);
  const sharing = useService(Sharing);
  const muted = useMuted();
  const handle = () => user(props.post.author).handle;
  const share = () =>
    void sharing.share({ message: props.post.text, url: `https://flock.dev/${props.post.id}` });

  if (nativePlatform() === 'android')
    return (
      <Pressable
        class="size-8 items-center justify-center rounded-full active:bg-black/10"
        accessibilityRole="button"
        accessibilityLabel="More"
        onPress={async () => {
          const choice = await dialogs.choose(`@${handle()}`, [
            { label: props.post.bookmarked ? 'Remove bookmark' : 'Bookmark' },
            { label: `Mute @${handle()}`, style: 'destructive' },
          ]);
          if (choice === 0) toggleBookmark(props.post.id);
          if (choice === 1) mute(handle());
        }}
      >
        <Text class="text-lg leading-5" style={{ color: muted() }}>
          ⋮
        </Text>
      </Pressable>
    );

  return (
    <UiHost matchContents>
      <UiMenu modifiers={[{ $type: 'tint', color: muted() }]}>
        <UiSlot name="label">
          <UiImage systemName="ellipsis" size={15} color={muted()} />
        </UiSlot>
        <UiButton
          label={props.post.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          systemImage={props.post.bookmarked ? 'bookmark.slash' : 'bookmark'}
          onButtonPress={() => toggleBookmark(props.post.id)}
        />
        <UiButton label="Share post" systemImage="square.and.arrow.up" onButtonPress={share} />
        <UiDivider />
        <UiButton
          label={`Mute @${handle()}`}
          systemImage="speaker.slash"
          role="destructive"
          onButtonPress={() => mute(handle())}
        />
      </UiMenu>
    </UiHost>
  );
}

function Action(props: {
  label: string;
  symbol: string;
  color: string;
  count?: number;
  large?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      class="flex-row items-center gap-1 py-1.5"
      accessibilityRole="button"
      accessibilityLabel={props.label}
      hitSlop={6}
      onPress={() => props.onPress()}
    >
      <Glyph name={props.symbol} size={props.large ? 22 : 18} color={props.color} />
      <Show when={props.count !== undefined && !props.large}>
        <Text class="text-[13px]" style={{ color: props.color }}>
          {props.count ? compact(props.count) : ''}
        </Text>
      </Show>
    </Pressable>
  );
}

/** Reply, repost, like, share. Like and repost answer with a haptic, as the real thing does. */
export function ActionBar(props: { post: Post; large?: boolean }) {
  const haptics = useService(Haptics);
  const sharing = useService(Sharing);
  const navigation = useNavigation();
  const muted = useMuted();
  return (
    <View class={`flex-row items-center gap-6 ${props.large ? 'px-2 py-1' : 'mt-1'}`}>
      <View class="flex-1 flex-row items-center justify-between">
        <Action
          label="Reply"
          symbol="bubble.left"
          color={muted()}
          count={props.post.replies}
          large={props.large}
          onPress={() => openCompose(navigation, props.post.id)}
        />
        <Action
          label={props.post.reposted ? 'Undo repost' : 'Repost'}
          symbol="arrow.2.squarepath"
          color={props.post.reposted ? REPOST : muted()}
          count={props.post.reposts}
          large={props.large}
          onPress={() => {
            haptics.impact('medium');
            toggleRepost(props.post.id);
          }}
        />
        <Action
          label={props.post.liked ? 'Unlike' : 'Like'}
          symbol={props.post.liked ? 'heart.fill' : 'heart'}
          color={props.post.liked ? LIKE : muted()}
          count={props.post.likes}
          large={props.large}
          onPress={() => {
            haptics.impact(props.post.liked ? 'light' : 'rigid');
            toggleLike(props.post.id);
          }}
        />
        <Action
          label="Views"
          symbol="chart.bar"
          color={muted()}
          count={props.post.views}
          large={props.large}
          onPress={() => {}}
        />
      </View>
      <View class="flex-row items-center gap-4">
        <Action
          label={props.post.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          symbol={props.post.bookmarked ? 'bookmark.fill' : 'bookmark'}
          color={props.post.bookmarked ? accent() : muted()}
          large={props.large}
          onPress={() => {
            haptics.select();
            toggleBookmark(props.post.id);
          }}
        />
        <Action
          label="Share"
          symbol="square.and.arrow.up"
          color={muted()}
          large={props.large}
          onPress={() =>
            void sharing.share({
              message: props.post.text,
              url: `https://flock.dev/${props.post.id}`,
            })
          }
        />
      </View>
    </View>
  );
}

/** A post's attached picture, full width, with its space reserved before it loads. */
export function PostMedia(props: { image: PostImage }) {
  return (
    <View class="mt-2 overflow-hidden rounded-2xl border-hairline border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
      <Image
        source={props.image.source}
        resizeMode="contain"
        style={{ width: '100%', aspectRatio: props.image.aspectRatio }}
      />
    </View>
  );
}

/** One post in a list: avatar, name and handle, text, then the action bar. */
export function PostRow(props: { post: Post }) {
  const navigation = useNavigation();
  const muted = useMuted();
  const tabPath = useTabPath();
  const author = () => user(props.post.author);
  const open = () => void navigation.push(tabPath(`post/${props.post.id}`));
  return (
    <View class="flex-row gap-3 border-b-hairline border-zinc-200 px-4 pt-3 pb-2 dark:border-zinc-800">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={author().name}
        onPress={() => void navigation.push(tabPath(`user/${author().handle}`))}
      >
        <Avatar handle={author().handle} size={48} />
      </Pressable>
      <View class="flex-1">
        <View class="flex-row items-center gap-1">
          <Pressable class="flex-1 flex-row items-center gap-1" onPress={open}>
            <Text class="shrink font-bold text-zinc-900 dark:text-white" numberOfLines={1}>
              {author().name}
            </Text>
            <Show when={author().verified}>
              <Glyph name="checkmark.seal.fill" size={15} color={accent()} />
            </Show>
            <Text class="shrink" style={{ color: muted() }} numberOfLines={1}>
              {`@${author().handle} · ${ago(props.post.createdAt)}`}
            </Text>
          </Pressable>
          <MoreMenu post={props.post} />
        </View>
        <Pressable accessibilityRole="button" onPress={open}>
          <Text
            class="text-zinc-900 dark:text-white"
            style={{ fontSize: textSize(), lineHeight: textSize() * 1.3, marginTop: 1 }}
          >
            {props.post.text}
          </Text>
          <Show when={props.post.image}>{(image) => <PostMedia image={image()} />}</Show>
        </Pressable>
        <ActionBar post={props.post} />
      </View>
    </View>
  );
}
