/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { Pressable, Text, View, VirtualList } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { NativeHeader, NativeHeaderItem, useNavigation, useRoute } from '@solidnative/router/solid';
import { ProjectStore } from './project-data.solid.ts';
import sheet from './project-page.native.css';

type Filter = 'all' | 'open' | 'done';
export function ProjectPage() {
  const store = useService(ProjectStore);
  const navigation = useNavigation();
  const route = useRoute();
  const pid = () => String(route.inputs['pid']);
  const [filter, setFilter] = createSignal<Filter>('all');
  const shown = createMemo(() =>
    store
      .tasksOf(pid())
      .filter((task) => filter() === 'all' || task.done === (filter() === 'done')),
  );
  store.ensureLoaded();
  const create = () => {
    void navigation.present(`/projects/${pid()}/new`, {
      as: 'formSheet',
      presentation: { sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true },
    });
  };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title={store.project(pid())?.name ?? 'Project'}>
        <NativeHeaderItem type="right">
          <Pressable accessibilityRole="button" accessibilityLabel="New task" onPress={create}>
            <Text class="action">New</Text>
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>
      <View class="screen">
        <Show when={store.notice()}>
          {(notice) => (
            <Pressable class="card notice" accessibilityRole="alert" onPress={store.dismissNotice}>
              <Text class="body danger">{notice()}</Text>
            </Pressable>
          )}
        </Show>
        <View class="filters">
          <For each={['all', 'open', 'done'] as Filter[]}>
            {(option) => (
              <Pressable
                class={filter() === option ? 'chip chip-on' : 'chip'}
                accessibilityRole="button"
                accessibilityState={{ selected: filter() === option }}
                onPress={() => setFilter(option)}
              >
                <Text class="chip-label">{option}</Text>
              </Pressable>
            )}
          </For>
          <Text class="hint count">{shown().length} tasks</Text>
        </View>
        <VirtualList
          class="list"
          items={shown()}
          itemHeight={56}
          keyExtractor={(task) => task.id}
          refreshControl={{
            get refreshing() {
              return store.state() === 'refreshing';
            },
            onRefresh: () => {
              void store.load();
            },
          }}
          renderItem={(task) => (
            <View class="task">
              <Pressable
                class="check"
                accessibilityRole="checkbox"
                accessibilityLabel={task().title}
                accessibilityState={{ checked: task().done }}
                onPress={() => store.toggleDone(task().id)}
              >
                <Text class={task().done ? 'tick on' : 'tick'}>{task().done ? '✓' : ''}</Text>
              </Pressable>
              <Pressable
                class="task-title"
                accessibilityRole="button"
                onPress={() => {
                  void navigation.push(`/projects/${pid()}/tasks/${task().id}`);
                }}
              >
                <Text class={task().done ? 'body done' : 'body'}>{task().title}</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </>
  ));
}
