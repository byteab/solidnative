---
title: Assets
summary: Bundled images, downloaded before they are needed, as a reactive resource.
---

# Assets

`assets(modules)` downloads images a screen should not pop in with. A bundled image still has to
load the first time; this tells a placeholder or splash screen when the wait is over. It wraps
`Asset.loadAsync`, the promise behind Expo's `useAssets()` hook.

## Install

```sh
npx expo install expo-asset
```

```ts
import { assets } from '@solid-native/expo/solid/assets';
```

## The smallest useful example

```tsx
import { Show } from '@solid-native/platform/solid';
import { Image, View } from '@solid-native/components/solid';
import { assets } from '@solid-native/expo/solid/assets';

export function Hero() {
  const hero = assets(() => [require('./hero.png')]);
  const first = () => hero.value()?.[0];

  return (
    <Show when={first()} fallback={<View class="bg-slate-200 h-40" />}>
      {(asset) => <Image source={{ uri: asset().uri }} />}
    </Show>
  );
}
```

The placeholder covers loading, a failed download and an empty list alike.

## `assets(modules)`

Returns an `AssetResource`:

- `value()` - `undefined` until the first load resolves, then the downloaded assets, each with
  `uri`, `width` and `height`.
- `status()` - `'idle'`, `'loading'`, `'reloading'`, `'resolved'`, `'error'` or `'local'`.
- `isLoading()` - true while loading or reloading.
- `error()` - a failed download, held rather than thrown.
- `reload()` loads again, keeping the current value meanwhile; `set()` and `update()` replace the
  value locally; `destroy()` stops listening for answers.

There is no options argument. `modules` is an accessor: a signal read inside it re-runs the load
when it changes:

```ts
const photo = assets(() => [photos()[index()]]);
```

`assets()` calls `useService(Assets)`, so it must run under a Solid owner within the app's service
scope, and the resource is destroyed with that owner. Each call site is a separate load, so two
screens loading different images never share one "loaded" signal.

To warm assets before any component exists, such as during startup, call `Asset.loadAsync` from
`expo-asset` directly.

## Without the module

On iOS and Android, a missing `expo-asset` (never installed, or not rebuilt since) throws a
`MissingModuleError` when `assets()` first reaches for it, naming the module and the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, the resource resolves to an empty list. A test supplies a
`NativeAssets` fake with `provideService(Assets.SOURCE, () => fake)`.
