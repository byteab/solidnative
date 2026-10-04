# solidnative

**Solid apps, rendered as real native iOS and Android views.**

solidnative renders SolidJS components straight onto React Native's Fabric renderer, so a `<View>` is
a `UIView` on iOS and an `android.view.View` on Android, and React is never in the render path. You
write Solid components, signals and stores, then create, run, reload and ship the app with Expo.

It is a migration of [ng-native](https://github.com/ng-native/ng-native), which did the same for
Angular, to SolidJS. See [where it came from](#from-ng-native).

> [!WARNING]
> solidnative is an experiment, built to explore running Solid on React Native's architecture. It
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

solidnative keeps React Native's architecture and swaps only React for Solid. Everything below the
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

- [Getting started](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/getting-started.md)
- [Adding it to an existing app](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/manual-setup.md)
- [Theming and Tailwind](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/theming.md)
- [Build a form](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/forms.md)
- [Deployment](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/deployment.md)
- [How it compares](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/comparison.md)
- [Known limitations](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/limitations.md)
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
| `@solidnative/testing`    | Testing Library for solidnative Solid components, running in Node.                    |
| `@solidnative/web`        | A DOM host for the same components, with a Vite preset.                               |
| `@solidnative/nx`         | `nx add` and an app generator for Nx workspaces.                                      |
| `@solidnative/fabric`     | The framework-agnostic retained tree and commit engine the renderer is built on.      |

## Requirements

Solid 1.9, Expo SDK 57 and React Native 0.86 with the New Architecture, on Node 22.18 or later.

## Performance

Measured against React Native's own renderer drawing the same screen, in Release builds on Hermes
(iPhone 17 Pro simulator, Android emulator). Each number is the median time in milliseconds from
the start of the step to the moment Fabric has the finished tree: JavaScript, garbage collection
and Fabric's native commit together. Launches of the two apps alternate, 12 rounds on iOS and 10
on Android. Lower is better.

**A list of 1000 rows** (the js-framework-benchmark operations):

| step                  | iOS React | iOS Solid | Android React | Android Solid |
| --------------------- | --------: | --------: | ------------: | ------------: |
| create 1000 rows      |      52.1 |      52.5 |          74.3 |          71.4 |
| replace all 1000 rows |      56.1 |      63.7 |          61.6 |          62.7 |
| update every 10th row |      19.4 |       8.4 |          17.6 |           7.8 |
| select a row          |      17.1 |       5.0 |          17.8 |           4.5 |
| change one label      |      20.5 |       5.0 |          14.6 |           5.3 |
| swap two rows         |      21.2 |       6.8 |          23.9 |          13.5 |
| remove one row        |      14.7 |       6.0 |          16.7 |           8.9 |
| append 1000 rows      |      76.7 |      67.1 |          70.8 |          56.7 |
| clear 2000 rows       |       6.1 |       4.9 |           6.0 |           6.2 |

**A page pushed and popped** (40 cards, each a pressable with an avatar, two lines of text and a
button, as navigation mounts a screen):

| step              | iOS React | iOS Solid | Android React | Android Solid |
| ----------------- | --------: | --------: | ------------: | ------------: |
| first mount       |      13.0 |      10.9 |          16.1 |          12.4 |
| pop               |       0.6 |       0.7 |           0.8 |           1.0 |
| push again        |      11.7 |      11.1 |          11.5 |           9.0 |
| pop again         |       0.7 |       1.0 |           0.8 |           0.9 |
| push a third time |       8.9 |       8.9 |          10.2 |           8.8 |

Updates take between a quarter and a little over half of React's time. A page mounts and pushes
as fast as React or faster, and pops within 0.3 ms of it. Creating and clearing a large list is
level with React; replacing every row of one is slower (7.6 ms on iOS, 1.1 ms on Android). How these were measured, what made them and what was tried
and dropped are in [docs/performance.md](docs/performance.md) and
[docs/mount-performance.md](docs/mount-performance.md).

## From ng-native

solidnative began as a fork of [ng-native](https://github.com/ng-native/ng-native) by
[Ashley Hunter](https://github.com/ashley-hunter), which rendered Angular components as native
views, and is its migration to SolidJS. ng-native's framework-agnostic Fabric engine, CSS runtime,
native components and tooling are kept; the Angular layer on top was replaced:

| ng-native (Angular)                 | solidnative (Solid)                                     |
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

solidnative is an experiment for exploration, not a production-ready framework, and APIs can change
between `0.x` releases. The
[known limitations](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/limitations.md) list every gap with its workaround.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setting up the workspace, running the tests and what a
pull request needs. Report a vulnerability privately, as [SECURITY.md](SECURITY.md) describes.
Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)

solidnative is an independent open-source project. It is not affiliated with or endorsed by the
SolidJS team, Meta or Expo.
