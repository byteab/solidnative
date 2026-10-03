---
title: Testing
---

The tracker works, and you have been checking that by looking at it. A test checks it for you,
every time anything changes. `@solid-native/testing` mounts the real native renderer, components,
style engine and touch handling onto a fake Fabric, an in-memory stand-in for React Native's
renderer. Queries read the native tree that was committed and the props each view was given. The
fake does not run Yoga layout, draw pixels, open a keyboard or run a platform's accessibility
services, so those need the app on a device or a simulator. In an app, these tests run in Node in
milliseconds; here they run in the page, on the same fake.

The tests are written with Vitest, as an app's would be. `app.spec.ts` has one already.

## Test what is on screen

`render` draws a component, and `screen` finds what it drew, the way a person would: by its text,
or by its role. Add this test to the existing `App` group in `app.spec.ts`:

```ts
it('shows every habit, and how many are left', () => {
  render(App);
  expect(screen.getByText('Drink water')).toBeTruthy();
  expect(screen.getByText('Read ten pages')).toBeTruthy();
  expect(screen.getByText('Walk')).toBeTruthy();
  expect(screen.getByText('2 left to do')).toBeTruthy();
});
```

`getByText` throws when nothing matches, and the error lists what was on screen instead, so a
failing test says what it found.

The checks here run your tests against copies of the app: one that works, and one with the habit
rows taken out. To complete this step, at least one test has to pass against the first and fail
against the second. A test that checks only the heading passes against both, so it cannot notice
that the habits are gone.

## Test a press

`userEvent.press` puts a finger on a view and lifts it, through the same touch handling a real
press goes through:

```ts
import { render, screen, userEvent } from '@solid-native/testing';

it('ticks a habit off when it is pressed', async () => {
  render(App);
  await userEvent.press(screen.getByText('Drink water'));
  expect(screen.getByText('1 left to do')).toBeTruthy();
});
```

Pressing the text presses the row, as a finger on the words would. It is awaited because the screen
commits once the press has been handled, and asserting before then would still see the old count.

## Test the row on its own

`HabitRow` can be tested without the screen around it. `props` are the props it is rendered with,
and a function made with `vi.fn()` records every call, so it can stand in for `onToggle`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { HabitRow } from './habit-row';

describe('HabitRow', () => {
  it('says when it is pressed', async () => {
    const onToggle = vi.fn();
    render(HabitRow, { props: { name: 'Stretch', onToggle } });
    await userEvent.press(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

These run unchanged in an app. An app generated from the template already has Vitest and the
`solidNative()` plugin from `@solid-native/testing/vitest`, and `npm test` runs them. For an existing app,
installing the packages is not enough on its own: [Setup](/packages/testing/setup) covers the
config. What the fake cannot show, such as scrolling, the keyboard and what a screen reader says,
needs the app on a device, and [End-to-end tests](/packages/testing/end-to-end) drive it there.
From here, run the tracker on a phone, add [native navigation](/packages/router), and keep the
habits between launches with [SQLite](/packages/expo/database).
