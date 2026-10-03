---
title: Bootstrapping
summary: What createNativeRoot() takes, what the root it returns can do, and what it sets up.
---

# Bootstrapping

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

`registerRunnable`, not `registerComponent`: React Native only keeps the mount callback. The
`.solid.ts` suffix gives Metro's clean reload - see [Configuration](/packages/metro/configuration).

## Options

`createNativeRoot(options)` takes a `NativeRootOptions`:

- **`fabric`**: the Fabric UI manager, `getFabricUIManager()` on a device or a fake in a test.
- **`rootTag`**: the runnable's surface. One root per surface; a second on the same tag throws.
- **`clock`**: optional `NativeClock` (`queueMicrotask`, `requestFrame`, `cancelFrame`) for tests
  that drive frames. Defaults to the global microtask queue and `requestAnimationFrame`.
- **`engineOptions`**: passed to Fabric's `Engine`, mostly to fill gaps a browser never had:
  - **`processColor`** (React Native's) converts colors; without it they reach native raw.
  - **`resolveAssetSource`** turns a `require('./x.png')` asset id into
    `{uri, width, height, scale}`. Without it local images are blank (remote `{uri}` still works).
  - **`conditions`**: what `@media` resolves against (viewport size, color scheme, reduced
    motion). Without it every media query is false.
  - **`tokens`** seeds device custom properties (mainly hairline width) below `:root`; the app's
    own stylesheet wins on the same name.
  - **`globalStyles`**: the one stylesheet matched against every node, e.g. Tailwind output or a
    reset. See [Metro](/packages/metro) and [Tailwind](/packages/tailwind).
  - **`onError`** gets errors from listeners, commits and cleanups with a string naming the source.
    Defaults to `console.error`; none unwinds into Fabric.

`mountNative(code, options)` is `createNativeRoot(options)` then `root.render(code)`, for an entry
with nothing to set up inside the root.

## The root

`createNativeRoot` returns a `NativeRoot`:

- **`render(code)`** mounts once, running `code` under a fresh Solid owner that owns its effects,
  memos and `onCleanup`. To start over on the surface, dispose and create a new root.
- **`engine`** carries `engine.stats` (commit counts and timings); `watchConditions` uses it.
- **`flush()`** commits now instead of at the next microtask; returns whether anything was sent.
- **`afterCommit(callback)`** runs once after the next commit, under the caller's owner; returns a
  cancel function.
- **`dispose()`** runs every cleanup, destroys every node and releases the surface.

## Watching conditions

Call `watchConditions(root.engine, { sources })` inside `render` so the root owns and disposes
it. It re-resolves media queries on rotation or theme change, syncs a `dark` class on the root with
the system scheme, and re-measures text when the system text size changes. Without it, `dark:` and
responsive layout stay at mount time and grown text clips. Pass the same `sources` to
`currentConditions` and `watchConditions` so every frame reads the device the same way.

## Services

The root provides no services. Device services (`ColorScheme`, `StatusBar`) are tokens from
`@solidnative/device/solid`, resolved with `useService` under the app's own `ServiceScope` - see
[Device](/packages/device). Ordinary Solid context works across the tree (one owner).

## Telling native from the web

`nativePlatform()` from `@solidnative/fabric` returns `'ios'` or `'android'` on a device. For
styling, put `platform-${nativePlatform()}` on your outermost view and use the `ios:`/`android:`
Tailwind variants; on the web, `@solidnative/web/solid` adds `platform-web` to its root. See
[Variants](/packages/tailwind/variants).

## Development

In `__DEV__`, each root registers for Metro's clean reload: a Solid file edit disposes every root
and reloads the JS VM, resetting all state (not hot replacement); creating a root while that reload
is pending throws. See [Configuration](/packages/metro/configuration).
