---
title: Fonts
summary: Registering a stylesheet's custom fonts with the platform before the app mounts.
---

# Fonts

A font must be registered with the platform before layout, or the first paint uses the fallback
face and reflows. `loadFonts()`, wired to `expo-font`, is the call an app makes before it mounts.

## Install

```sh
npx expo install expo-font
```

```ts
import { loadFonts } from '@solid-native/expo/solid/fonts';
```

Unlike most services here, this uses `expo-font`'s JavaScript rather than its native module, which
takes descriptors that JavaScript builds from an asset.

## Declaring faces

A face is declared in CSS, collected at build time, and registered before the app mounts:

```css
@font-face {
  font-family: Inter;
  src: url('./fonts/Inter-Regular.ttf');
}
@font-face {
  font-family: Inter;
  src: url('./fonts/Inter-Bold.ttf');
  font-weight: 700;
}
```

```ts
import { loadFonts } from '@solid-native/expo/solid/fonts';
import globalStyles from './global-styles.native.css';

await loadFonts(globalStyles);
// ...then mount the app with the same sheet as its global styles.
```

The `url()` becomes a `require` at build time, so the bundler ships the file (a plain path would be
silently missing on the device). `loadFonts()` takes any number of compiled sheets and does nothing
when none declares a face, so startup code can call it unconditionally.

## There is no font matching on a device

Native looks a family up by name only, so a bold cut is its own family. The second face above is
registered as `Inter-700` as well as `Inter`; ask for it with `font-family: Inter-700`.
`font-weight: 700` on a single-face family gets whatever the platform synthesizes, as in plain
React Native. A face with a `style` is likewise registered as `<family>-<style>`.

## Reading what loaded: `Fonts`

`loadFonts()` is a function because it runs before any service scope exists. Afterwards,
`useService(Fonts)` reports what is registered:

```tsx
import { For } from '@solid-native/platform/solid';
import { Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Fonts } from '@solid-native/expo/solid/fonts';

export function FamilyPicker() {
  const fonts = useService(Fonts);

  return (
    <View>
      <For each={fonts.families()}>{(family) => <Text>{family}</Text>}</For>
    </View>
  );
}
```

- **`families`** - every family the platform can find, custom or bundled; an accessor, updated
  after a later `load()`.
- **`has(family)`** - whether a family is registered, reactive too.
- **`available`** - whether `expo-font` is installed; without it no custom face appears.
- **`load(map)`** - register faces by name, for fonts not from a stylesheet. `loadFonts()` calls
  `loadSheet(...sheets)` underneath.

`Fonts` is a `FontRegistry`. Startup code needing a fake `expo-font` calls
`new FontRegistry(source).loadSheet()`; a test in a service scope uses
`provideService(Fonts.SOURCE, () => fake)`.

## Without the module

On iOS and Android, a missing `expo-font` (not installed, or not rebuilt since) throws a
`MissingModuleError`, naming the fix, when `Fonts` first reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, `loadFonts()` resolves without registering anything, so
text uses the fallback face. `Fonts.available` is `false`, `families()` is empty, `has()` is
`false`.
