---
title: solid-native compared
summary: Where this sits next to React Native, NativeScript, Ionic and Flutter, and why.
---

# solid-native compared

How solid-native differs from React Native, NativeScript, Ionic and Flutter in rendering model,
language, ecosystem and styling. No benchmarks or speed claims.

## React Native

solid-native keeps React Native's Fabric renderer and Expo and replaces React, hooks and the
reconciler with SolidJS. Compiled JSX calls `@solid-native/platform/solid`, which builds
`@solid-native/fabric`'s retained tree and commits like `ReactFabric` (see
[Architecture](/guide/architecture)); both `<View>`s become identical `UIView`s.

`@solid-native/expo` wraps Expo modules as Solid services, resolved with `useService`, and
`registerExpoView(elementName, moduleName)` registers any Expo module's native view (see
[Using a module](/packages/expo/using-a-module)). Expo's native code runs unchanged.

Both write JSX, with different semantics. A Solid component runs once: `createSignal` and
`createMemo` replace `useState` and `useMemo`, and only the props and text that read a signal
update, with no re-render and no dependency arrays. Context-style sharing uses `ServiceScope` and
`useService` from `@solid-native/device/solid`. See [Bootstrapping](/packages/platform/bootstrapping)
for mounting a root.

## NativeScript

NativeScript generates synchronous JavaScript bindings for 100% of platform APIs at compile time,
including marshalling of all data types ([NativeScript iOS Marshalling
docs](https://docs.nativescript.org/guide/ios-marshalling)), and calls Objective-C and Java directly
without per-API wrappers. solid-native reuses the RN/Expo module ecosystem instead, so an arbitrary
native SDK still needs a facade, as each `@solid-native/expo` module is.

NativeScript integrates with Angular, Vue, Svelte, React and Solid, and its CSS engine emulates
text-property inheritance like [CSS on native](/packages/fabric/css-engine). It targets iOS, Android
and visionOS, with no browser counterpart to [`@solid-native/web`](/packages/web).

## Ionic and Capacitor

A Capacitor app runs in the platform's WebView (`WKWebView`, `android.webkit.WebView`), with native
plugin methods exposed on `window.Capacitor` through a JavaScript bridge
([How Capacitor works](https://ionic.io/blog/how-capacitor-works-2)). `ion-button` and `ion-list`
are web components rendered as DOM and styled with CSS and shadow DOM. Solid knowledge carries over;
browser CSS and DOM calls do not, since solid-native's `<View>` and `<Text>` are `UIView`s and
Android `View`s (see [Architecture](/guide/architecture)).

Ionic is closest to `@solid-native/web`, which also runs in a browser by URL. But where Capacitor's
UI always runs in a WebView, `BrowserEngine` implements the same interface as Fabric (see
[Native and web](/guide/native-and-web)): a component rendered as DOM here is a `UIView` on a
device.

## Flutter

Flutter skips system widgets and paints its own onto a surface through Skia or Impeller (the default
on iOS and Android API 29+ from release 3.27, [Impeller docs](https://docs.flutter.dev/perf/impeller)),
creating no `UIView`s or Android `View`s. That gives pixel-identical rendering with its own animation
and layout systems, but Flutter must reimplement controls and track their look-and-feel, and
exposes accessibility through its semantics tree.

solid-native's `<Switch>` is the platform's switch with current OS styling. Flutter uses Dart,
`pub.dev` and its own build system, sharing no code or npm packages with solid-native.

## Styling

React Native has no CSS engine (NativeWind compiles Tailwind into style objects), Ionic uses DOM
CSS, and Flutter styles widgets without a cascade. solid-native compiles each `.native.css` with
lightningcss and matches, inherits and resolves at runtime in `@solid-native/fabric` (see
[CSS on native](/packages/fabric/css-engine)). `@solid-native/tailwind` uses that cascade, so
`class="flex-1 bg-blue-500 p-4"` on a `<View>` matches directly, without an interop layer.

## Maturity

solid-native is an alpha: retained tree with incremental commits, native stack and tab routing,
forms, CSS, Expo and React Native facades, and Reanimated worklet animations. Release builds
(`expo run:ios --configuration Release` / `expo run:android --variant release`) produce Hermes
bytecode with Solid's production client build and no development reload code.

Many platform facades are unit-tested and typechecked but not verified on hardware; treat it as a
working prototype. See [Known limitations](/guide/limitations).

## When to choose which

- solid-native: Solid's fine-grained signals and JSX with native views and Expo modules, and React
  never in the render path.
- React Native: a team invested in React, with the largest Fabric ecosystem.
- NativeScript: direct access to an unwrapped native SDK matters more than React Native plugin
  reuse.
- Ionic: a web app that needs installing, or a web team avoiding native build tooling.
- Flutter: pixel-identical rendering matters more than native controls, or a new team has no
  investment in web or JavaScript ecosystems.
