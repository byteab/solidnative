# @solidnative/platform

The Solid renderer for the rendering stack: a universal renderer that turns Solid's JSX into
mutations on `@solidnative/fabric`'s retained tree, and `mountNative()`, which mounts a Solid
component onto a React Native surface without React reconciliation.

Alpha: APIs may change before 1.0.

## Install

Most apps start from `npx create-expo-app@latest my-app --template @solidnative/template`, which
already calls `mountNative()` in its entry. Otherwise:

```sh
npm install @solidnative/platform
npm install solid-js react-native
```

## Example

```ts
// src/main.solid.ts
import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { mountNative } from '@solidnative/platform';
import { getFabricUIManager, registerPlatformComponents } from '@solidnative/fabric';
import { App } from './app.solid.tsx';

registerPlatformComponents(Platform.OS);

AppRegistry.registerRunnable('main', ({ rootTag }) => {
  mountNative(() => App({}), {
    fabric: getFabricUIManager(),
    rootTag: Number(rootTag),
    engineOptions: {
      processColor,
      resolveAssetSource: (value) => Image.resolveAssetSource(value as never),
    },
  });
});
```

## What's in the package

- `.` (also `./solid`) - `mountNative()`, `createNativeRoot()`, the renderer functions Solid's
  universal JSX transform calls, control flow (`For`, `Show`, ...), host-element helpers and
  `withNativeStyles`.
- `./solid/jsx-runtime` - the JSX types.
- `./solid/dev-reload` - the development registry Metro's clean native reload disposes roots
  through. In development a root also calms React Native's "Refreshing..." banner, so one save
  shows one banner instead of a stack of half-finished slides.

There is no HTTP helper: Solid apps call React Native's `fetch` directly, and read the body with
`response.json()`/`response.text()` as on the web.

## Docs

- [Platform](https://solid-native.com/packages/platform)
- [Root README](https://github.com/byteab/solid-native/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solid-native/blob/main/ARCHITECTURE.md)

## License

MIT
