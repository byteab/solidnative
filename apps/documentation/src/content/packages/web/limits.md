---
title: What does not carry over
summary: The router, animation backends and gesture handling have no browser build.
---

# What does not carry over

`@solidnative/router/solid` is `react-native-screens` throughout and has no browser build:
`NativeStackOutlet`, `NativeTabsOutlet` and `NativeHeader` render native screen containers. A routed
web build needs its own web router over Solid DOM pages, with shared screens in islands.

Reanimated worklets and `react-native-gesture-handler` are native-only:
`@solidnative/components/solid/reanimated` and `@solidnative/components/solid/gestures` import
packages a browser can't load, so the build fails. `solidNativeWeb()` rejects a `react-native`
import outright with `Unsupported runtime import in a Solid browser build`, naming it. Keep all of
these out of what a web build imports.

`@solidnative/components/solid/animations` builds on React Native's `Animated`, and Solid has no
browser animation backend yet. `AnimatedStyle`, `WorkletStyle`, `WorkletScroll` and
`NativeGesture` from `@solidnative/components/solid` take a backend argument, and only native
backends exist. Animate shared components with CSS `transition` and `@keyframes`.

Device services need a browser source; one without throws
`This device service needs a browser source override` on first use. The seven services an island
provides (see [Islands](/packages/web/islands)) have browser sources; for others, add one with
`provideService` in the island's `services`.

Everything else runs the same code: popovers, dialogs and toasts use the host's `measure()` and
`dispatchCommand()`, which `BrowserEngine` answers like Fabric.

## Sharing screens between native and web

Keep native-only imports out of modules a web build reaches. Unlike Metro, Rollup/Vite fails the
build when a screen statically imports something native-only (`@solidnative/router/solid`,
`react-native-svg`, an `expo-*` module): a module graph can't have an unresolvable edge, dynamic
import or not. A runtime `.catch()` on a lazy loader can't fix a build that already failed; use
browser-compatible dependencies or separate native and web route configs. A `.catch()` is still
worth adding for chunks that built but fail to load at runtime (a flaky connection).

## The build

A browser build is Vite with `solidNativeWeb()` from `@solidnative/web/solid/vite`, as
[Web](/packages/web) describes:

- **No React Native runtime is loaded.** Importing `react-native` is an error.
- **`solid-js` resolves to the app's own copy.** The plugin maps `solid-js` and subpaths to the
  app's browser build and excludes `@solidnative/*` and `solid-js` from Vite's pre-bundling, so the
  plugin compiles them.
- **A Solid file edit reloads the page.** Editing a `.solid.tsx`, `.solid.ts` or `.native.css`
  file disposes every root and listener with a full reload; no hot replacement.
- **Vite does not type-check.** Run `tsc` with your own `tsconfig.json` for that.
