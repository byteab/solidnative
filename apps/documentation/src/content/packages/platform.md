---
title: Platform
summary: The seam that mounts a Solid app onto a native screen, not a DOM.
---

# Platform

`@solid-native/platform/solid` is the renderer module for Solid's universal JSX transform: the
`createElement`/`insert`/`setProp` functions the compiler calls, a host adapter that applies them to
[`@solid-native/fabric`](/packages/fabric)'s Solid-free retained tree, and
`createNativeRoot()`/`mountNative()` in place of DOM `render()`. It also exports Solid's control
flow (`For`, `Show`, `Index`, `Switch`, `Match`, `ErrorBoundary`, `Suspense`, `SuspenseList`),
`Defer` (mounts children a frame after the first commit) and `withNativeStyles` (attaches a
compiled `.native.css` sheet). Every component file names it as its JSX source:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
```

Call the root functions once, in your entry file. The root's `engine` carries commit stats and is
what [`@solid-native/device`](/packages/device)'s `watchConditions(engine)` re-resolves media
queries against.

## The smallest app

```ts
// src/main.solid.ts
import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { mountNative } from '@solid-native/platform/solid';
import { getFabricUIManager, registerPlatformComponents } from '@solid-native/fabric';
import { App } from './app/app.solid.tsx';

registerPlatformComponents(Platform.OS);

AppRegistry.registerRunnable('main', ({ rootTag }: { rootTag: number | string }) => {
  mountNative(App, {
    fabric: getFabricUIManager(),
    rootTag: Number(rootTag),
    engineOptions: {
      processColor,
      resolveAssetSource: (value) => Image.resolveAssetSource(value as never),
    },
  });
});
```

`mountNative(code, options)` is `createNativeRoot(options)` then `root.render(code)`. It takes a
`FabricUIManager` (`getFabricUIManager()` reads `global.nativeFabricUIManager`, present only with
the New Architecture, inside an `AppRegistry` runnable), the runnable's root tag, and
`engineOptions` (color conversion, assets, media `conditions`, device `tokens`, `globalStyles`).
The starter template uses `createNativeRoot` so `watchConditions` runs inside `root.render`.

The `.solid.ts` suffix gives the entry Metro's clean reload in development (roots disposed, JS VM
reloaded) instead of React Refresh.

## How this differs from rendering on the web

There is no `render(() => <App />, document.getElementById('root'))` and no HTML document. Solid
mounts into `engine.root`, a plain object standing in for `Element`, which becomes native views at
the first commit. Metro refuses to resolve `solid-js/web` on iOS and Android. Reactivity is
unchanged: a signal read in JSX updates the one native prop that depends on it.

[Bootstrapping](/packages/platform/bootstrapping) covers the root's options and lifetime;
[the renderer](/packages/platform/renderer) covers compiled JSX and commit scheduling.

## HTTP requests

This package has no HTTP client; use React Native's `fetch` or `XMLHttpRequest`. Its `fetch` is
`whatwg-fetch` over XHR: `response.json()` and `response.text()` work, but `response.body` is
`null` (no stream). `XMLHttpRequest` is native and complete, upload progress included.
