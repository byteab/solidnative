---
title: Known limitations
summary: What the alpha does not do yet, and the workaround for each.
---

# Known limitations

Known gaps in the alpha, with workarounds where they exist. See
[solid-native compared](/guide/comparison#maturity) for what is implemented versus verified.

## There is no DOM

`document`, `window` and DOM APIs do not exist. `solid-js/web` is not a native runtime (Metro's
resolver throws on it), so there is no `render()`, `<Portal>` or DOM events. A `ref` receives a
`NativeRef` from `@solid-native/components/solid`, for native commands, not an `HTMLElement`.
`<Image>` from the same package loads images; local assets need `resolveAssetSource` in the root's
`engineOptions`.

**Workaround:** use `@solid-native/components/solid` for elements, `useHostEngine()` from
`@solid-native/platform/solid` for imperative native work, and `@solid-native/device/solid` for what
browsers expose through `window` or `navigator`.

## Every edit is a full reload

Saving a Solid file disposes each native root and reloads the JS VM, resetting component and signal
state. Expo's React Refresh is disabled for Solid files by the `isSolidFile` override in
`babel.config.js`; `withSolidNative` alone cannot turn it off. Compiler or Metro config edits need a
Metro restart.

**Workaround:** keep state that must survive a reload in storage, such as `@solid-native/expo`'s
store, and name non-JSX helpers `.solid.ts` so their edits take the same guarded reload.

## No i18n framework

There is no message-extraction tool or translation runtime. `Locale` from
`@solid-native/expo/solid/locale` reports the device's languages and text direction; Hermes has
`Intl.NumberFormat` and `Intl.DateTimeFormat` but no `Intl.PluralRules`. See
[Localization](/guide/localization).

**Workaround:** keep messages in plain TypeScript or JSON catalogs chosen from `Locale`, and pick
plural forms in your own code.

## Solid's browser DevTools do not attach

The extension inspects browser pages, not devices. Use Hermes, React Native's debugger and the
renderer's committed tree (`root.engine`).

## No SSR or hydration

Neither native nor web supports server rendering or hydration. `createNativeRoot` targets a
device's Fabric UI manager; `@solid-native/web/solid`'s `mount()` and `mountBrowser()` need a real
`document`. For prerendered pages, build prose statically and mount live examples on the client.

## `fetch` responses have no body stream

React Native's `fetch` is `whatwg-fetch` over `XMLHttpRequest`, so `response.body` is empty on a
device.

**Workaround:** use `response.json()`, `response.text()` or `response.blob()`, or `XMLHttpRequest`
directly for upload progress.

## Errors raised outside the engine's event dispatch

Fabric holds one event handler, which `ReactFabric` claims when React Native lazily loads it. A
Solid root requires the `ReactFabric` shim before installing its own dispatcher, so the Solid claim
lands last and React's event plugins never see solid-native view events. The engine catches errors
from callback props, responder handlers and direct `Engine` listeners, passes them to
`engineOptions.onError` (or `console.error`) and keeps bubbling. Native errors are not JavaScript
errors and are not caught.

**Workaround:** pass `onError` in `engineOptions` to report handler errors. A crash report with a
native stack and no JavaScript frames points at native modules, not component code.

## Section lists have no section separators, and sticky headers trail by a frame

`<VirtualList>` supports separators (`renderSeparator`), sticky rows (`stickyIndices`) and a sticky
header. `<SectionList>` covers `SectionList` minus `SectionSeparatorComponent` and viewability
events. Sticky headers follow JavaScript scroll events, not the native animation driver, so they can
trail fast flings by a frame. `<SectionList>` row heights are given (`itemHeight`,
`sectionHeaderHeight`), as with `getItemLayout`; `<VirtualList>` can estimate and measure them.

On Android, `<RefreshControl>` becomes the scroll view's parent, as in React Native: inline layout
style moves to it, class-based layout stays on the inner scroll view.

**Workaround:** draw a section separator as part of the section's header or footer.
