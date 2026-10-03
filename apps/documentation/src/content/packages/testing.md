---
title: Testing
summary: Testing Solid components in Node with @solid-native/testing, on a fake Fabric, with no simulator and no device.
---

# Testing

Component tests run in plain Node, in milliseconds, on a fake of the native side, with Testing
Library's `render()` and `screen` and RNTL's `fireEvent` and `userEvent`. The template's test:

```ts
// src/app/app.test.ts
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

See [Writing a test](/packages/testing/writing-a-test) and the
[API reference](/packages/testing/api).

## The fake Fabric

`createFakeFabric()` records the calls the renderer makes to `nativeFabricUIManager` (`createNode`,
`cloneNode*`, `appendChild`, `completeRoot`, `registerEventHandler`, `setIsJSResponder`,
`dispatchCommand`, `measureInWindow`) instead of drawing. Renderer, styling, responder system and
components are real, compiled with Metro's Solid transform.

So queries read what native would receive: `props` are flattened, styles resolved. A press is
`topTouchStart` and `topTouchEnd` through real responder negotiation, so a disabled button ignores
it.

## What a test does and does not prove

It proves tree, events and props: a signal that never reaches a prop, a miswired handler, a
missing role or label. It proves nothing Yoga or the platform decides: layout, paint, real keyboard,
gesture recognition, UI-thread animation (`gestureOf` only calls a gesture's callbacks). For those,
see [End-to-end tests](/packages/testing/end-to-end) with Maestro.

## Which runner

Node's own runner; `@solid-native/testing` is the only test dependency:

```sh
node --import @solid-native/testing/register --test "src/**/*.test.ts"
```

The register hook compiles the app the way Metro does. [`@solid-native/nx`](/packages/nx) apps run
the same command; Vitest uses `solidNative()` instead. [Setup](/packages/testing/setup) has both.
