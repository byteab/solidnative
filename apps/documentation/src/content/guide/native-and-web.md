---
title: Native and web
summary: One set of components for native and the browser, through a shared renderer seam, and what differs on the web.
---

# Native and web

The same Solid components run on native and in browsers through a shared renderer interface. Every
example on this site is a real `@solid-native/components/solid` component on the browser host, not
a screenshot or a React port. Each control has one implementation:
`packages/components/src/solid/switch.ts`, for example, serves both hosts.

## The seam

`HostEngine` and `HostNode` in `@solid-native/fabric` define only the renderer calls components
use. Depending on Fabric's `Engine` (whose constructor needs a `FabricUIManager`) or `EngineNode`
would tie components to native, and casting a browser object `as unknown as Engine` would bypass
type checking.

Fabric's `Engine` implements `HostEngine` and `EngineNode` extends `HostNode`; `BrowserEngine`
implements both over the DOM without casts, leaving the native path unchanged. Components reach
their host through `useHostAdapter()` from `@solid-native/platform/solid`.

## Mounting on the web

The browser host is `@solid-native/web/solid`. Its Vite plugin, `solidNativeWeb()` from
`@solid-native/web/solid/vite`, compiles the universal components and resolves every
`@solid-native/platform/solid` import to `@solid-native/web/solid`:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { solidNativeWeb } from '@solid-native/web/solid/vite';

export default defineConfig({ plugins: [solidNativeWeb()] });
```

```ts
import { mount } from '@solid-native/web/solid';
import { App } from './app/app.solid.tsx';

const app = mount(document.getElementById('app-root')!, App);
```

Browser `mount` takes a target `Element` where `createNativeRoot` takes React Native's numeric root
tag; otherwise they match. `inputs` become the component's props, and `app.setInputs()` updates them
in place.

The browser needs no `FabricUIManager`, `processColor` or device tokens. It provides `HostEngine`,
not `Engine`, so `WorkletStyle`, `WorkletScroll` and `NativeGesture` throw
`Worklets and native gestures require a native Fabric host.` `solidNativeWeb()` fails the build on
a direct `react-native` import rather than simulate a native runtime.

## The layout reset

Browser and Yoga layout defaults differ. `flex-row` sets `flex-direction` explicitly and behaves the
same on both, but with no flex properties Yoga defaults to
`display: flex; flex-direction: column; align-items: stretch; flex-shrink: 0`, while browsers give
the unknown `<view>` element `display: inline; flex-shrink: 1`.

`@solid-native/web`'s `reset.css` aligns them through `[data-rn]`, which marks every created node;
tag selectors would miss `text-input` and `switch`, rendered as `<textarea>` and `<input>`.

`<Text>` is left out of the flex reset, since `display: flex` would stop wrapping and nested inline
`<Text>` runs. The browser uses `display: inline`, which wraps but ignores `width` and `height`;
native `Text` is a full Yoga node and accepts both. Add `class="block"` for explicit sizing on the
web.

## What does not survive the trip

`@solid-native/router/solid` renders into react-native-screens and has no web build. A browser page
uses its own router; this site uses a small History-API router.

Reanimated worklets and react-native-gesture-handler are native-only: their modules fail to load in
browsers and their bindings throw under the browser host.

Device services use browser sources where they exist: screen size, color scheme and text direction
follow the page; safe area, status bar, keyboard and hardware back are inert. A service with no
browser source throws when used.

Other controls work through the host: a self-focusing `<TextInput>` and an offset-scrolling
`<ScrollView>` use `engine.measure()` and `dispatchCommand()`, which `BrowserEngine` implements like
Fabric's `Engine`, as the site's examples exercise.

## Why the web host exists

It tests that the shared interface admits a second implementation rather than just describing
Fabric: running one component against two hosts exposes bugs either would hide alone. It is not
meant as a deployment target. It also powers this site's examples, with the same source, cascade
and press semantics as native.

In a Solid web app, `Island` from `@solid-native/web/solid` embeds these components in a
`solid-js/web` page, inheriting its services, so a mobile screen can be reused without a second
implementation; the native router and other native-only features stay on the phone. See
[Islands](/packages/web/islands).

Conversely, `DomComponent` from `@solid-native/expo/solid/dom-component` renders a browser page in a
native screen's web view, with `inputs` and `outputs` bound from the native side, for canvas,
charting libraries or editors. Its runtime is separate, so only JSON crosses. See
[DOM components](/packages/expo/dom-components).
