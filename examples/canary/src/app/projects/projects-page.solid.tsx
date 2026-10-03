/** @jsxImportSource @solidnative/platform/solid */
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { ActivityIndicator, Pressable, ScrollView, Text } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { NativeHeader, useNavigation } from '@solidnative/router/solid';
import { ProjectStore } from './project-data.solid.ts';
import sheet from './projects-page.native.css';

export function ProjectsPage() {
  const store = useService(ProjectStore);
  const navigation = useNavigation();
  store.ensureLoaded();
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Projects" largeTitle />
      <ScrollView
        class="screen"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={{
          get refreshing() {
            return store.state() === 'refreshing';
          },
          onRefresh: () => {
            void store.load();
          },
        }}
      >
        <Show when={store.state() === 'loading'}>
          <ActivityIndicator size="large" />
        </Show>
        <Show when={store.state() === 'failed'}>
          <Text class="body danger" accessibilityRole="alert">
            Could not load the projects.
          </Text>
          <Pressable
            class="button"
            accessibilityRole="button"
            onPress={() => {
              void store.load();
            }}
          >
            <Text class="button-label">Try again</Text>
          </Pressable>
        </Show>
        <For each={store.projects()}>
          {(project) => (
            <Pressable
              class="card project"
              accessibilityRole="button"
              onPress={() => {
                void navigation.push(`/projects/${project.id}`);
              }}
            >
              <Text class="button-label">{project.name}</Text>
              <Text class="hint">
                {store.tasksOf(project.id).filter((task) => !task.done).length} open
              </Text>
            </Pressable>
          )}
        </For>
      </ScrollView>
    </>
  ));
}
