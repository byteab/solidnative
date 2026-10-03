/** @jsxImportSource @solid-native/platform/solid */
import { batch, createMemo, createRenderEffect, createSignal, onCleanup } from 'solid-js';
import { Show, withNativeStyles } from '@solid-native/platform/solid';
import {
  Pressable,
  SafeAreaProvider,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputRef,
} from '@solid-native/components/solid';
import { Dialogs, SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { useNavigation, useNativeDismissGuard, useRoute } from '@solid-native/router/solid';
import { ProjectStore } from './project-data.solid.ts';
import sheet from './task-editor.native.css';

export function TaskEditor() {
  const store = useService(ProjectStore);
  const navigation = useNavigation();
  const dialogs = useService(Dialogs);
  const inFront = useService(SCREEN_IN_FRONT);
  const route = useRoute();
  const tid = route.inputs['tid'] as string | undefined;
  const initial = (tid && store.task(tid)) || store.draft(String(route.inputs['pid']));
  const [data, setData] = createSignal(initial);
  const [original, setOriginal] = createSignal(initial);
  const [touched, setTouched] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [ready, setReady] = createSignal(!tid || !!store.task(tid));
  const [problem, setProblem] = createSignal<string>();
  const dirty = createMemo(
    () =>
      data().title !== original().title ||
      data().notes !== original().notes ||
      data().done !== original().done,
  );
  const invalid = () => !data().title.trim();
  let notes: TextInputRef | undefined;
  let active = true;
  let asking = false;
  const canAct = () => active && inFront();
  onCleanup(() => {
    active = false;
  });
  store.ensureLoaded();
  createRenderEffect(() => {
    if (ready() || !tid) return;
    const task = store.task(tid);
    if (task)
      batch(() => {
        setData(task);
        setOriginal(task);
        setReady(true);
      });
  });
  async function cancel() {
    if (!canAct() || asking) return;
    asking = true;
    try {
      if (
        dirty() &&
        !(await dialogs.confirm('Discard your changes?', {
          confirm: 'Discard',
          cancel: 'Keep editing',
          destructive: true,
        }))
      )
        return;
      if (!canAct()) return;
      // Clear the native guard before requesting a programmatic dismissal.
      const previous = original();
      setOriginal(data());
      if (canAct() && !(await navigation.back()) && active) setOriginal(previous);
    } catch {
      if (active) setProblem('Could not close the editor. Try again.');
    } finally {
      asking = false;
    }
  }
  function save() {
    if (!canAct() || !ready() || submitting()) return;
    setTouched(true);
    if (!active || invalid()) return;
    setSubmitting(true);
    if (!active) return;
    void store.save(data());
    if (!active) return;
    setOriginal(data());
    if (active)
      void navigation.back().finally(() => {
        if (active) setSubmitting(false);
      });
  }
  useNativeDismissGuard(dirty, () => {
    void cancel();
  });
  return withNativeStyles(sheet, () => (
    <SafeAreaProvider reportInsets={false} class="screen">
      <SafeAreaView class="screen" edges={['bottom']}>
        <View class="bar">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void cancel();
            }}
          >
            <Text class="action">Cancel</Text>
          </Pressable>
          <Text class="strong">{tid ? 'Edit task' : 'New task'}</Text>
          <Pressable accessibilityRole="button" disabled={!ready() || submitting()} onPress={save}>
            <Text class="action strong">Save</Text>
          </Pressable>
        </View>
        <ScrollView
          class="screen"
          contentContainerStyle={{ padding: 20, gap: 12 }}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
        >
          <Show when={!ready()}>
            <Text class="hint" accessibilityRole="alert">
              {store.loaded() ? 'This task has been deleted.' : 'Loading'}
            </Text>
          </Show>
          <Show when={problem()}>
            {(message) => (
              <Text class="hint danger" accessibilityRole="alert">
                {message()}
              </Text>
            )}
          </Show>
          <TextInput
            class="field"
            accessibilityLabel="Title"
            placeholder="Title"
            disabled={!ready()}
            value={data().title}
            onValueChange={(title) => setData((task) => ({ ...task, title }))}
            onTouched={() => setTouched(true)}
            invalid={touched() && invalid()}
            returnKeyType="next"
            onSubmitEditing={() => notes?.focus()}
          />
          <Show when={touched() && invalid()}>
            <Text class="hint danger" accessibilityRole="alert">
              Give the task a title
            </Text>
          </Show>
          <TextInput
            class="field notes"
            accessibilityLabel="Notes"
            placeholder="Notes"
            disabled={!ready()}
            multiline
            value={data().notes}
            onValueChange={(notes) => setData((task) => ({ ...task, notes }))}
            ref={(ref) => {
              notes = ref;
            }}
          />
          <View class="toggle">
            <Text class="body">Done</Text>
            <Switch
              accessibilityLabel="Done"
              disabled={!ready()}
              value={data().done}
              onValueChange={(done) => setData((task) => ({ ...task, done }))}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  ));
}
