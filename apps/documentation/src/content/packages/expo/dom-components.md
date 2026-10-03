---
title: DOM components
summary: A Solid component rendered by a browser, in a web view, inside a native screen - with its inputs and outputs bound from native.
---

# DOM components

A DOM component is a Solid component rendered to the DOM by a browser engine, in a web view inside
a native screen. You pass its inputs and output handlers as props from native, and the values cross
between the two.

Use it for what only exists on the web: a `<canvas>` signature pad, a charting or rich-text
library, a Markdown or HTML renderer, a component from an existing Solid web app. Not for anything
native does well: each one is a whole browser view running its own JavaScript, so it suits one
editor or chart on a screen, not list rows.

It is not the Web Components standard (no custom elements or shadow DOM; the name is Expo's), and
it is the deliberate exception to solid-native's real native views. It is the Solid version of
Expo's React [DOM components](https://docs.expo.dev/guides/dom-components/), on the same machinery:
Expo's web view, the `'use dom'` directive, Expo's dev server route and release export. Both can
live in one app.

## Setup

The web view, `@expo/dom-webview`, comes with `expo`. The component needs Solid's DOM runtime
(`solid-js/web`, part of `solid-js`) and `@solidnative/web`:

```sh
npx expo install solid-js @solidnative/web
```

## Writing one

A DOM component is its own file, compiled for the browser: it ends in `.dom.tsx` or starts with the
`@jsxImportSource solid-js` pragma. Its first statement is `'use dom'`, and its default export is
`mountInWebView(...)` from `@solidnative/web/solid/web-view` - the import that marks it as Solid's
rather than an Expo React DOM component:

```tsx
// web/signature.dom.tsx
/** @jsxImportSource solid-js */
'use dom';
import { mountInWebView } from '@solidnative/web/solid/web-view';

interface SignatureProps {
  name?: string;
  onStrokes?: (count: number) => void;
}

export function Signature(props: SignatureProps) {
  let pad!: HTMLCanvasElement;
  let count = 0;
  // ...drawing code, as in any web app
  return (
    <div>
      <canvas ref={pad} onPointerUp={() => props.onStrokes?.(++count)} />
      <p>Sign as {props.name}</p>
    </div>
  );
}

export default mountInWebView(Signature, {
  inputs: { name: '' },
  outputs: { strokes: 'onStrokes' },
});
```

The file is ordinary browser Solid, and its CSS is real CSS (a `<style>` element or a class), so
`resize`, `grid` or `touch-action` work. It mounts into its own `solid-native-web-root` element, the
body has no margin, and whatever is behind the web view shows through unpainted areas.

`mountInWebView(component, options?)` takes:

- **`inputs`** - default values for the component's props, used until native sends its own.
- **`outputs`** - native output name to callback prop name, e.g. `{ strokes: 'onStrokes' }`.
  Calling `props.onStrokes(value)` in the page emits `strokes` to the native side.
- **`host`** - an element to mount into instead of the default root.

## Using one

Import the file from native code and hand it to `DomComponent` as `src`:

```tsx
import { createSignal } from 'solid-js';
import { Text, View } from '@solidnative/components/solid';
import { DomComponent } from '@solidnative/expo/solid/dom-component';
import signature from './web/signature.dom.tsx';

export function Sign() {
  const [name] = createSignal('Ada Lovelace');
  const [strokes, setStrokes] = createSignal(0);

  return (
    <View class="flex-1 p-4">
      <DomComponent
        class="h-60"
        src={signature}
        inputs={{ name: name() }}
        outputs={{ strokes: (count: number) => setStrokes(count) }}
      />
      <Text>{strokes()} strokes</Text>
    </View>
  );
}
```

In native code the build replaces the file with a reference to its page, so no web code or its
imports reach the native bundle. Importing `@solidnative/expo/solid/dom-component` registers the
native view.

Size `DomComponent` like any native view - a height, or `flex-1` in a sized container; it does not
grow to fit the page. Besides `src`, `inputs`, `outputs` and the usual view props it takes:

- **`foreground`** - an accessor; while it reads `false` no inputs are sent to the page. Pass the
  screen's `SCREEN_IN_FRONT` from `@solidnative/device/solid`.
- **`onError`** - receives errors from the page instead of throwing them.
- **`webviewDebuggingEnabled`** - defaults to on in development builds.

## Inputs

`inputs` sets the component's props by name. Initial values ship with the page, so the first render
has them. A change is merged into the running component's props without a reload, so state survives
(a half-drawn signature stays drawn); during loading it is held until the page is ready.

## Outputs

`outputs` maps the page's outputs, by their `mountInWebView` names, to native handlers called with
each emitted value. A handler for an undeclared output is an error listing the page's outputs,
checked when the page is ready.

Two-way binding is an input plus an output that reports the new value:

```tsx
<DomComponent src={editor} inputs={{ text: draft() }} outputs={{ textChange: setDraft }} />
```

## What can cross

The page is a separate JavaScript runtime, so values cross as JSON. Strings, numbers, booleans,
`null`, arrays and plain objects arrive intact; a `Date` becomes its ISO string, `undefined`
properties are dropped, and class instances lose their methods. Functions, signals, stores and
services cannot cross, and the page cannot reach the app's services.

## Errors and debugging

A render error, uncaught error or unhandled rejection in the page is posted to native, prefixed with
its file, and goes to `onError` if set; otherwise it is thrown (terminal and red screen in
development).

In a development build the web view is inspectable: Safari, **Develop**, the simulator or device,
then the page, for DOM, console and debugger; `chrome://inspect` on Android. Edits show up the next
time the screen opens; there is no hot reload inside the web view.

## How it ships

- **Development:** Expo's dev server serves the page from its DOM-component route
  (`/_expo/@dom/...`), built by the app's Metro for web.
- **Release:** `expo export:embed` finds every imported web component and writes each page into the
  app (`www.bundle` on iOS, the assets folder on Android), loaded with no server.
- **`eas update`:** pages go, and are looked up, where Expo puts DOM components' pages. Untested.

`@solidnative/metro`'s Solid transformer does both halves: imported from native, a `'use dom'` file
becomes a page reference carrying the marker Expo's `'use dom'` plugin records (how the export finds
it); built for web, it is compiled with Solid's DOM compiler and mounts itself. A DOM-compiled file
imported from native outside a `'use dom'` page is a build error.

## Limits

- **Only JSON crosses.** No shared services, signals or state; see [What can cross](#what-can-cross).
- **One browser view per instance, one component per page.** Tens of megabytes, a few hundred
  milliseconds to start: a centerpiece, not a list.
- **No children.** Native content cannot be projected into a DOM component.
- **Sized from outside.** The web view does not size itself to its content.
- **Checked on iOS.** Android uses the same Expo web view and the same pages, but has not been run.

## Reference

`mountInWebView(component, options?)` (from `@solidnative/web/solid/web-view`) mounts the component
and returns the reference the file exports. `DomComponent` is exported from
`@solidnative/expo/solid/dom-component`; a test replaces the page URL and web view functions with
`provideService(DomComponent.SOURCE, () => fake)` in a `ServiceScope`.

<!-- api: DomComponent -->
