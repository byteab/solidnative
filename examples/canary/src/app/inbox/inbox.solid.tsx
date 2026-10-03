/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Gesture } from 'react-native-gesture-handler';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  VirtualList,
  type ScrollViewRef,
} from '@solidnative/components/solid';
import { GestureRoot, NativeGesture } from '@solidnative/components/solid/gestures';
import { SCREEN_IN_FRONT, createServiceToken, useService } from '@solidnative/device/solid';
import { nativePlatform } from '@solidnative/fabric';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, useNavigation } from '@solidnative/router/solid';
import { createInbox, type Mail } from './inbox-model.solid.ts';
import { InboxNativeList } from './inbox-native-list.solid.tsx';
import { InboxRow } from './inbox-row.solid.tsx';
import sheet from './inbox.native.css';
export const INBOX_SWIPES = createServiceToken<'native' | 'drawn'>('canary.inboxSwipes', () =>
  nativePlatform() === 'ios' ? 'native' : 'drawn',
);
export function InboxPage() {
  const nav = useNavigation(),
    front = useService(SCREEN_IN_FRONT),
    inbox = createInbox(),
    native = useService(INBOX_SWIPES) === 'native';
  const pagerGesture = Gesture.Native(),
    gestureRef = NativeGesture(() => (front() ? pagerGesture : null));
  const [page, setPage] = createSignal(0),
    [width, setWidth] = createSignal(0),
    [height, setHeight] = createSignal<number>();
  let pager: ScrollViewRef | undefined;
  const folders = createMemo(() => [
    { page: 0, label: `Inbox (${inbox.inbox().length})`, mails: inbox.inbox() },
    { page: 1, label: `Archive (${inbox.archive().length})`, mails: inbox.archive() },
  ]);
  // Stable folder owners retain native list scroll position when mailbox objects change.
  const folderPages = [0, 1];
  const showPage = (next: number) => {
    if (front()) {
      setPage(next);
      pager?.scrollTo({ x: next * width(), animated: true });
    }
  };
  const open = (mail: Mail) => {
    if (!front()) return;
    if (inbox.selecting()) inbox.toggleSelected(mail.id);
    else {
      inbox.markRead(mail.id);
      void nav.push(`/search-demo/${mail.id}`, { state: { title: mail.subject } });
    }
  };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Mail" />
      <GestureRoot>
        <View class="screen">
          <View class="toolbar">
            <Show
              when={inbox.selecting()}
              fallback={
                <For each={folderPages}>
                  {(index) => (
                    <Pressable
                      class={page() === index ? 'chip current' : 'chip'}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: page() === index }}
                      onPress={() => showPage(index)}
                    >
                      <Text class="chip-label">{folders()[index]!.label}</Text>
                    </Pressable>
                  )}
                </For>
              }
            >
              <Text class="body grow">{inbox.selected().size} selected</Text>
              <Pressable class="chip" accessibilityRole="button" onPress={inbox.archiveSelected}>
                <Text class="chip-label">Archive</Text>
              </Pressable>
              <Pressable class="chip" accessibilityRole="button" onPress={inbox.clearSelection}>
                <Text class="chip-label">Cancel</Text>
              </Pressable>
            </Show>
          </View>
          <ScrollView
            ref={(ref) => {
              pager = ref;
              gestureRef(ref);
            }}
            collapsable={false}
            class="pager"
            horizontal
            pagingEnabled
            scrollEnabled={!native}
            showsHorizontalScrollIndicator={false}
            onLayout={(event) => {
              setWidth(event.nativeEvent?.layout?.width ?? 0);
              setHeight(event.nativeEvent?.layout?.height);
            }}
            onMomentumScrollEnd={(event) => {
              if (front() && width())
                setPage(Math.round((event.nativeEvent?.contentOffset?.x ?? 0) / width()));
            }}
          >
            <For each={folderPages}>
              {(index) => (
                <View style={{ width: width(), height: height(), flex: 1 }}>
                  <Show
                    when={native}
                    fallback={
                      <VirtualList
                        class="list"
                        items={folders()[index]!.mails}
                        itemHeight={84}
                        keyExtractor={(mail) => mail.id}
                        recycleItems
                        renderItem={(mail) => (
                          <View>
                            <InboxRow
                              mail={mail()}
                              selected={inbox.selected().has(mail().id)}
                              outer={pagerGesture}
                              onOpen={() => open(mail())}
                              onHold={() => inbox.toggleSelected(mail().id)}
                              onArchive={() => inbox.archiveMail(mail().id)}
                              onRemove={() => inbox.remove(mail().id)}
                            />
                          </View>
                        )}
                      />
                    }
                  >
                    <InboxNativeList
                      mails={folders()[index]!.mails}
                      size={{ width: width(), height: height() }}
                      onOpen={open}
                      onArchive={(mail) => inbox.archiveMail(mail.id)}
                      onRemove={(mail) => inbox.remove(mail.id)}
                    />
                  </Show>
                </View>
              )}
            </For>
          </ScrollView>
        </View>
      </GestureRoot>
    </>
  ));
}
