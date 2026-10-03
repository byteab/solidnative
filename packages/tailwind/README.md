# @solidnative/tailwind

A Tailwind CSS preset for solid-native's Solid renderer, for Tailwind 4 on native and web and
Tailwind 3 on native: `<view class="flex-1 bg-blue-500 p-4">` works because
[`@solidnative/fabric`](https://github.com/byteab/solid-native/blob/main/packages/fabric) already has
a real cascade, and `class` already matches against it.

Alpha: APIs may change before 1.0.

## Install (Tailwind 4)

```sh
npm install @solidnative/tailwind @solidnative/metro @tailwindcss/cli tailwindcss
```

## Example (Tailwind 4)

```css
/* styles.css */
@import 'tailwindcss/theme.css';
@import 'tailwindcss/utilities.css';
@import '@solidnative/tailwind/native.css';
```

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solidnative/metro/solid-config.cjs');
const { withTailwind } = require('@solidnative/tailwind/config.cjs');

module.exports = withTailwind(withSolidNative(getDefaultConfig(__dirname)), {
  input: './styles.css',
});
```

```ts
// src/main.solid.ts
import tailwind from '../.solid-native/app.tailwind.js';
// ...hand `tailwind` to the app's global styles, as the template's entry does.
```

Import `theme.css` and `utilities.css`, not the plain `tailwindcss` entry point - that also pulls
in preflight, a browser reset that means nothing on a phone.

## Tailwind 3 (native only)

```sh
npm install @solidnative/tailwind @solidnative/metro tailwindcss@3
```

```js
// tailwind.config.js
module.exports = {
  presets: [require('@solidnative/tailwind/preset.cjs')],
  content: ['./src/**/*.{ts,tsx}'],
};
```

```css
/* styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`metro.config.js` and `src/main.solid.ts` are the same as above: `withTailwind` sees Tailwind 3 and runs its
own CLI, so there is no `@tailwindcss/cli` to install. The preset turns preflight off.

## What's in the package

- `./native.css` - the preset: platform variants, safe-area and hairline utilities, and
  touch-appropriate `hover:`/`focus-visible:` meanings.
- `./web.css` - the same preset's web entry point, for `@solidnative/web`.
- `./preset.cjs` - the native preset for Tailwind 3, used from `tailwind.config.js`.
- `./config.cjs` - `withTailwind`, the Metro config step that runs the app's Tailwind CLI and
  flattens its output for the CSS compiler.

## Docs

- [Tailwind](https://solid-native.com/packages/tailwind), including
  [Tailwind 3](https://solid-native.com/packages/tailwind#tailwind-3)
- [Variants](https://solid-native.com/packages/tailwind/variants) and
  [safe area and hairlines](https://solid-native.com/packages/tailwind/utilities)
- [Root README](https://github.com/byteab/solid-native/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solid-native/blob/main/ARCHITECTURE.md)

## License

MIT
