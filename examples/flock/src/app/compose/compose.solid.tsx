/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, Text, TextInput, View } from '@solid-native/components/solid';
import { ColorScheme, useService } from '@solid-native/device/solid';
import { UiGauge, UiHost, UiPicker } from '@solid-native/expo/solid';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { nativePlatform } from '@solid-native/fabric';
import { Show } from '@solid-native/platform/solid';
import { useNavigation, useRoute } from '@solid-native/router/solid';
import { ME, accent, audience, post, publish, setAudience } from '../flock.solid.ts';
import { Avatar } from '../ui/avatar.solid.tsx';
import { useMuted } from '../ui/post-row.solid.tsx';

const LIMIT = 280;
const AUDIENCES = [
  { value: 'everyone', label: 'Everyone can reply' },
  { value: 'following', label: 'Accounts you follow' },
  { value: 'mentioned', label: 'Only accounts you mention' },
] as const;

/**
 * A form sheet with detents: open at half height over the feed, drag up for the full screen.
 * Presented screens have no native header, so the sheet draws its own Cancel / Post bar.
 */
export function Compose() {
  const navigation = useNavigation();
  const route = useRoute();
  const haptics = useService(Haptics);
  const scheme = useService(ColorScheme);
  const muted = useMuted();
  const replyTo = () => {
    const id = route.query['replyTo'];
    return typeof id === 'string' ? post(id) : undefined;
  };
  const [text, setText] = createSignal('');
  const left = () => LIMIT - text().length;
  const canPost = () => text().trim().length > 0 && left() >= 0;
  const send = () => {
    if (!canPost()) return;
    publish(text().trim(), replyTo()?.id);
    haptics.notify('success');
    void navigation.back();
  };
  const ringColor = () => (left() < 0 ? '#f4212e' : left() <= 20 ? '#ffd400' : accent());

  return (
    <View class="flex-1 bg-white px-4 pt-5 dark:bg-zinc-950">
      <View class="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => void navigation.back()}>
          <Text
            class="text-[17px]"
            style={{ color: scheme.current() === 'dark' ? '#fff' : '#0f1419' }}
          >
            Cancel
          </Text>
        </Pressable>
        <Pressable
          testID="post-button"
          class="rounded-full px-5 py-2 active:opacity-80"
          style={{ backgroundColor: accent(), opacity: canPost() ? 1 : 0.5 }}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPost() }}
          onPress={send}
        >
          <Text class="font-bold text-white">{replyTo() ? 'Reply' : 'Post'}</Text>
        </Pressable>
      </View>

      <Show when={replyTo()}>
        {(p) => (
          <Text class="mt-4 ml-14" style={{ color: muted() }}>
            Replying to <Text style={{ color: accent() }}>@{p().author}</Text>
          </Text>
        )}
      </Show>

      <View class="mt-4 flex-row gap-3">
        <Avatar handle={ME} size={40} />
        <TextInput
          testID="compose-input"
          class="min-h-28 flex-1 pt-2 text-lg text-zinc-900 dark:text-white"
          placeholder={replyTo() ? 'Post your reply' : "What's happening?"}
          placeholderTextColor={muted()}
          value={text()}
          onChangeText={setText}
          multiline
          autoFocus
          textAlignVertical="top"
          selectionColor={accent()}
        />
      </View>

      <View class="mt-2 flex-row items-center justify-between border-t-hairline border-zinc-200 pt-3 dark:border-zinc-800">
        <Show
          when={nativePlatform() === 'ios'}
          fallback={
            <Pressable
              class="rounded-full border px-3 py-1.5"
              style={{ borderColor: accent() }}
              accessibilityRole="button"
              onPress={() => {
                const i = AUDIENCES.findIndex((a) => a.value === audience());
                setAudience(AUDIENCES[(i + 1) % AUDIENCES.length]!.value);
              }}
            >
              <Text class="text-sm font-bold" style={{ color: accent() }}>
                {AUDIENCES.find((a) => a.value === audience())!.label}
              </Text>
            </Pressable>
          }
        >
          {/* A SwiftUI Picker in menu style: tap it for the system's own popup menu. */}
          <UiHost matchContents>
            <UiPicker
              options={AUDIENCES}
              value={audience()}
              pickerStyle="menu"
              modifiers={[{ $type: 'tint', color: accent() }]}
              onValueChange={(value) => setAudience(value as (typeof AUDIENCES)[number]['value'])}
            />
          </UiHost>
        </Show>
        <View class="flex-row items-center gap-2">
          <Show when={left() <= 20}>
            <Text class="text-sm" style={{ color: ringColor() }}>
              {left()}
            </Text>
          </Show>
          <Show
            when={nativePlatform() === 'ios'}
            fallback={
              <Text class="text-sm" style={{ color: muted() }}>
                {`${text().length}/${LIMIT}`}
              </Text>
            }
          >
            {/* The character ring is a SwiftUI Gauge. */}
            <UiHost matchContents>
              <UiGauge
                value={Math.min(text().length, LIMIT)}
                min={0}
                max={LIMIT}
                modifiers={[
                  { $type: 'gaugeStyle', style: 'circularCapacity' },
                  { $type: 'tint', color: ringColor() },
                  { $type: 'scaleEffect', x: 0.5, y: 0.5 },
                  { $type: 'frame', width: 30, height: 30 },
                ]}
              />
            </UiHost>
          </Show>
        </View>
      </View>
    </View>
  );
}
