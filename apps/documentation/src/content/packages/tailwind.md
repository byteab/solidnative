---
title: Tailwind
summary: A Tailwind v4 preset for native, plus the variants a touch device needs.
---

# Tailwind

`@solidnative/tailwind` makes `<View class="flex-1 bg-blue-500 p-4">` work with no interop layer:
[Fabric](/packages/fabric/css-engine) has a real cascade, and Tailwind's CSS goes through the same
compiler as your component styles. The package adds a build step that reduces Tailwind's browser
output to what native can express, and a preset with platform variants, safe-area and hairline
utilities, and touch meanings for `hover:` and `focus-visible:`.

## Setup

```sh
npm install @solidnative/tailwind tailwindcss @tailwindcss/cli
```

```css
/* src/styles.css */
@import 'tailwindcss/theme.css';
@import 'tailwindcss/utilities.css';
@import '@solidnative/tailwind/native.css';
```

Import `theme.css` and `utilities.css`, not plain `tailwindcss`, which adds preflight - a browser
reset of `html`, `::before` and `-webkit-*` that means nothing on a phone.

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solidnative/metro/solid-config.cjs');
const { withTailwind } = require('@solidnative/tailwind/config.cjs');

module.exports = withTailwind(withSolidNative(getDefaultConfig(__dirname)), {
  input: './src/styles.css',
});
```

`withTailwind` runs `@tailwindcss/cli` on `input` once, synchronously, before Metro's first
import, then watches under a dev server. One-off builds (`expo export`, `expo export:embed`,
`react-native bundle`, `expo prebuild`) and runs with `CI` set don't watch and exit cleanly;
`watch: true`/`false` overrides. The `output` (default `.solidnative/app.tailwind.js`) is a `.js`/`.cjs`/`.mjs` module,
not CSS, because Expo's transform worker claims every `.css` file and returns an empty module off
web. A `.d.ts` beside it types the default export as the `StyleSheet` `globalStyles` takes. Both
are rebuilt on every start, so `.solidnative/` belongs in `.gitignore` (the template does this).

A fresh clone or CI job lacks both until the Metro config loads, so typecheck fails with
`Cannot find module '../.solidnative/app.tailwind.js'`. Loading the config builds them and exits,
so run it first:

```json
"typecheck": "node metro.config.js && tsc -p tsconfig.json --noEmit"
```

```ts
// src/main.solid.ts
import tailwind from '../.solidnative/app.tailwind.js';

const root = createNativeRoot({
  fabric: getFabricUIManager(),
  rootTag: Number(rootTag),
  engineOptions: { processColor, globalStyles: tailwind },
});
```

Pass the module as `engineOptions.globalStyles`, the one stylesheet Fabric matches against every
node - which a utility needs, since `class="p-4"` can land anywhere.

## What the build step does

Tailwind 4's browser output - cascade layers, `@property`, `oklch()` colors, a `calc()` spacing
scale - never depends on the element, so it is all resolved at build time before your styles'
compiler sees it. Whatever native can't express is reported with its line:

```text
[solidnative] app.tailwind.css:153: dropped 'appearance': 'appearance' is not mapped yet.
```

That is deliberate - see [what CSS reaches a device](/packages/fabric/supported-css) for what
this compiles to and drops.

`truncate`, `line-clamp-*`, `line-clamp-none`, `whitespace-nowrap` and `text-ellipsis` become the
text's `numberOfLines` and `ellipsizeMode`, so put them on the `Text`, not a wrapping view.
`tabular-nums` and the other numeric variants become `fontVariant`.

Filters follow that page's platform table: `brightness-*` works on both; `blur-*`, `grayscale`,
`hue-rotate-*`, `drop-shadow-*` and the rest draw on Android only, so unscoped they are dropped
with a warning - write `android:grayscale`. `skew-x-*`/`skew-y-*` are the reverse (Android omits
`skewX()` and turns `skewY()` into a rotation): dropped unscoped, kept as `ios:skew-x-3`.

Multi-class values combine as on the web: `translate-x-2 translate-y-4` moves on both axes,
`shadow-lg ring-2 ring-blue-500` draws ring and shadow, `shadow-red-500` colors the shadow, and
`brightness-50 android:grayscale` draws both filters on Android. `text-shadow-red-500` and
`android:drop-shadow-red-500` color their shadows likewise, and `tabular-nums oldstyle-nums` keeps
both. A ring without a color uses the text color (`currentcolor`); `ring-inset` insets it, and
`ring-offset-2 ring-offset-white` draws a colored offset with the ring beyond.

`space-x-*`, `space-y-*` and `divide-*` style every child but the last at zero specificity, so a
child's own `me-*` or `border-*` wins. `space-x-reverse`/`divide-x-reverse` swap sides for a
`flex-row-reverse` parent. Exception: a child's `mx-*` or `ml-*` loses to `space-x-*`, because
native lets start/end margins beat left/right regardless of cascade (see [what CSS reaches a
device](/packages/fabric/supported-css)); use `ms-*`/`me-*`. `divide-double` is dropped with a
warning (native borders have no double style).

Pseudo-element variants and utilities (`placeholder:`, `before:`, `file:` etc.) style nothing;
native has no such element. A rule only for one is refused with a warning; in a shared selector
list, as in Tailwind's resets, the pseudo-element is removed and the rest kept.

A unitless `line-height` (what `leading-*` writes) works with or without a `font-size`. With one in
the same rule, as in every type-scale utility, the build multiplies them; otherwise it resolves on
device against the element's final font size, like an `em`. Unlike the web, a descendant with its
own font size inherits the resulting points, not the ratio, so put `leading-*` on the text itself.

[Variants](/packages/tailwind/variants) covers the platform, dark-mode, `hover:` and
`focus-visible:` variants and their native meanings; [Safe area and
hairlines](/packages/tailwind/utilities) covers the two added utility families.

## Tailwind 3

Tailwind 3.4.1+ uses the same package. Its preset lives in `tailwind.config.js`, so use
`preset.cjs`:

```sh
npm install @solidnative/tailwind tailwindcss@3
```

```js
// tailwind.config.js
module.exports = {
  presets: [require('@solidnative/tailwind/preset.cjs')],
  content: ['./src/**/*.{ts,tsx}'],
};
```

```css
/* src/styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`metro.config.js` and `main.solid.ts` are unchanged. `withTailwind` detects the `tailwindcss`
version and runs Tailwind 3's bundled CLI; no `@tailwindcss/cli` needed.

The preset disables preflight, so `@tailwind base` only gives each `--tw-*` property its default on
every element. That lets utilities combine: `transform rotate-45 translate-x-2`,
`shadow ring-2 ring-offset-2`, `bg-blue-500 bg-opacity-50`, `android:blur android:grayscale` and
`bg-gradient-to-r from-rose-500 via-white to-blue-500` resolve per element on device, as in a
browser. It supplies the same variants and utilities as `native.css`: platform variants, `dark:` on
a `.dark` class, touch `hover:`/`focus-visible:` (with `group-*:`/`peer-*:`), safe-area and
hairlines.

Every Tailwind 3 utility gets the same sweep as Tailwind 4, compared against Chrome: each works or
is refused with a warning. The exceptions only set a value another utility reads, and that reader is
refused instead: `snap-mandatory`/`snap-proximity` (read by `snap-x`/`snap-y`) and
`placeholder-opacity-*` (read by `placeholder-*` colours), so they do nothing.

The web host is Tailwind 4 only.
