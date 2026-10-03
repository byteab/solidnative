---
title: Keep awake
summary: Hold the screen on with a tag, for as long as something needs it and no longer.
---

# Keep awake

`KeepAwake` holds the screen on through `expo-keep-awake`. There is no bare activate: a hold never
released is a phone that never sleeps, so `hold()` always returns its release.

## Install

```sh
npx expo install expo-keep-awake
```

```ts
import { KeepAwake } from '@solidnative/expo/solid/keep-awake';
```

## The smallest useful example

```tsx
import { useService } from '@solidnative/device/solid';
import { Text } from '@solidnative/components/solid';
import { KeepAwake } from '@solidnative/expo/solid/keep-awake';

export function Recording() {
  // Held while this component is alive, released when it is disposed.
  useService(KeepAwake).hold('recording');
  return <Text>Recording...</Text>;
}
```

## What it does

- **`hold(tag)`** - holds the screen on under `tag` (default `'solid-native'`) and returns the
  release; under a Solid owner, disposal releases it too. Holds are counted per tag, so two holds
  on the same tag each last until their own release; distinct tags tell them apart in `holders`.
- **`holders`** - accessor of the set of tags currently holding, e.g. for a debug screen.
- **`active`** - whether `holders` is non-empty.
- **`error`** - the last error from activating or deactivating, or `null`.

A second release of the same hold does nothing. Disposing the service scope releases every tag.

## Without the module

On iOS and Android, a missing or not-yet-rebuilt `expo-keep-awake` throws a `MissingModuleError`
naming the fix the first time `useService(KeepAwake)` uses it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `KeepAwake.SOURCE`, `hold()` still updates `holders` and
`active`, but the device is untouched and releasing is safe.

## Reference

`KeepAwake` is exported from `@solidnative/expo/solid/keep-awake`.

<!-- api: KeepAwake -->
