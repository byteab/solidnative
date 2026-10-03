/** @jsxImportSource @solid-native/platform/solid */
import { createMemo } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { Dialogs, SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import {
  UiButton,
  UiHStack,
  UiHost,
  UiImage,
  UiList,
  UiSlot,
  UiSpacer,
  UiSwipeActions,
  UiText,
  UiVStack,
  type UiModifier,
} from '@solid-native/expo/solid';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { nativePlatform } from '@solid-native/fabric';
import { For, Show } from '@solid-native/platform/solid';
import { NativeHeader, NativeHeaderItem, useNavigation } from '@solid-native/router/solid';
import {
  accent,
  activity,
  ago,
  dismissActivity,
  markAllRead,
  markRead,
  post,
  unreadCount,
  user,
  type Activity,
} from '../flock.solid.ts';
import { Glyph } from '../ui/glyph.solid.tsx';
import { LIKE, REPOST, useMuted } from '../ui/post-row.solid.tsx';

const VERB = {
  like: 'liked your post',
  repost: 'reposted your post',
  follow: 'followed you',
  reply: 'replied to you',
};
const SYMBOL = {
  like: 'heart.fill',
  repost: 'arrow.2.squarepath',
  follow: 'person.fill.badge.plus',
  reply: 'bubble.left',
};
const tint = (kind: Activity['kind']) =>
  kind === 'like' ? LIKE : kind === 'repost' ? REPOST : accent();

const m = (type: string, params: Record<string, unknown> = {}): UiModifier => ({
  $type: type,
  ...params,
});
const secondary = m('foregroundStyle', {
  style: { type: 'hierarchical', hierarchical: 'secondary' },
});

/** iOS: a SwiftUI List, with the system's own swipe actions on every row. */
function SwiftUiActivity(props: { items: readonly Activity[]; onOpen: (a: Activity) => void }) {
  const front = useService(SCREEN_IN_FRONT);
  const ids = createMemo(() => props.items.map((a) => a.id));
  return (
    <UiHost style={{ flex: 1 }}>
      <UiList modifiers={[m('listStyle', { style: 'plain' })]}>
        <For each={ids()}>
          {(id) => {
            const a = () => props.items.find((x) => x.id === id)!;
            return (
              <UiSwipeActions>
                <UiButton
                  modifiers={[m('buttonStyle', { style: 'plain' })]}
                  onButtonPress={() => front() && props.onOpen(a())}
                >
                  <UiHStack alignment="top" spacing={12}>
                    <UiImage systemName={SYMBOL[a().kind]} size={22} color={tint(a().kind)} />
                    <UiVStack alignment="leading" spacing={3}>
                      <UiText
                        text={`${user(a().who).name} ${VERB[a().kind]}`}
                        modifiers={[
                          m('font', { weight: a().unread ? 'semibold' : 'regular', size: 15 }),
                        ]}
                      />
                      <Show when={a().postId}>
                        <UiText
                          text={post(a().postId!)?.text ?? ''}
                          modifiers={[
                            m('font', { size: 14 }),
                            secondary,
                            m('lineLimit', { limit: 2 }),
                          ]}
                        />
                      </Show>
                      <UiText
                        text={ago(a().createdAt)}
                        modifiers={[m('font', { size: 13 }), secondary]}
                      />
                    </UiVStack>
                    <UiSpacer />
                    <Show when={a().unread}>
                      <UiImage systemName="circle.fill" size={9} color={accent()} />
                    </Show>
                  </UiHStack>
                </UiButton>
                <UiSlot name="actions" extraProps={{ edge: 'leading', allowsFullSwipe: true }}>
                  <UiButton
                    label="Read"
                    systemImage="envelope.open"
                    modifiers={[m('tint', { color: accent() })]}
                    onButtonPress={() => front() && markRead(id)}
                  />
                </UiSlot>
                <UiSlot name="actions" extraProps={{ edge: 'trailing', allowsFullSwipe: true }}>
                  <UiButton
                    label="Delete"
                    systemImage="trash"
                    role="destructive"
                    onButtonPress={() => front() && dismissActivity(id)}
                  />
                </UiSlot>
              </UiSwipeActions>
            );
          }}
        </For>
      </UiList>
    </UiHost>
  );
}

/** Android: Material rows; tap to open, long-press to remove. */
function MaterialActivity(props: { items: readonly Activity[]; onOpen: (a: Activity) => void }) {
  const dialogs = useService(Dialogs);
  const muted = useMuted();
  return (
    <ScrollView class="flex-1 bg-white dark:bg-black">
      <For each={props.items}>
        {(a) => (
          <Pressable
            class="flex-row gap-4 border-b-hairline border-zinc-200 px-4 py-3.5 active:bg-black/5 dark:border-zinc-800"
            style={{ backgroundColor: a.unread ? `${accent()}14` : undefined }}
            onPress={() => props.onOpen(a)}
            onLongPress={async () => {
              if (await dialogs.confirm('Remove this notification?', { destructive: true }))
                dismissActivity(a.id);
            }}
          >
            <Glyph name={SYMBOL[a.kind]} size={24} color={tint(a.kind)} />
            <View class="flex-1">
              <Text class="text-[15px] text-zinc-900 dark:text-white">
                <Text class="font-bold">{user(a.who).name}</Text> {VERB[a.kind]}
              </Text>
              <Show when={a.postId}>
                <Text class="mt-1 text-sm" style={{ color: muted() }} numberOfLines={2}>
                  {post(a.postId!)?.text}
                </Text>
              </Show>
              <Text class="mt-1 text-xs" style={{ color: muted() }}>
                {ago(a.createdAt)}
              </Text>
            </View>
          </Pressable>
        )}
      </For>
    </ScrollView>
  );
}

export function Notifications() {
  const navigation = useNavigation();
  const haptics = useService(Haptics);
  const open = (a: Activity) => {
    markRead(a.id);
    void navigation.push(
      a.postId ? `/notifications/post/${a.postId}` : `/notifications/user/${a.who}`,
    );
  };
  return (
    <>
      <NativeHeader title="Notifications">
        <NativeHeaderItem type="right">
          <Show when={unreadCount() > 0}>
            <Pressable
              class="px-3"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                haptics.notify('success');
                markAllRead();
              }}
            >
              <Text class="text-[16px] font-semibold" style={{ color: accent() }}>
                Read all
              </Text>
            </Pressable>
          </Show>
        </NativeHeaderItem>
      </NativeHeader>
      <Show
        when={nativePlatform() === 'ios'}
        fallback={<MaterialActivity items={activity} onOpen={open} />}
      >
        <SwiftUiActivity items={activity} onOpen={open} />
      </Show>
    </>
  );
}
