---
title: A form for new habits
---

The form comes from `@solid-native/components/solid`: `createForm` holds the values and runs the
rules, and `bindFormField` connects a field of it to a control. What is new is the control.
`<TextInput>` commits as the platform's own text field, a `UITextField` on iOS and an `EditText` on
Android, so the keyboard, the cursor, autocorrect and the return key all belong to the phone. The
binding has to meet that field halfway, and this lesson is about where it does.

## Bind a native field

Add a file, `new-habit.tsx`, with the + after the file tabs. Give it a `NewHabit` component with a
form over one name, and bind a `<TextInput>` to it:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { bindFormField, createForm, TextInput, View } from '@solid-native/components/solid';

export function NewHabit() {
  const form = createForm({ name: '' });
  return (
    <View class="mt-2 flex-row gap-2">
      <TextInput
        class="flex-1 rounded-xl bg-white px-4 py-3 text-base text-zinc-900"
        placeholder="New habit"
        {...bindFormField(form.fields.name)}
      />
    </View>
  );
}
```

Then put `<NewHabit />` under the count in `app.tsx`, above the `<ScrollView>`, and import it from
`./new-habit`.

There is no `ControlValueAccessor` here, no `ngModel` and no DOM input to bind. `bindFormField`
spreads a `value` and an `onValueChange` onto the field, which makes it controlled: the field shows
the form's value, and what is typed goes to the form first. If the form does not take a change up,
the component puts its value back. The native field numbers each change, and a value sent back
carries the number it answers, so a stale update cannot overwrite what has been typed since. When
the form takes the text as typed, as it does here, nothing is sent back at all.

## Validate the way a keyboard works

Import `formRequired` and `formMaxLength` too, and `Text` and `Show`. Give the form its rules, and
show the first error under the field once the field has been touched:

```tsx
const form = createForm(
  { name: '' },
  { name: { validate: [formRequired({ message: 'Give the habit a name' }), formMaxLength(30)] } },
);
const name = form.fields.name;
const error = () => (name.touched() ? name.errors()[0] : undefined);
```

<!-- prettier-ignore -->
```tsx
<Show when={error()}>
  {(error) => (
    <Text class="text-sm text-red-600" accessibilityRole="alert">
      {error().message}
    </Text>
  )}
</Show>
```

A component returns one thing, so wrap the row and the message in a fragment, `<>...</>`.

Two things behave differently from a browser. There is no DOM `blur` for the form to listen to:
`<TextInput>` calls the binding's `onTouched` when the native field reports a blur, and that marks
the field touched. Focus and the keyboard are separate things, and putting the keyboard away does
not always mean the field has lost focus. And a length limit belongs to the field as well as to the
form: `formMaxLength(30)` is the rule, and `maxLength={30}` on the `<TextInput>` is what the native
field enforces as the person types, so the 31st character never appears rather than appearing and
being complained about.

`accessibilityRole="alert"` tells VoiceOver and TalkBack the text is important. It does not validate
anything, and the checks here cannot show how a screen reader announces it: try the error with
VoiceOver and TalkBack on a device.

## Add from the button and the return key

Give `NewHabit` an `onAdd` prop, a button, and a `save` that submits the form:

```tsx
export function NewHabit(props: { readonly onAdd?: (name: string) => void }) {
  // ...
  function save() {
    void form.submit((value) => {
      props.onAdd?.(value.name);
      form.reset();
    });
  }
  // ...
}
```

<!-- prettier-ignore -->
```tsx
<Pressable
  class="justify-center rounded-xl bg-emerald-600 px-4 active:bg-emerald-700"
  accessibilityRole="button"
  onPress={save}
>
  <Text class="font-semibold text-white">Add</Text>
</Pressable>
```

`form.submit` marks every field touched and runs its handler only when the form is valid, so an
empty name shows its error and adds nothing. After an add, `form.reset()` puts the name back to its
starting value and marks the field untouched again, so the emptied field is not shown as a mistake
until the person leaves it empty.

The return key can add too. `returnKeyType` labels it, and `onSubmitEditing` is called when it is
pressed:

```tsx
<TextInput
  placeholder="New habit"
  maxLength={30}
  returnKeyType="done"
  submitBehavior="submit"
  {...bindFormField(name)}
  onSubmitEditing={save}
/>
```

`submitBehavior` decides what else the return key does. A single-line field defaults to
`blurAndSubmit`, which submits and loses focus. `submit` submits without the blur, so the field
keeps focus and the keyboard stays available for the next habit.

In `app.tsx`, hand `NewHabit` an `add` that puts the new habit on the end of the list:

```tsx
<NewHabit onAdd={add} />
```

```tsx
let nextHabitId = 0;
const add = (name: string) => {
  const id = `habit-${++nextHabitId}`;
  setHabits((list) => [...list, { id, name, done: false }]);
};
```

`habit.id`, not `habit.name`, is what `toggle()` matches, so every new habit needs an id no other
habit has, even when two share a name. A counter is enough while the habits live in memory; habits
that are saved need ids that stay unique across launches of the app.
