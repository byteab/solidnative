---
title: Device orientation
summary: The screen orientation, and locking it, through expo-screen-orientation.
---

# Device orientation

`DeviceOrientation` reports the screen orientation and locks it through `expo-screen-orientation`.

It wraps `getOrientationAsync()`: how the screen is laid out, not how the device is held. Once
locked to portrait it reports portrait however the phone is held. For a layout's own orientation,
use the CSS `orientation` media feature; for physical attitude (a level, a game controller), use a
motion sensor from [Sensors](/packages/expo/sensors).

## Install

```sh
npx expo install expo-screen-orientation
```

```ts
import { DeviceOrientation } from '@solidnative/expo/solid/orientation';
```

## The smallest useful example

```tsx
import { useService } from '@solidnative/device/solid';
import { Text } from '@solidnative/components/solid';
import { DeviceOrientation } from '@solidnative/expo/solid/orientation';

export function Player() {
  const orientation = useService(DeviceOrientation);
  // Released automatically when this component is disposed.
  orientation.lock('landscape');
  return <Text>Playing in {orientation.orientation()}</Text>;
}
```

## What it reports and does

- **`orientation`** - `'unknown'`, `'portrait'`, `'portrait-upside-down'`, `'landscape-left'` or
  `'landscape-right'`. Starts `'unknown'`.
- **`landscape`** - true whenever `orientation` starts with `landscape`.
- **`lock(lock)`** - pins the screen to `'default'` (portrait only on a phone), `'all'`,
  `'portrait'` or `'landscape'`, and returns the unlock function. Under a Solid owner (a component
  body, an effect) it is also released when the owner is disposed. Locks stack: releasing one
  restores an earlier lock still held (e.g. the screen under a pushed one); with none held, the
  screen unlocks.
- **`error`** - the last native lock/unlock error, or `null`.

## Without the module

On iOS and Android, a missing `expo-screen-orientation` (not installed, or not rebuilt since) throws
a `MissingModuleError` naming the fix on the first `useService(DeviceOrientation)`; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `DeviceOrientation.SOURCE`, `orientation` stays `'unknown'`,
`landscape` stays `false`, and `lock()` returns a no-op.

## Reference

`DeviceOrientation` is exported from `@solidnative/expo/solid/orientation`, with the `Orientation`
and `OrientationLock` types.

<!-- api: DeviceOrientation -->
