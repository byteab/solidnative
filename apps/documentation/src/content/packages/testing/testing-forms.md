---
title: Testing a form
summary: Typing into a field, touched state, and a field a form has disabled.
---

# Testing a form

Continues from [Writing a test](/packages/testing/writing-a-test). A sign-up form built with
`createForm` from `@solid-native/components/solid`: a required email field, an error shown once it
is touched, a checkbox that disables it, and a button disabled while the form is invalid.

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Show } from '@solid-native/platform/solid';
import {
  bindFormField,
  createForm,
  formRequired,
  Pressable,
  Text,
  TextInput,
  View,
} from '@solid-native/components/solid';

export function SignUp() {
  const [busy, setBusy] = createSignal(false);
  const [submitted, setSubmitted] = createSignal('');
  const signUp = createForm(
    { email: '' },
    { email: { validate: formRequired({ message: 'Email is required' }), disabled: () => busy() } },
  );
  const email = signUp.fields.email;
  return (
    <View>
      <TextInput
        accessibilityLabel="Email"
        placeholder="you@example.com"
        {...bindFormField(email)}
      />
      <Show when={email.touched() && email.invalid()}>
        <Text accessibilityRole="alert">{email.errors()[0]?.message}</Text>
      </Show>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Busy"
        accessibilityState={{ checked: busy() }}
        onPress={() => setBusy(!busy())}
      >
        <Text>Busy</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign up"
        disabled={signUp.invalid()}
        onPress={() => setSubmitted(signUp.value().email)}
      >
        <Text>Sign up</Text>
      </Pressable>
      <Show when={submitted()}>
        <Text>Welcome, {submitted()}</Text>
      </Show>
    </View>
  );
}
```

`userEvent.type` sends what the native field does: `topFocus`, per character a `topKeyPress` and a
`topChange` with the whole text and next `eventCount`, then `topEndEditing` and `topBlur`.
`bindFormField` marks the field touched on blur.

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen, userEvent } from '@solid-native/testing';
import { SignUp } from './sign-up.solid.tsx';

afterEach(cleanup);

test('types, then presses', async () => {
  render(SignUp);

  await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
  await userEvent.press(screen.getByRole('button', { name: 'Sign up' }));

  assert.ok(screen.getByText('Welcome, ada@example.com'));
});
```

The field is found by `accessibilityLabel`. The error appears once it is touched and left empty:

```ts
test('says a field is required once it has been touched', async () => {
  render(SignUp);
  assert.equal(screen.queryByRole('alert'), null);

  await userEvent.type(screen.getByLabelText('Email'), 'a');
  await userEvent.clear(screen.getByLabelText('Email'));

  assert.ok(screen.getByRole('alert'));
  assert.ok(screen.getByText('Email is required'));
  assert.deepEqual(screen.getByLabelText('Sign up').props['accessibilityState'], {
    disabled: true,
  });
});
```

A disabled `Pressable` commits `accessibilityState`, which a screen reader announces, and ignores
presses. A disabled field commits `editable: false`; `userEvent.type` and `clear` then do nothing:

```ts
test('stops the field taking input while the form disables it', async () => {
  render(SignUp);

  await userEvent.press(screen.getByRole('checkbox', { name: 'Busy' }));
  const email = screen.getByLabelText('Email');
  assert.equal(email.props['editable'], false);

  await userEvent.type(email, 'ada@example.com');
  assert.equal(screen.queryByDisplayValue('ada@example.com'), null);
});
```

`fireEvent.changeText` sends exactly one change, editable or not. Real keyboard behaviour needs an
[end-to-end test](/packages/testing/end-to-end). [Build a form](/guide/forms) covers the form model,
including submission.
