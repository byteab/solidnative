/** @jsxImportSource @solidnative/platform/solid */
import { Show, withNativeStyles } from '@solidnative/platform/solid';
import { ActivityIndicator, Pressable, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { FullWindowOverlay } from '@solidnative/router/solid';
import { Toasts } from './toasts.solid.ts';
import sheet from './toast-host.native.css';

/** Above every native screen and sheet, with the original layout and accessible messages. */
export function ToastHost() {
  const toasts = useService(Toasts);
  return withNativeStyles(sheet, () => (
    <FullWindowOverlay>
      <Show when={toasts.loading()}>
        <View class="cover" accessibilityRole="progressbar" accessibilityLabel="Loading">
          <ActivityIndicator size="large" />
        </View>
      </Show>
      <Show when={toasts.message()}>
        {(message) => (
          <Pressable
            class="toast"
            accessibilityRole="alert"
            accessibilityLabel={message()}
            onPress={() => toasts.dismiss()}
          >
            <Text class="toast-label">{message()}</Text>
          </Pressable>
        )}
      </Show>
    </FullWindowOverlay>
  ));
}
