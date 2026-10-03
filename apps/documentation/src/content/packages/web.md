---
title: Web
summary: Run the same Solid components in a browser through mount - previews, docs, demos.
---

# Web

`@solid-native/web` runs your app's components in a browser instead of on Fabric: previews without
a simulator, docs and marketing pages with the real component, or one codebase shared with the web.
Every interactive example on this site is mounted with `mount`. It does not ship a native app to
the web unchanged; see [What does not carry over](/packages/web/limits).

## Setting up a browser app

Browser apps build with [Vite](https://vite.dev) and `solidNativeWeb()` from
`@solid-native/web/solid/vite`, which resolves `@solid-native/platform/solid` to the DOM-backed
`@solid-native/web/solid` (`BrowserEngine`), compiles `.native.css` to scoped browser CSS, and fails
the build on a direct `react-native` import.

In an empty directory:

```sh
npm init -y
npm pkg set type=module
npm install solid-js @solid-native/components @solid-native/web @solid-native/metro
npm install --save-dev vite typescript
```

`@solid-native/metro` supplies the Solid transforms `solidNativeWeb()` shares with Metro.

`vite.config.ts`:

```ts
import { solidNativeWeb } from '@solid-native/web/solid/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [solidNativeWeb()],
});
```

As on native, a file with the `@jsxImportSource @solid-native/platform/solid` pragma or a
`.solid.tsx` suffix is a universal component. One naming `@jsxImportSource solid-js` (or a
`.dom.tsx` suffix) gets Solid's DOM transform, for plain-HTML page chrome. Editing a `.solid.tsx`
or `.native.css` file reloads the page.

`index.html`, which Vite serves as the page:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My app</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`, `src/app.solid.tsx` and `src/app.native.css`:

```ts
import { mount } from '@solid-native/web/solid';
import { App } from './app.solid.tsx';

mount(document.getElementById('root')!, App);
```

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, Text, View } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './app.native.css';

export function App() {
  const [count, setCount] = createSignal(0);
  return withNativeStyles(sheet, () => (
    <View class="card">
      <Text>Hello from solid-native</Text>
      <Pressable accessibilityRole="button" onPress={() => setCount(count() + 1)}>
        <Text>Pressed {count()} times</Text>
      </Pressable>
    </View>
  ));
}
```

```css
.card {
  margin: 24px;
  padding: 16px;
  gap: 12px;
  border-radius: 12px;
  background-color: rgb(238, 242, 255);
}
```

`npx vite` serves it, `npx vite build` writes `dist`, and `npx vite preview` serves that build.

Vite does not type-check. For `tsc` and editors, this `tsconfig.json` checks the app with the
packages' source; component files name their JSX source by pragma:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`allowImportingTsExtensions` is required: the packages import their own files as `./x.ts`.

### With Tailwind

`@solid-native/tailwind`'s web preset gives the browser the same variants and utilities as a
phone, so native class strings mean the same here:

```sh
npm install --save-dev tailwindcss @tailwindcss/vite @solid-native/tailwind
```

Add `tailwindcss()` after `solidNativeWeb()` in `vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite';
import { solidNativeWeb } from '@solid-native/web/solid/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [solidNativeWeb(), tailwindcss()],
});
```

Then a stylesheet, `src/styles.css`, imported from `src/main.ts` with `import './styles.css';`:

```css
@import 'tailwindcss/theme.css';
@import 'tailwindcss/utilities.css';
@import '@solid-native/tailwind/web.css';
```

A class such as `rounded-lg bg-blue-600 px-4 py-2` on a `Pressable` then styles it. `mount` puts
`platform-web` on the root, which `web:` matches. [Variants](/packages/tailwind/variants) covers
the rest.

## Mounting

```ts
import { mount } from '@solid-native/web/solid';
import { Card } from './card.solid.tsx';

const card = mount(document.getElementById('card')!, Card, { inputs: { title: 'Hello' } });
card.setInputs({ title: 'Updated' });
card.destroy();
```

`mount(element, component, options)` is the browser `mountNative()`, over the same host adapter,
with `BrowserEngine` in place of Fabric's `Engine`. `inputs` become props, `setInputs` updates them
in place, and callbacks are plain functions. `mountBrowser(code, element, options)` takes a render
function; `createBrowserRoot(element, options)` is the bare root. They take a real `Element`, not a
root tag, and need no Fabric UI manager.

Browser roots wire `Screen`, `ColorScheme` and `Direction` from `@solid-native/device/solid` to
resize events, `matchMedia('(prefers-color-scheme: dark)')` and `document.dir`; `services` adds or
overrides bindings. On first use a root injects a reset first in `document.head`, in Tailwind's
`base` layer so utilities beat it (`injectReset: false` skips it). It applies Yoga's defaults -
`display: flex; flex-direction: column; align-items: stretch; flex-shrink: 0` - so shared class
strings agree on both hosts.

## Inside a page you already have

A Solid DOM page can host universal components anywhere with `Island` from
`@solid-native/web/solid`: `<Island component={Card} inputs={{ title: 'Hello' }} />`. The island
inherits the page's owner and service scope but renders `View`, `Text` and `Pressable` through this
package. See [Islands](/packages/web/islands).

## The other way round

For the reverse - a Solid DOM component in a web view on a native screen - `mountInWebView` (from
`@solid-native/web/solid/web-view`) mounts it in the loaded page and `@solid-native/expo` shows it.
See [DOM components](/packages/expo/dom-components).
