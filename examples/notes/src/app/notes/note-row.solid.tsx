/** @jsxImportSource @solidnative/platform/solid */
import { createMemo } from 'solid-js';
import { Pin } from 'lucide-static';
import { Icon, IconProvider } from '@solidnative/icons/solid';
import { Pressable, Text, View } from '@solidnative/components/solid';
import { Show } from '@solidnative/platform/solid';
import { excerpt, type Note } from '../data/note.ts';

const DAY = 1000 * 60 * 60 * 24;

/** A relative-ish timestamp: time today, "Yesterday", a weekday, or a short date further back. */
export function formatUpdated(updatedAt: number, now = Date.now()): string {
  const date = new Date(updatedAt);
  const diffDays = Math.floor((startOfDay(now) - startOfDay(updatedAt)) / DAY);
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** One row in the notes list: title, a preview of the body, when it changed, and a pin. */
export function NoteRow(props: { note: Note; onOpen: () => void; onPin: () => void }) {
  const preview = createMemo(() => excerpt(props.note.body, 120));
  const updated = createMemo(() => formatUpdated(props.note.updatedAt));
  return (
    <IconProvider icons={{ Pin }}>
      <Pressable
        class="flex-row items-start gap-3 border-b-hairline border-zinc-200 px-5 py-4 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-900"
        accessibilityRole="button"
        accessibilityLabel={props.note.title || 'Untitled note'}
        onPress={() => props.onOpen()}
        onLongPress={() => props.onPin()}
      >
        <View class="mt-1 flex-1">
          <View class="flex-row items-center gap-1.5">
            <Show when={props.note.pinned}>
              <Icon name="Pin" size={13} color="#f59e0b" />
            </Show>
            <Text
              class="flex-1 text-base font-semibold text-zinc-900 dark:text-white"
              numberOfLines={1}
            >
              {props.note.title || 'Untitled note'}
            </Text>
            <Text class="text-xs text-zinc-400">{updated()}</Text>
          </View>
          <Show when={preview()}>
            <Text class="mt-1 text-sm text-zinc-500" numberOfLines={2}>
              {preview()}
            </Text>
          </Show>
        </View>
      </Pressable>
    </IconProvider>
  );
}
