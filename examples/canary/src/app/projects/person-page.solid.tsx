/** @jsxImportSource @solid-native/platform/solid */
import { createMemo } from 'solid-js';
import { For } from '@solid-native/platform/solid';
import { Pressable, ScrollView, Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { NativeHeader, useNavigation, useRoute } from '@solid-native/router/solid';
import { PEOPLE, ProjectStore } from './project-data.solid.ts';

export function PersonPage() {
  const store = useService(ProjectStore);
  const route = useRoute();
  const navigation = useNavigation();
  const uid = () => String(route.inputs['uid']);
  const person = createMemo(() => PEOPLE.find((person) => person.id === uid()));
  const openTasks = createMemo(() =>
    [...store.tasks().values()].filter((task) => task.assignee === uid() && !task.done).slice(0, 8),
  );
  store.ensureLoaded();
  return (
    <>
      <NativeHeader title={person()?.name ?? 'Person'} />
      <ScrollView class="screen" contentContainerStyle={{ padding: 20, gap: 10 }}>
        <Text class="hint">{person()?.role}</Text>
        <For each={openTasks()}>
          {(task) => (
            <Pressable
              class="card"
              accessibilityRole="link"
              onPress={() => {
                void navigation.push(`/projects/${task.projectId}/tasks/${task.id}`);
              }}
            >
              <Text class="body">{task.title}</Text>
            </Pressable>
          )}
        </For>
        <Pressable
          class="button"
          accessibilityRole="button"
          onPress={() => {
            void navigation.popToRoot();
          }}
        >
          <Text class="button-label">Back to the start</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
