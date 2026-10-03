---
title: Writing a test
summary: Render, query, interact and assert with @solid-native/testing - the recipes for forms, async work, services, requests, navigation and styling follow.
---

# Writing a test

Render, query, interact, assert, with `node:test`, `node:assert` and Testing Library-style helpers
on a fake Fabric. [Setup](/packages/testing/setup) covers the `node --import` hook.

## Render, interact, assert

The template ships this test as `src/app/app.test.ts`:

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen, userEvent } from '@solid-native/testing';
import { App } from './app.solid.tsx';

afterEach(cleanup);

test('counts taps', async () => {
  render(App);
  assert.ok(screen.getByText('Tapped 0 times'));

  await userEvent.press(screen.getByRole('button'));

  assert.ok(screen.getByText('Tapped 1 times'));
});
```

`render()` mounts onto a fresh `createFakeFabric()` and commits the first frame synchronously.
`screen` queries the latest render; the result has the same queries bound. `cleanup` unmounts every
render and runs `onCleanup`. Finding by `accessibilityRole` proves the role reaches native, not how
VoiceOver or TalkBack announce it. `userEvent.press()` goes through real responder negotiation, so
`onPress` runs only when a real tap would.

## Queries

Six forms: `getBy*` (exactly one), `getAllBy*` (at least one), `queryBy*`/`queryAllBy*` (`null`/`[]`
instead of throwing), `findBy*`/`findAllBy*` (wait). Six kinds:

| Query               | Matches                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `ByRole`            | `accessibilityRole`, narrowed by `{ name }`: label, or text inside. |
| `ByText`            | The whole text of a `Text`, nested runs included.                   |
| `ByTestId`          | `testID`, or `nativeID`.                                            |
| `ByLabelText`       | `accessibilityLabel`.                                               |
| `ByPlaceholderText` | A field's `placeholder`.                                            |
| `ByDisplayValue`    | The text in a `TextInput`.                                          |

Strings match the whole trimmed text, or a case-insensitive substring with `{ exact: false }`.
Hidden nodes are skipped unless `{ includeHiddenElements: true }`. `within(node)` scopes to a
subtree.

## Props and callbacks

A component under test, in its own `.solid.tsx` file:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, Text } from '@solid-native/components/solid';

export function Greeting(props: { name: string; onGreet?: (name: string) => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => props.onGreet?.(props.name)}>
      <Text>Hello, {props.name}</Text>
    </Pressable>
  );
}
```

Props are reactive: `setProps` merges and commits, so there is no `rerender()`.

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen, userEvent } from '@solid-native/testing';
import { Greeting } from './greeting.solid.tsx';

afterEach(cleanup);

test('takes props, calls back, and follows a changed prop', async () => {
  const greeted: string[] = [];
  const { setProps } = render(Greeting, {
    props: { name: 'Ada', onGreet: (value) => greeted.push(value) },
  });

  await userEvent.press(screen.getByRole('button'));
  assert.deepEqual(greeted, ['Ada']);

  setProps({ name: 'Grace' });
  assert.ok(screen.getByText('Hello, Grace'));
});
```

## fireEvent and userEvent

`userEvent` acts like a person, events a task apart: `press`, `longPress` (`{ duration }`, 500ms),
`type` (`{ submitEditing: true }`, `{ skipBlur: true }`) and `clear`. `fireEvent` sends one event:
`press`, `changeText(node, 'Ada')`, `scroll`, `focus`, `blur`, or any by name
(`fireEvent(node, 'submitEditing', { text })` emits `topSubmitEditing`). Both resolve once committed.

## Recipes

- [Testing a form](/packages/testing/testing-forms) - typing, touched state, disabling a field.
- [Testing async work](/packages/testing/testing-async) - waiting for what arrives later.
- [Testing with services](/packages/testing/testing-services) - replacing a dependency with a
  stand-in.
- [Testing network requests](/packages/testing/testing-http) - answering `fetch` from the test.
- [Testing navigation](/packages/testing/testing-navigation) - pushing screens on the native stack.
- [Testing styles](/packages/testing/testing-styling) - a component's own CSS and a global
  stylesheet.

## Debugging

`screen.debug(node?)` prints the committed tree; failing queries include it too:

```ts
screen.debug(screen.getByRole('button'));
```

Names are Fabric's: `View`/`Pressable` as `View`, `Text` as `Paragraph`, `TextInput` as `TextInput`
(iOS) or `AndroidTextInput`. Held nodes go stale after an interaction: query again.
