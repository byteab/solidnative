---
title: Getting started
summary: Create an Expo app, render your first Solid component as native views, and run its test.
---

# Getting started

solid-native is in alpha. If you hit a bug, please [open an issue](https://github.com/byteab/solid-native/issues/new/choose).

## Create the app

```sh
npx create-expo-app@latest my-app --template @solidnative/template
cd my-app
npx expo start
```

The template installs `solid-js` and the framework packages, with Metro and Babel configured. For
an existing Expo app, see [Adding it to an existing app](/guide/manual-setup); in an Nx workspace,
run `nx add @solidnative/nx` then `nx g @solidnative/nx:app apps/mobile` (see [Nx](/packages/nx)).

Scan the QR code with [Expo Go](https://expo.dev/go), or press `i` or `a` for a simulator. `<View>`
becomes a `UIView` on iOS or an `android.view.View` on Android, with no React in the render path.
The template targets iOS and Android only: ignore the `npm run web` hint `create-expo-app` prints.

## Edit `app.solid.tsx` and check the counter

The template's `src/app/app.solid.tsx` imports native components from
`@solidnative/components/solid`:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, SafeAreaView, Text, View } from '@solidnative/components/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import sheet from './app.native.css';

export function App() {
  const [count, setCount] = createSignal(0);
  return withNativeStyles(sheet, () => (
    <SafeAreaView class="screen">
      <View class="body">
        <Text class="title">Solid, natively</Text>
        <Text class="hint">Real native views. React is never in the render path.</Text>

        <Pressable accessibilityRole="button" class="button" onPress={() => setCount(count() + 1)}>
          <Text class="label">Tapped {count()} times</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  ));
}
```

Its classes live in `src/app/app.native.css`, compiled at build time:

```css
.screen {
  flex: 1;
  background-color: #101014;
}
.body {
  flex: 1;
  justify-content: center;
  gap: 12px;
  padding: 24px;
}
.button {
  align-items: center;
  padding: 14px;
  border-radius: 10px;
  background-color: #3b6ef5;
}
```

Edit the `title` text and save to see it on the device; the button increments `count`. Three rules
catch most first mistakes:

- **A file with JSX is a `.solid.tsx` file**, or starts with the
  `/** @jsxImportSource @solidnative/platform/solid */` comment. Without either, Metro compiles it
  as React and nothing it renders reaches the screen.
- **Text only renders inside `<Text>`.** There is no `<div>`, `<span>` or `onClick`; events are
  native props such as `onPress`.
- **Components run once.** Read signals inside JSX, `createMemo` or `createEffect`, and do not
  destructure `props`, or the value freezes at its first read.

## Run `app.test.ts`

```sh
npm test
```

`app.test.ts` runs in Node's test runner (Node 24) without a simulator.
`@solidnative/testing/register` compiles JSX and `.native.css` as Metro does, and `render()` mounts
over a fake Fabric that records what native would receive.

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen, userEvent } from '@solidnative/testing';
import { App } from './app.solid.tsx';

afterEach(cleanup);

test('counts taps', async () => {
  render(App);
  assert.ok(screen.getByText('Tapped 0 times'));

  await userEvent.press(screen.getByRole('button'));

  assert.ok(screen.getByText('Tapped 1 times'));
});
```

[Testing](/packages/testing) covers what such tests prove.

## Style a control

`Pressable` is unstyled. Toggle classes from state with `classList`, here with Tailwind utilities
(see [setting up Tailwind](/packages/tailwind)):

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, Text } from '@solidnative/components/solid';

export function WifiToggle() {
  const [wifi, setWifi] = createSignal(true);
  return (
    <Pressable
      onPress={() => setWifi(!wifi())}
      class="h-6 w-10 rounded-full bg-gray-300"
      classList={{ 'bg-blue-500': wifi() }}
    >
      <Text>Wi-Fi</Text>
    </Pressable>
  );
}
```

[Theming and Tailwind](/guide/theming) explains class strings without a browser.

## The dev loop

Saving a Solid file reloads the JS VM, so the app restarts and component state resets; React
Refresh is off for Solid files and there is no state-preserving hot replacement. Files without JSX,
such as `main.solid.ts`, get the same reload via the `.solid.ts` suffix. Restart Metro after
changing compiler or Metro configuration.

## Expo Go or a development build

Expo Go covers most development. A native module or dependency patch absent from Expo Go needs a
development build (`npx expo run:ios`, `npx expo run:android` or EAS). `npx expo start` opens Expo
Go; `--dev-client` opens an installed development build.

## Building for release

`npx expo run:ios --configuration Release` and `npx expo run:android --variant release` build
standalone apps; [EAS Build](https://docs.expo.dev/build/introduction/) builds on Expo's machines.
Release bundles carry no development reload code (see [Metro](/packages/metro)).

## Where to go next

[Theming and Tailwind](/guide/theming), [Screens and navigation](/packages/router/screens),
[Components](/packages/components), [Architecture](/guide/architecture),
[Known limitations](/guide/limitations), and [solid-native compared](/guide/comparison) (React
Native, NativeScript, Ionic, Flutter).
