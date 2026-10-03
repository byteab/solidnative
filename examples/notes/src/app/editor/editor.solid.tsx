/** @jsxImportSource @solidnative/platform/solid */
import { createComputed, createMemo, createSignal } from 'solid-js';
import { Trash2 } from 'lucide-static';
import { Icon, IconProvider } from '@solidnative/icons/solid';
import { Dialogs, Keyboard, useService } from '@solidnative/device/solid';
import { Haptics } from '@solidnative/expo/solid/haptics';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from '@solidnative/components/solid';
import { Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, NativeHeaderItem, useNavigation, useRoute } from '@solidnative/router/solid';
import { wordCount } from '../data/note.ts';
import { Notes } from '../sync/notes.solid.ts';
import sheet from './editor.native.css';

const AUTOSAVE_DELAY_MS = 500;

/**
 * Title and body, saved a moment after typing stops. There is no save button: the note behind
 * the route's `id` already exists, or `add()` makes it the first time there is something worth
 * keeping.
 */
export function Editor() {
  const notes = useService(Notes);
  const navigation = useNavigation();
  const dialogs = useService(Dialogs);
  const haptics = useService(Haptics);
  /** The bar sits on the keyboard then, with no home indicator under it to clear. */
  const keyboard = useService(Keyboard);
  const route = useRoute();

  /** Set only when opened from the list; its absence is what makes this a new note. */
  const id = () => route.inputs['id'] as string | undefined;
  const existing = createMemo(() => notes.find(id() ?? ''));
  const isNew = () => !existing();

  // Linked to the stored note: a saved change resets the field.
  const [title, setTitle] = createSignal('');
  const [body, setBody] = createSignal('');
  createComputed(() => setTitle(existing()?.title ?? ''));
  createComputed(() => setBody(existing()?.body ?? ''));

  /** The id a brand-new note gets the moment it is first saved. */
  const [createdId, setCreatedId] = createSignal<string | null>(null);
  const noteId = () => id() ?? createdId();
  const canDelete = () => noteId() !== null;

  const wordCountLabel = () => {
    const count = wordCount(body());
    return `${count} word${count === 1 ? '' : 's'}`;
  };
  const [saving, setSaving] = createSignal(false);
  const savedLabel = () => {
    if (!title().trim() && !body().trim()) return '';
    return saving() ? 'Saving...' : 'Saved';
  };

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    setSaving(true);
    saveTimer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }

  async function remove(): Promise<void> {
    const target = noteId();
    if (!target) return;
    const sure = await dialogs.confirm('Delete this note?', {
      message: 'This cannot be undone.',
      destructive: true,
    });
    if (!sure) return;
    await notes.remove(target);
    haptics.notify('success');
    void navigation.back();
  }

  async function save(): Promise<void> {
    const trimmed = title().trim();
    const text = body();
    if (!trimmed && !text) {
      setSaving(false);
      return;
    }
    const target = noteId();
    if (target) {
      await notes.update(target, { title: trimmed || 'Untitled', body: text });
    } else {
      const note = await notes.add(trimmed || 'Untitled', text);
      setCreatedId(note.id);
    }
    setSaving(false);
  }

  return withNativeStyles(sheet, () => (
    <IconProvider icons={{ Trash2 }}>
      <KeyboardAvoidingView class="flex-1 bg-white dark:bg-black" behavior="padding">
        <NativeHeader title={isNew() ? 'New note' : 'Note'} backTitle="Notes">
          <Show when={canDelete()}>
            <NativeHeaderItem type="right">
              <Pressable
                class="size-8 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Delete note"
                onPress={() => void remove()}
              >
                <Icon name="Trash2" size={19} color="#e11d48" />
              </Pressable>
            </NativeHeaderItem>
          </Show>
        </NativeHeader>

        <ScrollView
          class="flex-1 px-5 pt-4"
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            class="text-2xl font-bold text-zinc-900 dark:text-white"
            placeholder="Title"
            accessibilityLabel="Title"
            autoCapitalize="sentences"
            value={title()}
            onValueChange={(value) => {
              setTitle(value);
              scheduleSave();
            }}
          />
          <TextInput
            class="mt-3 min-h-32 text-base text-zinc-700 dark:text-zinc-300"
            placeholder="Start writing..."
            accessibilityLabel="Note body"
            multiline
            value={body()}
            onValueChange={(value) => {
              setBody(value);
              scheduleSave();
            }}
          />
        </ScrollView>

        <View
          class={`bottom-bar flex-row items-center justify-between border-t-hairline border-zinc-200 bg-white px-5 pt-2 dark:border-zinc-800 dark:bg-black${keyboard.visible() ? ' keyboard-up' : ''}`}
        >
          <Text class="text-xs text-zinc-400">{wordCountLabel()}</Text>
          <Text class="text-xs text-zinc-400">{savedLabel()}</Text>
        </View>
      </KeyboardAvoidingView>
    </IconProvider>
  ));
}
