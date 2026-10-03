# Decisions

solid-native is a migration of [ng-native](https://github.com/ng-native/ng-native), which rendered
Angular components as native views, to SolidJS. These are the choices made along the way and why.
The rules that follow from them are in [ARCHITECTURE.md](../ARCHITECTURE.md).

## Keep the engine, replace the framework

ng-native's Fabric engine (retained tree, clone-on-write commit, events, CSS runtime) was already
framework-agnostic, so it was kept as is. Solid drives it through the same host boundary
(`packages/fabric/src/host.ts`) that the browser host implements. Only the layer above it changed:
Angular's renderer and compiler were replaced by Solid's universal renderer
(`solid-js/universal`) in `@solid-native/platform`. Every capability was ported with its tests
before the Angular code was deleted, and the 95% coverage floor was kept.

## Solid's universal renderer, not `solid-js/web`

Solid compiles JSX to direct `createElement`/`insertNode`/`setProp` calls, with no virtual DOM.
That maps onto the engine's mutation API one to one. `solid-js/web` and React reconciliation are
never in a native bundle; React stays installed only because React Native and Expo need it.

## Compile at build time, opt in per file

Hermes has no runtime compiler, so JSX and `.native.css` compile in Metro. A file is Solid when
its name ends in `.solid.tsx` or it carries the `@jsxImportSource @solid-native/platform/solid`
pragma; everything else, React Native's own sources included, keeps Expo's transform.

## One commit per reactive run

Synchronous signal writes coalesce into one commit on the next microtask, and a run that changed
nothing reaches no `completeRoot`. The first mount commits synchronously; animations commit from
their own frame callback.

## Styles are explicit and scoped

Angular attached component styles through compiler metadata. Solid has none, so a component
applies its sheet with `withNativeStyles(sheet, ...)`, scoped through Solid's owner context to the
nodes it creates. Tailwind and app-wide rules are the root's global sheet.

## Services instead of dependency injection

Angular's DI became `useService`/`ServiceScope` in `@solid-native/device`: device APIs and Expo
modules are scoped Solid services, created lazily and disposed with their owner.

## Clean reload, not hot reload

Expo's React Refresh cannot preserve Solid state, so it is off for Solid files. An edit to a
Solid component, sheet or `.solid.ts` helper disposes the native roots and reloads the JS VM. No
state survives; nothing pretends to.

## Retired, not ported

These only adapted Angular features: `provideNativeHttpClient` (use `fetch`), `$localize` (typed
message catalogs and `Intl`), the `Date.parse` shim, `@defer` (use `lazy`, `Suspense`, `Show`),
the Angular CLI schematics (use `create-expo-app --template @solid-native/template` or
`nx add @solid-native/nx`) and the `@ng-icons/*` sets (now `lucide-static` or any SVG string).

## The name

Everything Angular-derived was renamed: packages moved to the `@solid-native/*` scope (the
unscoped `solid-native` npm name is taken), diagnostics read `[solid-native]` and bundle ids
`dev.solidnative.*`. The documentation site was rewritten as a Solid DOM app.

## Two bugs the migration surfaced

- **Fabric's event handler.** Fabric holds one, and React Native's `ReactFabric` claims it whenever
  its module loads, which can be late. The Solid root loads that module first, so its own claim is
  always last.
- **Duplicate `solid-js`.** Two copies split the reactive graph silently. Metro resolves
  `solid-js` from the app, once.

## Performance

The target was React Native's own renderer on the same benchmark. Solid with signals now mounts
within a few percent of React and updates in about a third of its time. The biggest single win
was lowering `<View>`/`<Text>` to intrinsics at build time. A C++ commit path was measured and not
built: it could save at most 3-7% of a mount. See [performance.md](performance.md).

## Non-goals

No webview, no fork of React Native or Expo, no running third-party React components (their
hooks need React's dispatcher; native views and TurboModules they wrap are reachable directly), no
SSR or DOM emulation.
