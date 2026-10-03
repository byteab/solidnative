# Architecture

React Native's renderer is not coupled to React. Fabric exposes a JSI-bound mutation API on
`global.nativeFabricUIManager`, and React's reconciler is one client of it. Solid is another,
through its universal renderer (`solid-js/universal`). Everything here follows from that one seam,
and `react-native` and `expo` stay unmodified dependencies: nothing is forked.

```
Solid component (JSX compiled at build time with babel-preset-solid, generate: "universal")
      ↓  createElement, insertNode, setProp, removeNode, ...
@solid-native/platform        universal renderer, native root, commit scheduler, scoped sheets
      ↓  the engine's mutation API
@solid-native/fabric          retained tree, clone-on-write commit, events, CSS runtime
      ↓  global.nativeFabricUIManager
Fabric C++ / JSI / Yoga / iOS and Android host views
```

The mismatch the engine exists to solve is that Solid mutates and Fabric is persistent. A committed
node is never edited; it is cloned with new props or children, and a changed leaf forces every
ancestor to re-clone, exactly as React's own Fabric renderer does. The engine predates the Solid
renderer and is kept as it was: `@solid-native/platform` drives it through the same
framework-independent host boundary (`packages/fabric/src/host.ts`) that `@solid-native/web`'s
DOM-backed `BrowserEngine` implements for the browser. The documentation site's architecture guide
explains the pieces; this file is the rules they have to keep.

## Non-goals

- No webview rendering, and no Capacitor, Lynx or NativeScript underneath.
- No fork of `react-native` or `expo`.
- No running third-party **React** components. Their bodies call hooks off a dispatcher that is
  null here, and two renderers cannot co-own one Fabric shadow tree. Third-party **native views**
  and **TurboModules** are reachable, and they are the reuse path: register the view's Fabric name
  and drive it directly.
- No SSR, no hydration, and no DOM emulation layer.

## Rules

Each of these is load-bearing. Breaking one does not degrade the architecture, it invalidates it.

**Everything compiles at build time.** Release bundles are Hermes bytecode, and Hermes has no
local-mode `eval()`, so nothing is compiled on the device. `@solid-native/metro` compiles an author's
Solid JSX with `babel-preset-solid` in universal mode against `@solid-native/platform/solid`, and each
`.native.css` file into the rule set the engine reads. Solid resolves to its production client
build in every mode, including Node's `worker` and `development` conditions under the tests.
`examples/canary/scripts/check-release-bundle.mjs` asserts a release bundle is Hermes bytecode with
no Solid development build, no development reload or React Refresh code, and no benchmark screen.

**Native compilation is opt-in per file.** A `.tsx`/`.jsx` file is a Solid native component when
its leading comment is `@jsxImportSource @solid-native/platform/solid` or its name ends in
`.solid.tsx`; everything else, React Native's own Flow sources included, keeps Expo's transform.
`solid-js/web` and React reconciliation are never part of a native bundle.

**At most one commit per scheduler flush.** Reactive changes made in one synchronous run coalesce
into a single flush on the next microtask, and a flush whose tree is clean does not reach
`completeRoot`: a scroll or a keystroke that changed nothing costs no native commit. The initial
mount commits synchronously, and frames that advance on their own clock - a CSS transition or
`@keyframes` animation, a JavaScript-driven `Animated` frame - commit from the frame callback,
because waiting for the next reactive change would drop the frame.

**Sheets are explicit and scoped.** A component applies its `.native.css` sheet with
`withNativeStyles(sheet, ...)`, which scopes it through Solid's owner context to the nodes that
component creates; `setNativeStyleHost` names the node the sheet treats as its host. There is no
compiler metadata and no global registration. Application-wide rules, Tailwind's among them, are
the root's global sheet.

**Development reload is clean, not hot.** In development, an edit to an opted-in component, a
`.native.css` sheet or a `.solid.ts`/`.solid.js` helper disposes every native root and reloads the
JavaScript VM (`DevSettings.reload`), through a guard Metro's Solid transform inserts before the
file's imports. Expo's React Refresh is turned off for Solid files by the per-file Babel override
in each app's `babel.config.js`. An edit to an ordinary module that opts into nothing needs a
manual reload. No state survives a reload, and no state-preserving HMR is claimed.

**The engine never imports a UI framework or React Native.** Solid-specific code lives in
`@solid-native/platform` and above. That keeps the commit logic testable in Node and leaves the browser
host (`@solid-native/web`) possible over the same engine. React Native's JavaScript is Flow, so the
host injects what the engine needs (`processColor`, for one) rather than the engine importing it.
`eslint.config.mjs` enforces this with `bannedExternalImports` on the `layer:runtime` tag, and the
rule needs Nx's project graph, so lint through `nx`, never bare `eslint`.

**The Solid root claims Fabric's event handler last.** Fabric holds one event handler and React
Native's `ReactFabric` claims it whenever its module loads, which can happen lazily. The native
root loads that shim before installing its own dispatcher, so the Solid claim always wins.

**`solid-js` resolves to exactly one copy.** Reactivity and context are module-level state, so two
copies split the reactive graph: effects stop tracking and context reads come back empty, which
looks nothing like a duplication problem. `@solid-native/metro` resolves `solid-js` from the app, once.
The same holds for every native module: `pnpm-workspace.yaml` pins them with `overrides`.

**Versions follow the Expo SDK.** React Native is pinned to the version the Expo SDK bundles, not
the newest: a newer one breaks `@expo/metro-config`. `npx expo install --check` is the authority.
