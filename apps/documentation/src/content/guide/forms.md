---
title: Build a form
summary: createForm over native controls, validated and submitted, with no adapter code.
---

# Build a form

## The forms API

`@solid-native/components/solid` exports `createForm`, `bindFormField`, the validators
`formRequired`, `formMinLength`, `formMaxLength`, `formPattern` and `formEmail`, and the
`FormSchema` type. `<TextInput>` and `<Switch>` take `value`, `onValueChange`, `disabled`,
`invalid`, `touched` and `onTouched`, which is what `bindFormField(field)` returns to spread.

## Define the form

`createForm` takes the initial value and a schema of the same shape, with validators under
`validate`:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import {
  bindFormField,
  createForm,
  formMinLength,
  formRequired,
  Switch,
  Text,
  TextInput,
  View,
} from '@solid-native/components/solid';
import { Show } from '@solid-native/platform/solid';

export function SignUp() {
  const form = createForm(
    { name: '', subscribed: false },
    {
      name: { validate: [formRequired(), formMinLength(3)] },
      subscribed: {},
    },
  );
  const f = form.fields;

  return (
    <View>
      <TextInput placeholder="Name" {...bindFormField(f.name)} />
      <Show when={f.name.touched() && f.name.invalid()}>
        <Text>{f.name.errors().length} error(s)</Text>
      </Show>

      <View class="flex-row items-center gap-2">
        <Switch {...bindFormField(f.subscribed)} />
        <Text>Subscribe to updates</Text>
      </View>
    </View>
  );
}
```

`form.value()` is the whole value. Each leaf of `form.fields` is a `FormField` with `value()`,
`setValue()`, `errors()`, `invalid()`, `touched()`, `pending()`, `disabled()` and `hidden()`;
arrays become a `FormArray` whose `items()` are field trees, validated through the schema's `each`.
Call `bindFormField` once, in code that runs once; the binding is released with its owner.

## Why no adapter class was needed

A validator is a plain function returning `undefined`, a `FormError` (`{ kind, message }`) or a
list of them. Its second argument carries the form's `values`, for cross-field rules:

```ts
confirm: {
  validate: (value, { values }) =>
    value === values.password ? undefined : { kind: 'mismatch', message: 'The passwords do not match' },
},
```

A schema can also derive `hidden` and `disabled` from `values`, and take an `async` validator with
`debounceMs`, an `AbortSignal` and an `onError` fallback, as the canary's
`examples/canary/src/app/forms/application-form.solid.ts` does. The control side is in
[Text input](/packages/components/input).

## Style invalid state

Bound controls expose `data-invalid`, `data-touched` and `data-disabled` attributes, selectable
on the controls' host names:

```css
text-input {
  border-width: 1px;
  border-color: #3a3a42;
  border-radius: 8px;
  padding: 12px;
}
text-input[data-invalid][data-touched] {
  border-color: #ff6b6b;
}
```

## Submit the form

`form.submit(handler)` marks every field touched, runs `handler` only for a valid form, and
resolves `true` when it completed:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import {
  bindFormField,
  createForm,
  formMinLength,
  formRequired,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from '@solid-native/components/solid';
import { Match, Show, Switch as Choose } from '@solid-native/platform/solid';

/** Stands in for your own API call. Resolves false for a name that is already taken. */
async function createAccount(data: { name: string; subscribed: boolean }): Promise<boolean> {
  return data.name !== 'ada';
}

export function SignUp() {
  const [status, setStatus] = createSignal<'idle' | 'success' | 'taken' | 'error'>('idle');
  const form = createForm(
    { name: '', subscribed: false },
    { name: { validate: [formRequired(), formMinLength(3)] }, subscribed: {} },
  );
  const f = form.fields;

  async function save() {
    const ok = await form.submit(async (value) => {
      setStatus((await createAccount(value)) ? 'success' : 'taken');
    });
    if (!ok) setStatus('error');
  }

  return (
    <View>
      <TextInput placeholder="Name" {...bindFormField(f.name)} />
      <Show when={f.name.touched() && f.name.invalid()}>
        <Text accessibilityRole="alert">{f.name.errors().length} error(s)</Text>
      </Show>

      <View class="flex-row items-center gap-2">
        <Switch {...bindFormField(f.subscribed)} />
        <Text>Subscribe to updates</Text>
      </View>

      <Pressable accessibilityRole="button" disabled={form.submitting()} onPress={save}>
        <Text>{form.submitting() ? 'Signing up…' : 'Sign up'}</Text>
      </Pressable>

      <Choose>
        <Match when={status() === 'success'}>
          <Text>You're signed up.</Text>
        </Match>
        <Match when={status() === 'taken'}>
          <Text accessibilityRole="alert">That name is already taken.</Text>
        </Match>
        <Match when={status() === 'error'}>
          <Text accessibilityRole="alert">Fix the errors above, then try again.</Text>
        </Match>
      </Choose>
    </View>
  );
}
```

For an invalid form, `submit()` resolves `false` and focuses the first invalid bound control
(unless `{ focusInvalid: false }`). `form.submitting()` is true while the handler runs. The
handler's second argument is `{ signal }`; editing or disposing the form mid-run aborts it and
`submit()` resolves `false`. Handlers cannot attach a server error to a field: report it through
your own state, as `status` does, or use an `async` validator.
