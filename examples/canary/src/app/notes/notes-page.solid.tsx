/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { For, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader, useNavigation } from '@solid-native/router/solid';
import { Notes, inline, type Note } from './notes-model.solid.ts';
import sheet from './notes-page.native.css';
const WHEN = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
export function notePreview(note: Note): string {
  const first = note.blocks.find((block) => block.text) ?? note.blocks[0];
  return first
    ? inline(first.text)
        .map((span) => span.text)
        .join('') || 'No text'
    : 'No text';
}
export function NotesPage() {
  const notes = useService(Notes),
    nav = useNavigation();
  const open = (id: string) => {
    void nav.push(`/notes/${id}`);
  };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Notes" largeTitle />
      <View class="screen">
        <ScrollView class="page" contentInsetAdjustmentBehavior="automatic">
          <For each={notes.all().map((note) => note.id)}>
            {(id) => {
              const note = () => notes.get(id)!;
              return (
                <Pressable
                  class="card"
                  accessibilityRole="button"
                  accessibilityLabel={`${note().title || 'Untitled'}, ${notePreview(note())}`}
                  onPress={() => open(id)}
                >
                  <Text class="title" numberOfLines={1}>
                    {note().title || 'Untitled'}
                  </Text>
                  <Text class="preview" numberOfLines={2}>
                    <Text class="date">{WHEN.format(new Date(note().edited))} </Text>
                    {notePreview(note())}
                  </Text>
                </Pressable>
              );
            }}
          </For>
        </ScrollView>
        <Pressable
          class="new"
          accessibilityRole="button"
          accessibilityLabel="New note"
          onPress={() => open(notes.create().id)}
        >
          <Text class="new-glyph">✎</Text>
        </Pressable>
      </View>
    </>
  ));
}
