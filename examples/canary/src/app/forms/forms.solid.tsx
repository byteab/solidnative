/** @jsxImportSource @solid-native/platform/solid */
import {
  createForm,
  bindFormField,
  formRequired,
  formMinLength,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from '@solid-native/components/solid';
import { Show } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';

export function FormsPage() {
  const form = createForm(
    { name: '', subscribed: false },
    {
      name: { validate: [formRequired(), formMinLength(3)] },
      subscribed: {},
    },
  );
  return (
    <>
      <NativeHeader title="Signal forms" />
      <ScrollView
        class="screen"
        contentContainerStyle={page.content}
        automaticallyAdjustKeyboardInsets
      >
        <Text class="hint">required + minLength(3). Type fast: characters must not drop.</Text>
        <TextInput
          {...bindFormField(form.fields.name)}
          class="field"
          placeholder="name"
          placeholderTextColor="#6c6c78"
        />
        <Show
          when={form.fields.name.errors().length}
          fallback={<Text class="hint success">valid</Text>}
        >
          <Text class="hint danger">{form.fields.name.errors().length} validation error(s)</Text>
        </Show>
        <View style={page.row}>
          <Switch {...bindFormField(form.fields.subscribed)} />
          <Text class="body">subscribed</Text>
        </View>
        <Text class="body">
          model: <Text class="strong">{JSON.stringify(form.value())}</Text>
        </Text>
      </ScrollView>
    </>
  );
}
