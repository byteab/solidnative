---
title: Architecture
summary: How Solid's universal renderer drives React Native's Fabric renderer directly, with no React tree or reconciler.
---

# Architecture

Solid compiles JSX into calls on a renderer. `solid-js/web` implements it with
`document.createElement`; `solid-js/universal`'s `createRenderer` lets any host supply its own
`createElement`, `insertNode` and `setProperty`.

`@solid-native/platform/solid` is such a renderer: it builds a retained tree for React Native's
Fabric renderer, which turns it into `UIView`s and Android `View`s. Solid replaces React's
JavaScript and drives the same C++ renderer with no React element tree, reconciler or virtual DOM;
signals update exactly the props and text nodes that read them.

## Rendering packages and responsibilities

```
@solid-native/components  one component per native view, plus the behaviour composed into them
@solid-native/platform    the Solid universal renderer over the engine, and native roots
@solid-native/fabric      the engine: retained tree, commit, events, CSS
@solid-native/metro       build time: Solid's JSX transform for the native renderer, .native.css
```

The engine has no framework dependency: `@nx/enforce-module-boundaries` bans `solid-js`, `react`
and `react-native` imports in `@solid-native/fabric`. The host supplies what it needs, such as
`processColor` and `resolveAssetSource`, through `engineOptions`.

`@solid-native/platform/solid` holds the only Solid-aware renderer code, the counterpart of
`solid-js/web`, and re-exports Solid's control flow (`Show`, `For`, `Index`, `Switch`, `Match`,
`ErrorBoundary`, `Suspense`) bound to this renderer.

## What a commit is

`createNativeRoot` owns one **retained tree** of elements and text per Fabric surface (`rootTag`);
`root.render()` mounts a component into it once. Reactive updates set props, replace text and move
children; the root batches them and commits at most once per microtask flush (CSS animations and
transitions run on their own frame clock). Unchanged subtrees return to Fabric by reference, so
commits stay incremental and scrolling smooth.

Each commit ends with one `completeRoot` call, which diffs against the screen in C++, off the
JavaScript thread. `root.afterCommit()` runs a callback once the next commit lands, for work that
needs native handles.

## The host seam

`HostEngine` and `HostNode`, in `@solid-native/fabric`, define only the calls the shared packages
make. Fabric's `Engine` implements the former and `EngineNode` extends the latter;
`@solid-native/web`'s `BrowserEngine` implements both over the DOM without casts. Components reach
the current host through `useHostAdapter()` and `createHostElement()`, so one component file renders
on either.

`WorkletStyle`, `WorkletScroll` and `NativeGesture` need Fabric handles for Reanimated and
react-native-gesture-handler, so under the browser host they throw
`Worklets and native gestures require a native Fabric host.` instead of faking it.

## CSS

Native has no CSS engine, so solid-native brings one.

**At build time**, the Metro transformer parses a component's `.native.css` import with
lightningcss, converts values for React Native, compiles selectors into compounds and combinators,
and sorts rules by specificity then source order. The import's default export is that compiled
sheet. `withNativeStyles(sheet, render)` attaches it to elements created inside `render`, so class
names cannot leak into other components, with no registry or generated IDs. An app-wide sheet,
such as Tailwind's, goes in `engineOptions.globalStyles`. There is no runtime CSS parser:
lightningcss is a native Node addon.

**At runtime**, `packages/fabric/src/css.ts` matches rules right-to-left, so the rightmost compound
rejects most candidates immediately, and merges them. Precedence, weakest first: native defaults,
matched CSS, explicit props, inline `style`, `!important`.

React Native does not inherit text properties (a view's `color` does not reach its text children),
so the cascade emulates inheritance for `color`, `font*`, `lineHeight`, `letterSpacing`,
`textAlign`, `textTransform` and `textDecorationLine`.

## The scope rule

**If React Native can express it, CSS gets a spelling for it. If it cannot, the build drops it and
warns.**

`elevation` compiles even though it does nothing on iOS; that is React Native's own semantics.
`float` has no native equivalent, so it is dropped with a warning naming the file, line and reason.

`::before`, `::after`, grid, table layout, `position: fixed` and `position: sticky` are permanently
unsupported, and their warnings say so. A pseudo-element, for example, needs a node absent from the
JSX; declare the element in the JSX instead.

## Events

Fabric dispatches events by node tag. The engine keeps the handler table, runs React Native's
responder negotiation (capture down, bubble up, one node holding the gesture) and calls the
component's callback prop, such as `onPress`. There is no synthetic event layer.

## Reloading

In development, Metro's Solid transformer adds a reload boundary to every Solid module: an edit
disposes each native root and reloads the JS VM, resetting state. The app's `babel.config.js` keeps
React Refresh for React files and disables it for Solid ones. Release bundles have no boundary.

## Routing

`@solid-native/router/solid` handles paths, guards, resolvers and lazy loading itself, with no DOM
router underneath. A `NativeRoute[]` describes the screens, `createNativeNavigation(routes)` holds
the stack, and `<NativeStackOutlet navigation={...} />` renders each entry into a react-native-screens
`RNSScreen`, with native transitions and back gestures. Screens below the top stay mounted, keeping
scroll positions and text-field state.

Push, sheet and full-screen modal presentation is set on the navigation (`presentation` on a route
or on `push`/`present`), so every screen stays addressable by path for deep links.
