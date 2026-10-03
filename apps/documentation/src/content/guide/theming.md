---
title: Theming and Tailwind
summary: Tailwind and your own CSS on native views, through a real cascade with no className interop layer.
---

# Theming and Tailwind

NativeWind needs `cssInterop` and a variant runtime because React Native has no CSS engine.
solid-native has a real cascade, so `<View class="flex-1 bg-blue-500 p-4">` matches through
`class`. A build step converts web CSS to the native subset; a preset adds native vocabulary.

## The build step

The app's Tailwind entry imports the theme, the utilities and the native preset:

```css
/* src/tailwind.css */
@import 'tailwindcss/theme.css';
@import 'tailwindcss/utilities.css';
@import '@solidnative/tailwind/native.css';
```

Importing these instead of `tailwindcss` leaves out preflight's browser reset (`html`,
`::before`, `-webkit-*`).

`withTailwind` runs the Tailwind CLI from Metro and writes the sheet as a JavaScript module,
`.solid-native/app.tailwind.js` unless `output` says otherwise (a `.css` output would reach native
as an empty module):

```ts
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solidnative/metro/solid-config.cjs');
const { withTailwind } = require('@solidnative/tailwind/config.cjs');

module.exports = withTailwind(withSolidNative(getDefaultConfig(__dirname)), {
  input: './src/tailwind.css',
});
```

The entry passes it to the root as global styles, whose rules match any node:

```ts
// src/main.solid.ts
import tailwind from '../.solid-native/app.tailwind.js';

const root = createNativeRoot({
  fabric: getFabricUIManager(),
  rootTag: Number(rootTag),
  engineOptions: { processColor, globalStyles: tailwind /* , conditions, tokens, ... */ },
});
```

An app with its own global sheet merges both into one `StyleSheet`, its rules first, as the
canary's `global-styles.solid.ts` does.

The compiler unwraps `@layer` and `@supports`, drops `@property`, substitutes static theme
variables and folds `calc()` through lightningcss (`calc(var(--spacing) * 4)` is constant but cannot
resolve on a device). `oklch()` becomes sRGB, as in component stylesheets. The utilities compile to:

```
p-4              -> { paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16 }
gap-2            -> { gap: 8 }
h-16             -> { height: 64 }
rounded-lg       -> { borderTopLeftRadius: 8, ... }
bg-blue-500      -> { backgroundColor: 'rgb(43, 127, 255)' }
```

Unsupported styles warn in Metro's output with line numbers, rather than silently doing nothing:

```
app.tailwind.css:153: dropped 'appearance': 'appearance' is not mapped yet.
```

## The preset

`native.css` and `web.css` each import `shared.css` and define four platform variants.

### `hover:` is the pressed state

Native drops `:hover` with a build warning, so `hover:` matches `:active`, set on touched views
and their ancestors. `data-hover` covers iPad trackpads: components listen for React Native's W3C
pointer events and set it themselves.

```css
/* native.css */
@custom-variant hover (&:active, &[data-hover]);

/* web.css */
@custom-variant hover (&:hover, &:active, &[data-hover]);
```

The browser variant includes `:active` because `:hover` may never fire, or may stick, on touch
screens. Use `press:` and `hovered:` to tell the states apart.

### `focus-visible:` is `focus:` on native

Native focus comes from keyboards, remotes or assistive technology, where a ring always helps,
and `:focus-visible` is dropped with a warning. Both platforms also match `data-focus`, so a
wrapper that owns the border can show the ring for the field inside it.

### `ios:`, `android:`, `web:`, `native:`

These match a `platform-ios`, `platform-android` or `platform-web` class on the root, which
`createNativeRoot` does not add. Add it once in the entry, after creating the root:

```ts
root.engine.addClass(root.engine.root, `platform-${Platform.OS}`);
```

Variants for absent classes never match, so `ios:pt-2` is harmless on the web.

### `dark:` follows a class

Tailwind's default `dark:` uses `@media (prefers-color-scheme: dark)`, which the engine tracks; a
class also allows palettes such as `.dark { --background: ... }` and in-app overrides.

`watchConditions(root.engine)` from `@solidnative/device/solid` keeps the root's `dark` class in
sync with the system. For an in-app switcher, pass `{ darkClass: false }` and set the class
yourself, or a system-dark root overrides the switcher's light choice.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import type { HostChild } from '@solidnative/platform/solid';
import { View } from '@solidnative/components/solid';
import { ColorScheme, createServiceToken, useService } from '@solidnative/device/solid';

type Preference = 'light' | 'dark' | 'system';

export const Theme = createServiceToken('app.theme', () => {
  const system = useService(ColorScheme);
  const [preference, setPreference] = createSignal<Preference>('system');
  const className = createMemo(() => {
    const chosen = preference() === 'system' ? system.current() : preference();
    return chosen === 'dark' ? 'dark' : '';
  });
  return { preference, setPreference, className };
});

export function Themed(props: { children?: HostChild }) {
  const theme = useService(Theme);
  return (
    <View class={theme.className()} style={{ flex: 1 }}>
      {props.children}
    </View>
  );
}
```

Render `Themed` inside a `ServiceScope`; persist the preference in settings storage if needed.
A class covers the app's own CSS only. To switch the native chrome too (headers, switches, sheets,
the keyboard), set the window's scheme with `ColorScheme.set`:

```ts
useService(ColorScheme).set('dark'); // the whole app is dark, whatever the system says
useService(ColorScheme).set(null); // back to the system's
```

`prefers-color-scheme`, `light-dark()` and `ColorScheme.current()` all follow it.

## Tokens cross component boundaries

Custom properties cascade into child components, but ordinary rules in a `withNativeStyles` sheet
match only nodes created inside that call (until a nested `withNativeStyles` brings its own sheet):
encapsulation without per-element markers. A parent can retheme a child through `--primary` but
cannot select its internals.

## Unsupported values and font fallbacks

A unitless `line-height` such as `calc(1.75 / 1.125)` inside a custom property leaves `text-lg`
empty until build-time substitution resolves it.
Font stacks fail silently: native `fontFamily` takes one name, so
`font-family: Inter, Helvetica, sans-serif` becomes `Inter` with no warning. If that font is missing
or a CSS generic such as `ui-monospace`, text falls back to the system font. Name and verify a
bundled font.
