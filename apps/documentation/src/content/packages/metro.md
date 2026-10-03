---
title: Metro
summary: The Babel transformer that compiles Solid's JSX for native and turns CSS into a rule set.
---

# Metro

`@solidnative/metro` is a required Metro preset plus Babel transformer. It compiles Solid JSX to
native renderer calls (otherwise Metro compiles it as React's), turns `.native.css` imports into
the rule set [Fabric](/packages/fabric/css-engine) reads, resolves `solid-js` to its client build,
and gives Solid files a clean reload in development. Wire it once in each config file below.

## The smallest setup

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solidnative/metro/solid-config.cjs');

module.exports = withSolidNative(getDefaultConfig(__dirname));
```

```js
// babel.config.js
const { isSolidFile } = require('@solidnative/metro/solid-babel.cjs');

const preset = require.resolve('expo/internal/babel-preset');

module.exports = {
  presets: [preset],
  overrides: [{ test: isSolidFile, presets: [[preset, { enableReactFastRefresh: false }]] }],
};
```

Expo's development transform always enables React Refresh, and `withSolidNative` cannot turn it
off; the Babel override does, for Solid files only. `expo/internal/babel-preset` is Expo's
re-export of `babel-preset-expo`, so the app needs no direct dependency on it.

## What it does, roughly

`withSolidNative` runs Solid's universal JSX transform (renderer `@solidnative/platform/solid`)
on files that opt in with a leading `@jsxImportSource @solidnative/platform/solid` comment or a
`.solid.tsx`/`.solid.jsx` suffix. `.native.css` imports compile to engine stylesheet data; plain
`.css` stays Expo's. Compiler, `solid-js` and worklets/Reanimated versions join Metro's cache key,
and `solid-js/web` is refused on iOS and Android.

In development, editing a Solid file disposes every native root and reloads the JS VM, resetting
state. Non-JSX files opt in with a `.solid.ts` suffix, hence `src/main.solid.ts`. In a monorepo,
pass `{ workspaceRoot }` to add the root to `watchFolders`; `projectRoot` is the other option.

[Configuration](/packages/metro/configuration) covers `withSolidNative`'s options, how component
files and CSS are compiled, and build warnings. Tailwind has [its own setup](/packages/tailwind).
