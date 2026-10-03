---
title: Testing async work
summary: findBy queries, waitFor and waitForElementToBeRemoved, for whatever arrives after the first frame.
---

# Testing async work

Continues from [Writing a test](/packages/testing/writing-a-test). `render()` and every event
settle before they return, but the app's own timers and promises finish later. A component that
loads on a timer:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Show } from '@solidnative/platform/solid';
import { Text } from '@solidnative/components/solid';

export function Later() {
  const [ready, setReady] = createSignal(false);
  const timer = setTimeout(() => setReady(true), 100);
  onCleanup(() => clearTimeout(timer));
  return (
    <Show when={ready()} fallback={<Text>Loading</Text>}>
      <Text>Loaded</Text>
    </Show>
  );
}
```

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen, waitFor, waitForElementToBeRemoved } from '@solidnative/testing';
import { Later } from './later.solid.tsx';

afterEach(cleanup);

test('finds what arrives later', async () => {
  render(Later);

  assert.ok(await screen.findByText('Loaded'));
  assert.equal(screen.queryByText('Loading'), null);
});

test('waits for the placeholder to go', async () => {
  render(Later);

  await waitForElementToBeRemoved(() => screen.queryByText('Loading'));
  await waitFor(() => assert.ok(screen.getByText('Loaded')));
});
```

`findBy*` is `getBy*` retried. `waitFor` retries until the callback stops throwing, else rejects
with its last error. Both poll every 50ms for 1000ms (`findBy*` takes options third).
`waitForElementToBeRemoved` needs the node present at the start.

Polling uses real timers: with `t.mock.timers`, advance the clock yourself.
`render(Component, { clock: createClock() })` queues commits and frames until `flush()`, or the
clock's `flushMicrotasks()` and `frame(time)`. `cleanup` runs `onCleanup`, clearing pending timers.
