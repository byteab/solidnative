# solid-native

**Solid apps, rendered as real native iOS and Android views.**

solid-native renders SolidJS components straight onto React Native's Fabric renderer, so a `<View>` is
a `UIView` on iOS and an `android.view.View` on Android, and React is never in the render path. You
write Solid components, signals and stores, then create, run, reload and ship the app with Expo.

It is a migration of [ng-native](https://github.com/ng-native/ng-native), which did the same for
Angular, to SolidJS. See [where it came from](#from-ng-native).

> [!WARNING]
> solid-native is an experiment, built to explore running Solid on React Native's architecture. It
> is not production ready: expect gaps, rough edges and breaking changes.

```sh
npx create-expo-app@latest my-app --template @solidnative/template
cd my-app && npx expo start
```

Scan the QR code with Expo Go, or press `i` or `a` for a simulator. To run the
[examples](examples) instead, clone this repo, then `pnpm install` and `pnpm --filter canary start`.

## A component

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
        <Pressable accessibilityRole="button" class="button" onPress={() => setCount(count() + 1)}>
          <Text class="label">Tapped {count()} times</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  ));
}
```

```css
/* app.native.css */
.screen {
  flex: 1;
}
.body {
  flex: 1;
  justify-content: center;
  gap: 12px;
  padding: 24px;
}
.title {
  font-size: 28px;
  font-weight: 700;
}
.button {
  padding: 14px;
  border-radius: 10px;
  background-color: #3b6ef5;
  align-items: center;
}
.label {
  color: white;
  font-weight: 600;
}
```

Elements are native components imported like any other. Solid's JSX compiles at build time, and
the `.native.css` sheet compiles to native style data at build time, scoped to the component that
applies it.

## How it works

React Native's renderer is not tied to React. Fabric exposes a mutation API over JSI, and React's
reconciler is just one client of it. Solid is another:

```
Solid component    JSX compiled at build time by babel-preset-solid (universal mode)
      ↓            createElement, insertNode, setProp, ...
platform           Solid's universal renderer, native root, commit scheduler, scoped sheets
      ↓
fabric (engine)    retained tree, clone-on-write commit, events, CSS runtime
      ↓            global.nativeFabricUIManager
Fabric / Yoga / iOS and Android views
```

Solid has no virtual DOM, so a signal write updates exactly the native props that depend on it.
Writes in one synchronous run coalesce into a single Fabric commit. `react-native` and `expo` are
unmodified dependencies: nothing is forked. [ARCHITECTURE.md](ARCHITECTURE.md) has the rules.

## Expo and the React Native ecosystem

solid-native keeps React Native's architecture and swaps only React for Solid. Everything below the
renderer is unchanged, so the native side of the ecosystem still works:

- **Expo tooling.** `create-expo-app`, `npx expo start`, Expo Go, development builds, config
  plugins, prebuild, EAS Build, EAS Update and EAS Submit work as they do for a React app.
- **Expo modules and native libraries.** Expo SDK modules, TurboModules and Fabric native
  components are plain native code, so they can be called or rendered from Solid.
- **What doesn't carry over.** A library whose public API is React components or hooks needs a thin
  Solid wrapper around its native part, the way `@solidnative/expo` and `@solidnative/router`
  wrap Expo modules and `react-native-screens`.

## Features

- **Native rendering.** Solid's universal renderer drives a retained tree that commits only what
  changed to Fabric, with native text, images, scroll views, virtual and section lists, text
  inputs, switches, modals and gestures.
- **CSS and Tailwind.** Scoped `.native.css` sheets, CSS variables, media queries, dark mode,
  transitions and `@keyframes`, plus a Tailwind preset with `ios:` and `android:` variants.
- **Native navigation.** Native stacks, tabs, headers, modals and sheets over
  `react-native-screens`, with guards, lazy routes and deep links.
- **Forms.** Typed forms with validation, bound to native controls.
- **Expo modules as services.** Camera, location, notifications, secure storage, the file system,
  SQLite, biometrics, maps, haptics and more, each a scoped Solid service.
- **Animation.** CSS transitions and keyframes, `Animated` and Reanimated worklets.
- **Testing.** A Testing Library API that runs components in Node against a fake Fabric, with no
  simulator.
- **Fits existing workspaces.** An Nx plugin (`nx add @solidnative/nx`) adds an app to any Nx
  workspace.
- **The web too.** `@solidnative/web` renders the same components to the DOM.

## Documentation

- [Getting started](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/guide/getting-started.md)
- [Adding it to an existing app](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/guide/manual-setup.md)
- [Theming and Tailwind](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/guide/theming.md)
- [Build a form](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/guide/forms.md)
- [Deployment](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/guide/deployment.md)
- [How it compares](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/guide/comparison.md)
- [Known limitations](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/guide/limitations.md)
- [Architecture](ARCHITECTURE.md) and [design decisions](docs/decisions.md)
- [Performance](docs/performance.md)

The [examples](examples) are complete apps: a bank (`wallet`), a habit tracker (`habits`), a music
player (`music`), a run tracker with maps (`runs`), a notes app (`notes`) and a social app with
platform-native controls (`flock`). The `canary` is the
showcase and regression app every release is checked against.

## Packages

| Package                   | What it provides                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `@solidnative/platform`   | The Solid universal renderer, `mountNative()` and the native commit scheduler.        |
| `@solidnative/components` | The elements: views, text, images, lists, inputs, pressables, gestures, animation.    |
| `@solidnative/router`     | Native stack and tab navigation over `react-native-screens`.                          |
| `@solidnative/device`     | Keyboard, screen, color scheme, app state, accessibility, deep links and more.        |
| `@solidnative/expo`       | Expo's modules as Solid services, and Expo's native views as elements.                |
| `@solidnative/icons`      | `Icon` with `lucide-static` (or any SVG strings), drawn as native SVG.                |
| `@solidnative/metro`      | The Metro preset: the Solid transform, the CSS compiler and clean development reload. |
| `@solidnative/tailwind`   | The Tailwind preset and its platform variants.                                        |
| `@solidnative/testing`    | Testing Library for solid-native Solid components, running in Node.                   |
| `@solidnative/web`        | A DOM host for the same components, with a Vite preset.                               |
| `@solidnative/nx`         | `nx add` and an app generator for Nx workspaces.                                      |
| `@solidnative/fabric`     | The framework-agnostic retained tree and commit engine the renderer is built on.      |

## Requirements

Solid 1.9, Expo SDK 57 and React Native 0.86 with the New Architecture, on Node 22.18 or later.

## Performance

On the js-framework-benchmark operations (1000 rows, Release, Hermes), measured against React
Native's own renderer on the same screen:

| phase, total ms | iOS React | iOS Solid | Android React | Android Solid |
| --------------- | --------- | --------- | ------------- | ------------- |
| mount           | 61.4      | 64.3      | 72.8          | 75.3          |
| append          | 75.1      | 69.1      | 68.2          | 59.0          |
| update10th      | 19.5      | 6.9       | 14.1          | 6.3           |
| select          | 17.8      | 6.9       | 17.8          | 4.5           |
| clear           | 7.0       | 12.0      | 5.5           | 8.0           |

Updates run in about a third of React's time; creating and disposing large lists is close to it.
The numbers, what made them and what was tried and dropped are in
[docs/performance.md](docs/performance.md).

## From ng-native

solid-native began as a fork of [ng-native](https://github.com/ng-native/ng-native) by
[Ashley Hunter](https://github.com/ashley-hunter), which rendered Angular components as native
views, and is its migration to SolidJS. ng-native's framework-agnostic Fabric engine, CSS runtime,
native components and tooling are kept; the Angular layer on top was replaced:

| ng-native (Angular)                 | solid-native (Solid)                                    |
| ----------------------------------- | ------------------------------------------------------- |
| Angular renderer and AOT compiler   | Solid's universal renderer, JSX compiled in Metro       |
| change detection                    | fine-grained signals and stores                         |
| component `styles` metadata         | `.native.css` sheets applied with `withNativeStyles`    |
| dependency injection                | `useService` / `ServiceScope`                           |
| `@defer`, `HttpClient`, `$localize` | `lazy` + `Suspense`, `fetch`, message catalogs + `Intl` |
| `ng add` / `ng generate`            | `create-expo-app --template`, `nx add @solidnative/nx`  |
| `@ng-native/*`, `@ng-icons/*`       | `@solidnative/*`, `lucide-static`                       |

Every capability was ported with its tests before the Angular code was removed. The reasoning
behind each choice is in [docs/decisions.md](docs/decisions.md).

## Status

solid-native is an experiment for exploration, not a production-ready framework, and APIs can change
between `0.x` releases. The
[known limitations](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/guide/limitations.md) list every gap with its workaround.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setting up the workspace, running the tests and what a
pull request needs. Report a vulnerability privately, as [SECURITY.md](SECURITY.md) describes.
Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)

solid-native is an independent open-source project. It is not affiliated with or endorsed by the
SolidJS team, Meta or Expo.
