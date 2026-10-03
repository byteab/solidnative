/** @jsxImportSource @solidnative/platform/solid */
import { onCleanup } from 'solid-js';
import {
  createForm,
  bindFormField,
  formRequired,
  Pressable,
  SafeAreaProvider,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from '@solidnative/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { Show, withNativeStyles } from '@solidnative/platform/solid';
import { useNavigation } from '@solidnative/router/solid';
import { NoteDrafts } from './note-drafts.solid.ts';
import styles from './note-sheet.native.css';

export function NoteSheet() {
  const nav = useNavigation();
  const drafts = useService(NoteDrafts);
  const foreground = useService(SCREEN_IN_FRONT);
  const form = createForm(
    { title: '', body: '' },
    { title: { validate: formRequired() }, body: {} },
  );
  let active = true;
  onCleanup(() => {
    active = false;
  });
  async function save() {
    if (!active || !foreground()) return;
    const ok = await form.submit(() => undefined, { focusInvalid: false });
    if (!ok || !active || !foreground()) return;
    drafts.save(form.value().title);
    if (active && foreground()) void nav.back();
  }
  return withNativeStyles(styles, () => (
    <SafeAreaProvider reportInsets={false} class="screen">
      <SafeAreaView class="screen" edges={['bottom']}>
        <ScrollView
          class="screen"
          contentContainerStyle={{ padding: 20, gap: 12 }}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
        >
          <Text class="heading">Note</Text>
          <TextInput
            {...bindFormField(form.fields.title)}
            class="field"
            accessibilityLabel="Title"
            placeholder="Title"
            returnKeyType="next"
            onSubmitEditing={() => form.fields.body.focusBoundControl()}
          />
          <TextInput
            {...bindFormField(form.fields.body)}
            class="field body-field"
            accessibilityLabel="Body"
            placeholder="Body"
            multiline
          />
          <Show when={form.fields.title.touched() && form.fields.title.invalid()}>
            <Text class="hint danger" accessibilityRole="alert">
              Give the note a title
            </Text>
          </Show>
          <View class="actions">
            <Pressable
              class="card"
              accessibilityRole="button"
              onPress={() => {
                void nav.back();
              }}
            >
              <Text class="button-label">Cancel</Text>
            </Pressable>
            <Pressable
              class="button"
              accessibilityRole="button"
              onPress={() => {
                void save();
              }}
            >
              <Text class="button-label">Save</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  ));
}
