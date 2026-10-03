---
title: Haptics
summary: Impact, notification and selection feedback, fired and forgotten.
---

# Haptics

`Haptics` fires haptic feedback: a collision, a success or failure, a selection change. It calls
Expo's native module directly, skipping `expo-haptics`'s JavaScript (which only adds a throw when
the module is missing) and its enums. `expo-haptics` must still be installed to link the native
side.

## Install

```sh
npx expo install expo-haptics
```

```ts
import { Haptics } from '@solid-native/expo/solid/haptics';
```

## The smallest useful example

```tsx
import { useService } from '@solid-native/device/solid';
import { Pressable, Text } from '@solid-native/components/solid';
import { Haptics } from '@solid-native/expo/solid/haptics';

export function SaveButton() {
  const haptics = useService(Haptics);
  const save = () => haptics.notify('success');
  return (
    <Pressable onPress={save}>
      <Text>Save</Text>
    </Pressable>
  );
}
```

## What it does

- **`impact(style)`** - a collision between interface elements. `style` is `'light'`, `'medium'`
  (the default), `'heavy'`, `'rigid'` or `'soft'`. `'rigid'` and `'soft'` need iOS 13+.
- **`notify(type)`** - a task succeeded or failed: `'success'`, `'warning'` or `'error'`. iOS plays
  a distinct pattern for each.
- **`select()`** - a selection changed, the lightest of the three.
- **`available`** - a plain boolean (not an accessor): whether the native module is installed.

Every method returns nothing, swallows failures, and is a no-op once the owning scope is disposed.
Expo's equivalents return promises that reject unhandled with no Taptic Engine, in a simulator, or
with Android's vibration permission off. To debug a silent one, log under `__DEV__` rather than
making call sites handle a rejection.

## Without the module

On iOS and Android, a missing `expo-haptics` (not installed, or not rebuilt since) throws a
`MissingModuleError`, naming the fix, the first time `useService(Haptics)` reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `Haptics.SOURCE`, every method does nothing and `available`
is `false`.

## Reference

`Haptics` is exported from `@solid-native/expo/solid/haptics`, with the `ImpactStyle` and
`NotificationType` types.

<!-- api: Haptics -->
