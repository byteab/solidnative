---
title: Brightness
summary: Set and restore the app's own screen brightness, for a boarding pass or a QR code.
---

# Brightness

`Brightness` sets the screen brightness for the app's own window, for screens like a boarding pass
or QR code, and puts it back. It does not touch the system brightness, which outlives the app and
needs a permission on Android; use Expo's own API for that.

## Install

```sh
npx expo install expo-brightness
```

```ts
import { Brightness } from '@solidnative/expo/solid/brightness';
```

## The smallest useful example

```tsx
import { useService } from '@solidnative/device/solid';
import { Text } from '@solidnative/components/solid';
import { Brightness } from '@solidnative/expo/solid/brightness';

export function BoardingPass() {
  const brightness = useService(Brightness);
  // Called while the component is being created, so the claim is released when it is disposed.
  brightness.set(1);
  return <Text>Show this at the gate</Text>;
}
```

## What it does

- **`level`** - an accessor, 0 to 1. Starts at `1`.
- **`set(level)`** - clamps to `0..1`, applies it, and returns a function that restores the
  previous level: one an earlier `set()` still holds (such as the screen under a pushed one), or
  the system brightness once nothing does. Under a Solid owner (a component body, an effect) the
  claim is also released when the owner is disposed. Elsewhere, keep and call the returned
  function rather than `restore()`; a screen left at full brightness reads to users as a battery
  fault.
- **`restore()`** - restores the system brightness at once, whatever is set, without waiting for
  teardown.
- **`error`** - an accessor holding the last error the native module raised applying a level, or
  `null`.

## Without the module

On iOS and Android, a missing `expo-brightness` (never installed, or not rebuilt since) throws a
`MissingModuleError` the first time `useService(Brightness)` reaches for it, naming the module and
the fix; see [Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `Brightness.SOURCE`, `level` stays at `1`; `set()` and
`restore()` do nothing and do not throw.

## Reference

`Brightness` is exported from `@solidnative/expo/solid/brightness`.

<!-- api: Brightness -->
