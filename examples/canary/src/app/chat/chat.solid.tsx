/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal, onMount } from 'solid-js';
import {
  ActivityIndicator,
  KeyboardDock,
  KeyboardLift,
  Pressable,
  Text,
  TextInput,
  View,
  VirtualList,
  type KeyboardDockRef,
  type TextInputRef,
  type VirtualListRef,
} from '@solidnative/components/solid';
import { ColorScheme, SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { palette } from '../palette-values.ts';
import { ChatBackend } from './chat-backend.solid.ts';
import { ChatBubble } from './chat-bubble.solid.tsx';
import { createChatStore } from './chat-store.solid.ts';
import sheet from './chat.native.css';
const AWAY = 80;
export function ChatPage() {
  const backend = useService(ChatBackend),
    front = useService(SCREEN_IN_FRONT),
    colors = useService(ColorScheme),
    store = createChatStore(backend, front);
  const [draft, setDraft] = createSignal(''),
    [offline, setOffline] = createSignal(backend.offline),
    [away, setAway] = createSignal(false),
    [newestWhenAway, setNewestWhenAway] = createSignal<string | null>(null);
  const [dock, setDock] = createSignal<KeyboardDockRef>();
  const lift = KeyboardLift(dock),
    canSend = () => draft().trim().length > 0;
  let transcript: VirtualListRef | undefined, field: TextInputRef | undefined;
  const unseen = createMemo(() => {
    const mark = newestWhenAway();
    return mark
      ? Math.max(
          0,
          store.messages().findIndex((message) => message.id === mark),
        )
      : 0;
  });
  const jump = () => {
    if (front()) transcript?.scrollToOffset({ offset: 0, animated: true });
  };
  onMount(() => void store.loadOlder());
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Sam" />
      <View class="screen">
        <View class="toolbar">
          <Pressable class="chip" accessibilityRole="button" onPress={() => store.receive()}>
            <Text class="chip-label">Sam replies</Text>
          </Pressable>
          <Pressable
            class="chip"
            accessibilityRole="switch"
            accessibilityState={{ checked: store.isLive() }}
            onPress={() => (store.isLive() ? store.stopLive() : store.startLive())}
          >
            <Text class="chip-label">{store.isLive() ? 'Live: on' : 'Live: off'}</Text>
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
        </View>
        <View class="transcript-frame">
          <View class="transcript" ref={lift}>
            <VirtualList
              ref={(ref) => {
                transcript = ref;
              }}
              class="transcript"
              inverted
              items={store.messages()}
              estimatedItemHeight={(message) =>
                46 + Math.ceil(message.text.length / 30) * 21 + (message.image ? 190 : 0)
              }
              keyExtractor={(message) => message.id}
              itemType={(message) =>
                message.image ? 'picture' : message.state === 'failed' ? 'failed' : 'text'
              }
              recycleItems
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: AWAY,
              }}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              onEndReached={() => front() && void store.loadOlder()}
              onScroll={(event) => {
                if (!front()) return;
                const next = (event.nativeEvent?.contentOffset?.y ?? 0) > AWAY;
                if (next !== away()) {
                  setAway(next);
                  setNewestWhenAway(next ? (store.messages()[0]?.id ?? null) : null);
                }
              }}
              listHeader={
                <View class="typing-slot">
                  <Show when={store.typing()}>
                    <Text class="hint typing" accessibilityLiveRegion="polite">
                      Sam is typing
                    </Text>
                  </Show>
                </View>
              }
              renderItem={(message) => (
                <View>
                  <ChatBubble message={message()} onRetry={() => store.retry(message().id)} />
                </View>
              )}
              listFooter={
                <View class="history-edge">
                  <Show
                    when={store.reachedStart()}
                    fallback={
                      <Show when={store.historyFailed()} fallback={<ActivityIndicator />}>
                        <Text class="hint">Could not load the conversation.</Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void store.loadOlder()}
                        >
                          <Text class="button-label">Retry history</Text>
                        </Pressable>
                      </Show>
                    }
                  >
                    <Text class="hint">This is the start of your conversation with Sam.</Text>
                  </Show>
                </View>
              }
            />
          </View>
        </View>
        <Show when={away()}>
          <Pressable
            class="jump"
            accessibilityRole="button"
            accessibilityLabel={unseen() ? unseen() + ' new messages' : 'Latest messages'}
            onPress={jump}
          >
            <Text class="jump-label">{unseen() ? unseen() + ' new' : 'Latest'}</Text>
          </Pressable>
        </Show>
        <KeyboardDock
          ref={setDock}
          inputNativeID="chat-composer"
          backgroundColor={palette[colors.current() === 'dark' ? 'dark' : 'light'].screen}
        >
          <View class="composer">
            <TextInput
              ref={(ref) => {
                field = ref;
              }}
              nativeID="chat-composer"
              class="field compose-field"
              multiline
              value={draft()}
              onValueChange={setDraft}
              placeholder="Message"
              placeholderTextColor="#6c6c78"
              accessibilityLabel="Message"
            />
            <Pressable
              class="send"
              accessibilityRole="button"
              accessibilityLabel="Send"
              disabled={!canSend()}
              accessibilityState={{ disabled: !canSend() }}
              onPress={() => {
                if (front() && canSend()) {
                  store.send(draft());
                  setDraft('');
                  jump();
                  field?.focus();
                }
              }}
            >
              <Text class={canSend() ? 'send-label' : 'send-label idle'}>Send</Text>
            </Pressable>
          </View>
        </KeyboardDock>
      </View>
    </>
  ));
}
