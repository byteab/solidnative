/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  bindFormField,
  createForm,
  formEmail,
  formMinLength,
  formRequired,
  type FormField,
} from '@solidnative/components';
import { Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader } from '@solidnative/router';
import sheet from './form.native.css';

/** The first message for a field, once it has been touched. */
const errorOf = (field: FormField<string>) =>
  field.touched() ? field.errors()[0]?.message : undefined;

/** A validated form over native text fields. Submitting a valid one shows what was sent. */
export function Form() {
  const form = createForm(
    { name: '', email: '' },
    {
      name: {
        validate: [
          formRequired({ message: 'Enter your name' }),
          formMinLength(2, { message: 'At least 2 characters' }),
        ],
      },
      email: {
        validate: [
          formRequired({ message: 'Enter your email' }),
          formEmail({ message: 'Not an email address' }),
        ],
      },
    },
  );
  const [result, setResult] = createSignal<string>();
  const submit = () =>
    void form.submit(({ name, email }) => {
      setResult(`Thanks, ${name.trim()} <${email.trim()}>`);
    });

  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Form" backTitle="Back" />
      <ScrollView
        class="screen"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View class="body">
          <Text class="label">Name</Text>
          <TextInput
            {...bindFormField(form.fields.name)}
            testID="name-input"
            accessibilityLabel="Name"
            class="field"
            data-invalid={errorOf(form.fields.name) ? '' : undefined}
            placeholder="Ada Lovelace"
            autoCapitalize="words"
          />
          <Show when={errorOf(form.fields.name)}>
            {(message) => (
              <Text testID="name-error" class="error">
                {message()}
              </Text>
            )}
          </Show>

          <Text class="label">Email</Text>
          <TextInput
            {...bindFormField(form.fields.email)}
            testID="email-input"
            accessibilityLabel="Email"
            class="field"
            data-invalid={errorOf(form.fields.email) ? '' : undefined}
            placeholder="ada@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Show when={errorOf(form.fields.email)}>
            {(message) => (
              <Text testID="email-error" class="error">
                {message()}
              </Text>
            )}
          </Show>

          <Pressable testID="submit" accessibilityRole="button" class="submit" onPress={submit}>
            <Text class="submit-label">Submit</Text>
          </Pressable>
          <Show when={result()}>
            {(text) => (
              <Text testID="form-result" class="result" accessibilityRole="alert">
                {text()}
              </Text>
            )}
          </Show>
        </View>
      </ScrollView>
    </>
  ));
}
