/** @jsxImportSource @solid-native/platform/solid */
import { createMemo } from 'solid-js';
import { Show } from '@solid-native/platform/solid';
import { Pressable, ScrollView, Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { NativeHeader, useNavigation, useRoute } from '@solid-native/router/solid';
import { PEOPLE, ProjectStore } from './project-data.solid.ts';

export function CommentPage() {
  const store = useService(ProjectStore);
  const route = useRoute();
  const navigation = useNavigation();
  const comment = createMemo(() => store.comment(String(route.inputs['cid'])));
  const author = createMemo(() => PEOPLE.find((person) => person.id === comment()?.author));
  store.ensureLoaded();
  return (
    <>
      <NativeHeader title="Comment" />
      <ScrollView class="screen" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text class="body">{comment()?.text ?? 'This comment has gone.'}</Text>
        <Show when={author()}>
          {(person) => (
            <Pressable
              class="card"
              accessibilityRole="link"
              onPress={() => {
                void navigation.push(`/people/${person().id}`);
              }}
            >
              <Text class="button-label">{person().name}</Text>
              <Text class="hint">{person().role}</Text>
            </Pressable>
          )}
        </Show>
      </ScrollView>
    </>
  );
}
