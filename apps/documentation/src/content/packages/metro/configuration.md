---
title: Configuration
summary: What withSolidNative wires up, how .native.css imports compile, and how reload works.
---

# Configuration

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solid-native/metro/solid-config.cjs');

module.exports = withSolidNative(getDefaultConfig(__dirname));
```

```js
// babel.config.js
const { isSolidFile } = require('@solid-native/metro/solid-babel.cjs');

const preset = require.resolve('expo/internal/babel-preset');

module.exports = {
  presets: [preset],
  overrides: [{ test: isSolidFile, presets: [[preset, { enableReactFastRefresh: false }]] }],
};
```

`withSolidNative(config, options)` does four things to Expo's config:

- Sets `config.transformer.babelTransformerPath` to its transformer, which compiles Solid JSX for
  native before Expo's Babel pass.
- Adds `tsx`, `jsx` and `css` to `config.resolver.sourceExts` (removing `css` from `assetExts`),
  and resolves `solid-js`, `solid-js/store` and `solid-js/universal` to their production client
  builds from the app's `solid-js`, in every mode and condition. Importing `solid-js/web` (the DOM
  renderer) on native is an error.
- Wraps Expo's transform worker (`config.transformerPath`), which would otherwise empty every
  `.native.css` import. A custom transform worker is left alone.
- Adds a compiler fingerprint to `config.transformer.cacheVersion`: the package's `solid-*.cjs` and
  CSS compiler sources, the versions of `@babel/core`, `babel-preset-solid`,
  `@babel/plugin-transform-typescript` and `lightningcss`, the app's `solid-js` version, and the
  installed `react-native-worklets` and `react-native-reanimated` versions. Metro loads the
  transformer once at startup, so restart the dev server after changing any of them.

Options:

- **`projectRoot`** overrides where the app's `solid-js` is resolved from. Defaults to
  `config.projectRoot`.
- **`workspaceRoot`**, in a monorepo where the framework packages live outside the app's
  `node_modules`, adds the workspace root to `watchFolders` so Metro can see workspace sources.

Expo always enables React Refresh in development; the `babel.config.js` above turns it off for
files matched by `isSolidFile` only. `expo/internal/babel-preset` re-exports `babel-preset-expo`,
so no extra dependency is needed.

## What counts as a Solid file

The transformer compiles a `.tsx` or `.jsx` file as native Solid when either:

- its name ends in `.solid.tsx` or `.solid.jsx`, or
- its leading comments contain `@jsxImportSource @solid-native/platform/solid`.

Only leading comments count, and `node_modules` is never compiled this way. A match goes through
`babel-preset-solid` with `generate: 'universal'` and `moduleName: '@solid-native/platform/solid'`,
stripping TypeScript in the same pass with source positions intact. Other files stay Expo's.

A `.solid.ts` or `.solid.js` file is not compiled by Solid but opts into the clean reload (below).

A `.dom.tsx` file, or one whose leading comment says `@jsxImportSource solid-js`, is a Solid DOM
page compiled with `generate: 'dom'` for a browser or an Expo DOM component. See
[Web](/packages/web).

## Native stylesheets

A `.native.css` import compiles to the stylesheet data the engine reads:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { View } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './card.native.css';

export function Card() {
  return withNativeStyles(sheet, () => <View class="card" />);
}
```

It compiles with lightningcss for the bundled platform; anything native cannot express is dropped
with a build warning (see [what CSS reaches a device](/packages/fabric/supported-css)), and
unparseable CSS fails the build. A `url()` font source becomes a `require()`, so Metro bundles the
font.

Plain `.css` and CSS modules stay Expo's (empty on native). A web build compiles the same file for
the browser via `solidNativeWeb()`. Declare the module type once, as the template's
`src/native-styles.d.ts` does.

## Reload in development

Native Solid has no state-preserving hot replacement. In development every Solid file, JSX and
`.solid.ts` alike, gets a guard ahead of its imports, so new code never runs in a dying VM. On an
edit, the guard disposes every native root and reloads the JS VM; the app restarts from its entry
and component and signal state reset. Once a reload is pending, creating a native root throws; if
the reload fails, the error says to reload manually.

This needs Metro's module wrapping: with `unstable_disableModuleWrapping` or an optimized
development build, `withSolidNative` and the worker throw rather than silently skip edits. Release
builds carry no guard.
