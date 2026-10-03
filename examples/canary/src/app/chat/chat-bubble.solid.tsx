/** @jsxImportSource @solidnative/platform/solid */
import { Image, Pressable, Text, View } from '@solidnative/components/solid';
import { Show, withNativeStyles } from '@solidnative/platform/solid';
import type { ChatMessage } from './chat-backend.solid.ts';
import sheet from './chat-bubble.native.css';
export function ChatBubble(props: { message: ChatMessage; onRetry: () => void }) {
  const mine = () => props.message.from === 'me';
  return withNativeStyles(sheet, () => (
    <View class={mine() ? 'line mine' : 'line'}>
      <View class={mine() ? 'bubble out' : 'bubble in'}>
        <Show when={props.message.image}>
          {(image) => (
            <Image
              class="picture"
              source={{ uri: image().uri }}
              style={{ aspectRatio: image().aspect }}
              resizeMode="cover"
              accessibilityRole="image"
              accessibilityLabel="Photo"
            />
          )}
        </Show>
        <Text class={mine() ? 'words words-out' : 'words'}>{props.message.text}</Text>
      </View>
      <Show when={props.message.state === 'sending'}>
        <Text class="state">Sending</Text>
      </Show>
      <Show when={props.message.state === 'failed'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={'Not delivered. Retry sending ' + props.message.text}
          onPress={props.onRetry}
        >
          <Text class="state danger">Not delivered. Tap to retry</Text>
        </Pressable>
      </Show>
    </View>
  ));
}
