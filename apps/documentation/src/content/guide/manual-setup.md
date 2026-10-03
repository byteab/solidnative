---
title: Adding it to an existing app
summary: Wiring the framework into an Expo app you already have, one file at a time.
---

# Adding it to an existing app

The [Getting started](/guide/getting-started) template is shorter. For a blank or existing Expo
app, do every step below. In an Nx workspace, `nx g @solidnative/nx:app` does it all ([Nx](/packages/nx)).

## Start the project

**Create a blank project:**

```sh
npx create-expo-app my-app --template blank-typescript
cd my-app
rm App.tsx index.ts
```

**For an existing app:** remove `App.tsx` or `index.js` and point `"main"` at the
`src/main.solid.ts` below. Keep dependencies, native config and assets.

```json
{
  "main": "src/main.solid.ts"
}
```

## Install the framework packages

```sh
npm install solid-js@1.9.15 \
  @solidnative/platform @solidnative/fabric \
  @solidnative/components @solidnative/device @solidnative/metro
npm install --save-dev @babel/core@^7.29.7
```

`SafeAreaView` and `SafeAreaProvider` (most apps, to clear the notch) need
`react-native-safe-area-context`:

```sh
npx expo install react-native-safe-area-context
```

Expo Go bundles it, so a missing install only shows in a dev or release build as
`Unimplemented component: <RNCSafeAreaView>`. Add `@solidnative/router`, `@solidnative/expo` and
`@solidnative/icons` as needed (each has a `/solid` entry); `@solidnative/expo` installs no native
code, so install modules such as `expo-haptics` yourself.

## Configure Metro

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solidnative/metro/solid-config.cjs');

module.exports = withSolidNative(getDefaultConfig(__dirname));
```

`withSolidNative` compiles Solid JSX and `.native.css` imports, and resolves `solid-js` to its
client build (`solid-js/web` is rejected). In a monorepo with the packages outside the app's
`node_modules`, pass `{ workspaceRoot }`.

## Configure Babel

```js
// babel.config.js
const { isSolidFile } = require('@solidnative/metro/solid-babel.cjs');

const preset = require.resolve('expo/internal/babel-preset');

module.exports = {
  presets: [preset],
  overrides: [{ test: isSolidFile, presets: [[preset, { enableReactFastRefresh: false }]] }],
};
```

The override turns off React Refresh, which Expo's dev transform always enables, for Solid files
only; `withSolidNative` cannot. `expo/internal/babel-preset` re-exports `babel-preset-expo`, so no
direct dependency is needed.

## Configure TypeScript

```json
// tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "allowImportingTsExtensions": true,
    "jsx": "preserve",
    "jsxImportSource": "@solidnative/platform/solid",
    "types": ["node"]
  }
}
```

`allowImportingTsExtensions` is required (the packages ship `.ts` imports); `jsxImportSource` lets
`tsc` check component props. Declare `.native.css` imports in `src/native-styles.d.ts`:

```ts
declare module '*.native.css' {
  const sheet: import('@solidnative/fabric').StyleSheet;
  export default sheet;
}
```

## Write the entry point

```ts
// src/main.solid.ts
import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { createNativeRoot } from '@solidnative/platform/solid';
import {
  conditionSources,
  currentConditions,
  deviceTokens,
  watchConditions,
} from '@solidnative/device/solid';
import { getFabricUIManager, registerPlatformComponents } from '@solidnative/fabric';
import { App } from './app/app.solid.tsx';

registerPlatformComponents(Platform.OS);

AppRegistry.registerRunnable('main', ({ rootTag }: { rootTag: number | string }) => {
  const sources = conditionSources();
  const root = createNativeRoot({
    fabric: getFabricUIManager(),
    rootTag: Number(rootTag),
    engineOptions: {
      processColor,
      conditions: currentConditions(sources),
      tokens: deviceTokens(),
      resolveAssetSource: (value) => Image.resolveAssetSource(value as never),
    },
  });
  root.render(() => {
    watchConditions(root.engine, { sources });
    return App();
  });
});
```

`registerRunnable`, not `registerComponent`, so React Native never renders. The `engineOptions`:

- **`conditions`**: `@media` values; `watchConditions` (inside `render`, so the root owns it) updates
  them on rotation or theme change, so `dark:` follows the system.
- **`tokens`**: device values such as hairline width; without it `1px` is a thick divider on 3x.
- **`resolveAssetSource`**: makes `require('./x.png')` loadable; without it images stay blank.
- **`processColor`**: colors to platform integers.

The `.solid.ts` suffix gives the entry a clean reload.

## Write the root component

```tsx
// src/app/app.solid.tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, Text, View } from '@solidnative/components/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import sheet from './app.native.css';

export function App() {
  const [count, setCount] = createSignal(0);
  return withNativeStyles(sheet, () => (
    <View class="box">
      <Text>tapped {count()} times</Text>
      <Pressable accessibilityRole="button" onPress={() => setCount((n) => n + 1)}>
        <Text>tap me</Text>
      </Pressable>
    </View>
  ));
}
```

```css
/* src/app/app.native.css */
.box {
  flex: 1;
  justify-content: center;
  padding: 24px;
}
```

`withNativeStyles` scopes the sheet's classes to the wrapped JSX. JSX files need the
`@jsxImportSource` comment or a `.solid.tsx` suffix, or Metro compiles them as React and nothing
renders. Run `npx expo start`, open in Expo Go or press `i`/`a`, and check each press counts.

## Add tests

Install `@solidnative/testing` as a dev dependency; its `register` hook compiles JSX and
`.native.css` for Node's test runner as Metro does. Copy `src/app/app.test.ts` from
[the template](https://github.com/byteab/solidnative/tree/main/template) and add:

```json
{
  "scripts": {
    "test": "node --import @solidnative/testing/register --test \"src/**/*.test.ts\""
  }
}
```

## Add Tailwind

Skip Tailwind if you use `.native.css` sheets or plain `style` objects.

```sh
npm install @solidnative/tailwind tailwindcss @tailwindcss/cli
```

```css
/* src/styles.css */
@import 'tailwindcss/theme.css';
@import 'tailwindcss/utilities.css';
@import '@solidnative/tailwind/native.css';
```

```js
// metro.config.js
const { withTailwind } = require('@solidnative/tailwind/config.cjs');

module.exports = withTailwind(withSolidNative(getDefaultConfig(__dirname)), {
  input: './src/styles.css',
});
```

```ts
// src/main.solid.ts
import tailwind from '../.solidnative/app.tailwind.js';

// ...and in engineOptions, beside processColor:
  globalStyles: tailwind,
```

The sheet is `.js` because Expo's worker empties `.css` modules. `withTailwind` watches the
Tailwind CLI and updates the sheet without a restart. Metro writes it and its `.d.ts` to
`.solidnative/` on startup: start Metro before the first typecheck and gitignore the directory.
See [Theming and Tailwind](/guide/theming).

## The dev loop

Saving a Solid file reloads the JS VM and resets all state; there is no hot replacement. Restart
Metro after compiler or config edits.

## Where to go next

Continue with [Build a form](/guide/forms), [Working offline](/guide/offline), then
[Deployment](/guide/deployment).
