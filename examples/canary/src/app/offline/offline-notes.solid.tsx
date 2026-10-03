/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { FieldNotes, type Note } from './field-notes.solid.ts';
import { NotesServer } from './notes-server.solid.ts';
import sheet from './offline-notes.native.css';

export function OfflineNotes() {
  const notes = useService(FieldNotes),
    server = useService(NotesServer);
  const [draft, setDraft] = createSignal(''),
    [editing, setEditing] = createSignal<string | null>(null),
    [edited, setEdited] = createSignal('');
  const status = createMemo(() => {
    const waiting = notes.outbox().length,
      changes = waiting === 1 ? '1 change' : `${waiting} changes`;
    if (!notes.ready()) return 'Reading your notes';
    if (!notes.online()) return waiting ? `Offline, ${changes} waiting` : 'Offline';
    if (notes.sending()) return `Sending ${changes}`;
    if (waiting) return `${changes} waiting to send`;
    return 'All changes saved';
  });
  function add() {
    const text = draft().trim();
    if (!text || !notes.ready()) return;
    notes.add(text);
    setDraft('');
  }
  function startEditing(note: Note) {
    setEdited(note.text);
    setEditing(note.id);
  }
  function save(note: Note) {
    const text = edited().trim();
    if (text && text !== note.text) notes.edit(note.id, text);
    setEditing(null);
  }
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Field notes" />
      <ScrollView
        class="screen"
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View class={`banner${!notes.online() ? ' warn' : ''}`} accessibilityRole="summary">
          <Text class="body">{status()}</Text>
          <Show when={notes.lastError() && notes.online()}>
            <Pressable accessibilityRole="button" onPress={notes.retryNow}>
              <Text class="button-label">Retry now</Text>
            </Pressable>
          </Show>
        </View>
        <View class="toggle-row">
          <Text class="body">Airplane mode (this app only)</Text>
          <Switch
            accessibilityLabel="Airplane mode"
            value={notes.airplane()}
            onValueChange={notes.setAirplane}
          />
        </View>
        <View class="compose">
          <TextInput
            class="field grow"
            accessibilityLabel="New note"
            placeholder="New note"
            value={draft()}
            onValueChange={setDraft}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <Pressable
            class="button"
            accessibilityRole="button"
            disabled={!notes.ready()}
            onPress={add}
          >
            <Text class="button-label">Add</Text>
          </Pressable>
        </View>
        <For each={notes.notes().map((note) => note.id)}>
          {(id) => {
            const note = () => notes.notes().find((note) => note.id === id)!;
            return (
              <View class="card note">
                <Show
                  when={editing() === note().id}
                  fallback={<Text class="body">{note().text}</Text>}
                >
                  <TextInput
                    class="field"
                    accessibilityLabel="Edit note"
                    value={edited()}
                    onValueChange={setEdited}
                    returnKeyType="done"
                    onSubmitEditing={() => save(note())}
                  />
                </Show>
                <View class="actions">
                  <Text class="hint grow">{note().pending ? 'Waiting to send' : 'Saved'}</Text>
                  <Show
                    when={editing() === note().id}
                    fallback={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${note().text}`}
                        onPress={() => startEditing(note())}
                      >
                        <Text class="button-label">Edit</Text>
                      </Pressable>
                    }
                  >
                    <Pressable accessibilityRole="button" onPress={() => save(note())}>
                      <Text class="button-label">Done</Text>
                    </Pressable>
                  </Show>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${note().text}`}
                    onPress={() => notes.remove(note().id)}
                  >
                    <Text class="danger">Delete</Text>
                  </Pressable>
                  <Show when={!note().pending}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Change ${note().text} elsewhere`}
                      onPress={() =>
                        server.editElsewhere(note().id, `${note().text} (edited elsewhere)`)
                      }
                    >
                      <Text class="hint">Elsewhere</Text>
                    </Pressable>
                  </Show>
                </View>
              </View>
            );
          }}
        </For>
      </ScrollView>
    </>
  ));
}
