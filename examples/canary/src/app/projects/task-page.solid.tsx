/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal, onCleanup } from 'solid-js';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { Dialogs, SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { NativeHeader, useNavigation, useRoute } from '@solidnative/router/solid';
import { PEOPLE, ProjectServer, ProjectStore } from './project-data.solid.ts';
import sheet from './task-page.native.css';

export function TaskPage() {
  const store = useService(ProjectStore);
  const server = useService(ProjectServer);
  const dialogs = useService(Dialogs);
  const inFront = useService(SCREEN_IN_FRONT);
  const navigation = useNavigation();
  const route = useRoute();
  const pid = () => String(route.inputs['pid']);
  const tid = () => String(route.inputs['tid']);
  const task = createMemo(() => store.task(tid()));
  const comments = createMemo(() => store.commentsOf(tid()));
  const assignee = createMemo(
    () => PEOPLE.find((person) => person.id === task()?.assignee)?.name ?? 'nobody',
  );
  const [problem, setProblem] = createSignal<string>();
  let active = true;
  let asking = false;
  onCleanup(() => {
    active = false;
  });
  store.ensureLoaded();
  const edit = () => {
    void navigation.present(`/projects/${pid()}/tasks/${tid()}/edit`, {
      as: 'formSheet',
      presentation: { sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true },
    });
  };
  function duplicate() {
    const copy = store.duplicate(tid());
    if (copy && active) void navigation.push(`/projects/${pid()}/tasks/${copy.id}`);
  }
  async function remove() {
    if (!active || asking) return;
    const id = tid();
    asking = true;
    try {
      const sure = await dialogs.confirm('Delete this task?', {
        message: 'It goes for everyone on the project.',
        confirm: 'Delete',
        destructive: true,
      });
      if (!sure || !active || !inFront()) return;
      void store.remove(id);
      if (active) void navigation.back();
    } catch {
      if (active) setProblem('Could not delete the task. Try again.');
    } finally {
      asking = false;
    }
  }
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title={task()?.title ?? 'Task'} />
      <ScrollView class="screen" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Show when={problem()}>
          {(message) => (
            <Text class="body danger" accessibilityRole="alert">
              {message()}
            </Text>
          )}
        </Show>
        <Show when={store.notice()}>
          {(notice) => (
            <Pressable class="card notice" accessibilityRole="alert" onPress={store.dismissNotice}>
              <Text class="body danger">{notice()}</Text>
            </Pressable>
          )}
        </Show>
        <Show
          when={task()}
          fallback={
            <Show when={store.loaded()} fallback={<Text class="hint">Loading</Text>}>
              <Text class="body" accessibilityRole="alert">
                This task has been deleted.
              </Text>
              <Pressable
                class="button"
                accessibilityRole="button"
                onPress={() => {
                  void navigation.back();
                }}
              >
                <Text class="button-label">Go back</Text>
              </Pressable>
            </Show>
          }
        >
          {(current) => (
            <>
              <Text class="heading">{current().title}</Text>
              <Show when={current().notes}>
                <Text class="body">{current().notes}</Text>
              </Show>
              <Pressable
                class="card row"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: current().done }}
                onPress={() => store.toggleDone(current().id)}
              >
                <Text class="body">{current().done ? 'Done' : 'Not done'}</Text>
                <Text class="hint">Tap to change</Text>
              </Pressable>
              <Pressable
                class="card row"
                accessibilityRole="link"
                onPress={() => {
                  void navigation.push(`/people/${current().assignee}`);
                }}
              >
                <Text class="body">Assigned to</Text>
                <Text class="strong">{assignee()}</Text>
              </Pressable>
              <View class="actions">
                <Pressable class="button" accessibilityRole="button" onPress={edit}>
                  <Text class="button-label">Edit</Text>
                </Pressable>
                <Pressable class="card" accessibilityRole="button" onPress={duplicate}>
                  <Text class="button-label">Duplicate</Text>
                </Pressable>
                <Pressable
                  class="card"
                  accessibilityRole="button"
                  onPress={() => {
                    void remove();
                  }}
                >
                  <Text class="button-label danger">Delete</Text>
                </Pressable>
              </View>
              <Text class="section">Comments</Text>
              <For each={comments()}>
                {(comment) => (
                  <Pressable
                    class="card comment"
                    accessibilityRole="link"
                    onPress={() => {
                      void navigation.push(
                        `/projects/${pid()}/tasks/${tid()}/comments/${comment.id}`,
                      );
                    }}
                  >
                    <Text class="body">{comment.text}</Text>
                  </Pressable>
                )}
              </For>
              <Text class="section">Elsewhere</Text>
              <Pressable
                class="card"
                accessibilityRole="button"
                onPress={() => {
                  server.editElsewhere(tid());
                  void store.load();
                }}
              >
                <Text class="button-label">Have Grace rename it, then refresh</Text>
              </Pressable>
              <Pressable
                class="card"
                accessibilityRole="button"
                onPress={() => {
                  void navigation.popTo(`/projects/${pid()}`);
                }}
              >
                <Text class="button-label">Back to the project</Text>
              </Pressable>
              <Pressable
                class="card"
                accessibilityRole="button"
                onPress={() => {
                  void navigation.popTo('/projects');
                }}
              >
                <Text class="button-label">Back to all projects</Text>
              </Pressable>
            </>
          )}
        </Show>
      </ScrollView>
    </>
  ));
}
