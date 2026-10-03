---
title: Islands
summary: solid-native components inside a Solid web page, or as separate roots on one page.
---

# Islands

An island is a universal component rendered into one element of a web page. Two kinds, differing
in ownership:

- **Inside a Solid DOM page.** Created under the page's owner, it inherits its context and services
  and is disposed with the part that rendered it.
- **A root of its own.** Mounted imperatively, sharing nothing with the page - a plain
  `mount(element, App)`.

Either way the page builds with `solidNativeWeb()` from `@solidnative/web/solid/vite` (see
[Web](/packages/web)), which compiles `@jsxImportSource solid-js` (or `.dom.tsx`) files with Solid's
DOM compiler and universal files (`@jsxImportSource @solidnative/platform/solid`, or `.solid.tsx`)
for the browser host.

## In a page: `Island`

A DOM page's JSX can't contain `View`, `Text` or `Pressable`; the DOM compiler doesn't know
`view`. `Island` is the boundary: its component renders through solid-native's browser host.

```tsx
/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';
import { Island } from '@solidnative/web/solid';
import { Wallet } from './wallet.solid.tsx';

export function AccountPage() {
  const [accountId] = createSignal('acc_42');
  return (
    <main>
      <h1>Your account</h1>
      <Island
        component={Wallet}
        inputs={{
          accountId: accountId(),
          onPaid: (amount: number) => {
            // Runs in this page, like any other handler.
          },
        }}
      />
    </main>
  );
}
```

- **`component`**: the universal component. Changing it disposes the old one and mounts the new.
- **`inputs`**: the component's props, set before first render. Changed values update props in
  place without remounting, so state survives. Callbacks such as `onPaid` are ordinary props; no
  separate outputs map.
- **`class`** goes on the island's element, a `<solid-native-island>`.
- **`services`** adds `ServiceBinding`s from `@solidnative/device/solid` for this island only;
  **`onError`** receives its errors.
- **Teardown is automatic** with its owner: a `<Show>` turning false, a route change, page disposal.

`Island` needs an active Solid owner, so render it inside a component, not at module level.

## From code: `mount()`

`Island` wraps `mount`; call `mount` directly to place an island into an element you created:

```ts
import { mount } from '@solidnative/web/solid';
import { Wallet } from './wallet.solid.tsx';

const element = document.querySelector('#wallet')!;
const island = mount(element, Wallet, { inputs: { accountId: 'acc_42' } });

island.setInputs({ accountId: 'acc_43' });
// ...later
island.destroy();
```

`mount(element, component, options)` returns a `MountResult`: `props` (live), `setInputs(partial)`,
`destroy()`, and the root's `engine`, `node`, `flush()` and `afterCommit()`. Options: `inputs`,
plus root options `services`, `onError`, `injectReset`, `island` (the smaller reset, below) and
`owner`, a Solid owner to inherit context from and be disposed with. One root per element; a second
mount into it throws.

`destroy()` removes what the island rendered but leaves your element in place. To render a function
instead of a component with props, `mountBrowser(code, element, options)` and
`createBrowserRoot(element, options)` mirror native `mountNative` and `createNativeRoot`.

## What an island shares, and what it keeps

| Shared with the page (`Island`, or `mount` with `owner`) | The island's own                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Solid context from above the island                      | The renderer and `BrowserEngine` that turn `view` into a `<div>`                             |
| Services from the nearest `ServiceScope` above it        | `Screen`, `ColorScheme`, `Direction`, `Keyboard`, `SafeArea`, `HardwareBack` and `StatusBar` |
| Disposal: it goes when its owner does                    | Anything you pass in `services`                                                              |

The seven device services on the right read the browser (window size, `prefers-color-scheme`,
document direction) or answer as a page with no keyboard inset, safe area, back button or status
bar. Each island builds its own; other service tokens resolve in the surrounding scope.

Signals the page writes update the island; island events run under the island's owner.

## Styles

Islands inject a smaller reset than full-page roots. The full one gives `html` and `body` a
height and font, right for a page solid-native owns but not one it visits; the island reset puts
the font on the island's root and leaves the host page as it was. `Island` always uses it; `mount`
does with `island: true`.

Tailwind, global stylesheets and `withNativeStyles` `.native.css` sheets all apply. The browser is
more forgiving: what native drops with a warning (e.g. `grid-template-columns`) works here, so
check stylesheets on a device.

## What cannot cross

- **No `View` in the page's own JSX.** Solid-native components need an island, where the
  universal renderer lives.
- **No native-only packages.** `@solidnative/router/solid`, worklet animation and gesture handling
  have no web build; see [What does not carry over](/packages/web/limits).
- **One component per island.** Nest freely inside, but the island's props are the component's, so
  wrap several in a small component to share a region.

## A root of its own

Without `owner`, each `mount` call builds an independent root sharing nothing with the page but the
browser device services above.

Each island is as tall as its content by default: the reset gives the root `height: 100%`, which
resolves against the containing box - full screen on native, an auto-height `<div>` here.

The reset is a `<style>` in `@layer base`; pass `injectReset: false` if your bundler already
imports `@solidnative/web/reset.css`. It targets the `[data-rn]` attribute every node carries, not
tag names, since `text-input` and `switch` commit as a real `<textarea>` and `<input>`. `text` is
excluded from the flex reset because React Native's `Text` lays out as wrapping text, not a flex
container; a `Text` needing an explicit size on the web needs `class="block"` from its caller - the
one place native and web layout can visibly diverge.
