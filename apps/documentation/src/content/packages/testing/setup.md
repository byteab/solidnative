---
title: Setup
summary: node:test with @solidnative/testing/register, Vitest with solidNative(), what the hook compiles, and what to do when a test will not load.
---

# Setup

Template apps are already set up. To add testing elsewhere:

```sh
npm install --save-dev @solidnative/testing
```

## node:test

Load the package's module hook before any test with `--import`:

```json
{
  "scripts": {
    "test": "node --import @solidnative/testing/register --test \"src/**/*.test.ts\""
  }
}
```

Node 22.18+ runs TypeScript tests directly ([Writing a test](/packages/testing/writing-a-test)). A
test rendering JSX itself is a `.test.tsx` with the `@jsxImportSource @solidnative/platform/solid`
pragma, matched by the glob. Each file registers `cleanup`, as `node:test` has no global `afterEach`:

```ts
import { afterEach } from 'node:test';
import { cleanup } from '@solidnative/testing';

afterEach(cleanup);
```

## Vitest

`solidNative()` from `@solidnative/testing/vitest` compiles what the register hook does. Keep the
default `node` environment; there is no DOM.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { solidNative } from '@solidnative/testing/vitest';

export default defineConfig({
  plugins: [solidNative()],
});
```

With `globals` enabled `cleanup` registers itself; otherwise call `afterEach(cleanup)`.

## Under the hood

The hook does what Metro does:

- **JSX.** `.solid.tsx` files, and `.tsx` files led by
  `/** @jsxImportSource @solidnative/platform/solid */`, compile to `@solidnative/platform/solid`'s
  universal renderer.
- **Native stylesheets.** `.native.css` imports become compiled stylesheet data, so
  `withNativeStyles(sheet, ...)` and `class` resolve as on a device.
- **Solid's build.** `solid-js` resolves to the client build, not the non-reactive server build.
- **Assets.** Asset requires like `require('./logo.png')` become `{ testUri: './logo.png' }`, as in
  React Native's Jest preset.
- **Native libraries.** `react-native-gesture-handler`, `react-native-reanimated` and
  `react-native-worklets` resolve to stand-ins that `gestureOf` can reach.

`__DEV__` is `true`. Only the app's own files and `@solidnative/*` packages are compiled.

Stylesheets compile for iOS, or Android with `SOLID_NATIVE_PLATFORM=android`. `render()`'s
`platform: 'android'` is process-wide once used, so Android tests get their own file.

## Troubleshooting

### "Unknown file extension .tsx"

```text
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".tsx"
```

`--import @solidnative/testing/register` is missing or after `--test`, or the file is not
`.solid.tsx` and lacks a leading `@jsxImportSource @solidnative/platform/solid` comment.

### "Service ... requires a ServiceScope."

Something rendered with no `ServiceScope` above it; wrap it in one, as
[Testing with services](/packages/testing/testing-services) shows.

### "Nothing is rendered: call render() first."

No render yet, or `cleanup`/`unmount()` already ran.

### "this process already rendered for Android"

Move Android tests to their own file; `node --test` runs each file in its own process.

### An assertion runs before the tree has changed

A signal set outside an interaction commits on a later microtask: await `settle()` or call
`flush()`. For the app's timers or promises use `findBy*` or `waitFor`
([Testing async work](/packages/testing/testing-async)). A held node's `props` are stale after an
interaction: query again.
