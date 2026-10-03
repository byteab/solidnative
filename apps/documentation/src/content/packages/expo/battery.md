---
title: Battery
summary: The battery level, charging state and Low Power Mode, as Solid accessors.
---

# Battery

`Battery` reports the level, charging state and power-saving mode.

## Install

```sh
npx expo install expo-battery
```

```ts
import { Battery } from '@solidnative/expo/solid/battery';
```

## The smallest useful example

```tsx
import { useService } from '@solidnative/device/solid';
import { Text } from '@solidnative/components/solid';
import { Show } from '@solidnative/platform/solid';
import { Battery } from '@solidnative/expo/solid/battery';

export function Status() {
  const battery = useService(Battery);
  return (
    <Show when={battery.low()}>
      <Text>Battery saver recommended</Text>
    </Show>
  );
}
```

Every member is an accessor and tracks inside JSX, a `createMemo` or an effect.

## What it reports

- **`level`** - 0 to 1. Starts at `1` until the platform answers.
- **`known`** - whether the platform reports a level. False on a simulator and when iOS reports
  `-1` (no battery); `level` then reads `1` rather than a negative number.
- **`state`** - `'unknown'`, `'unplugged'`, `'charging'` or `'full'`. Android's `NOT_CHARGING`
  (plugged in and holding) reads as `'full'`.
- **`charging`** - true when `state` is `'charging'` or `'full'`.
- **`saving`** - Low Power Mode on iOS, Battery Saver on Android. Starts `false`.
- **`low`** - under 20% and not charging. False whenever the level is unknown.

## Without the module

On iOS and Android, a missing `expo-battery` (never installed, or not rebuilt since) throws a
`MissingModuleError` the first time `useService(Battery)` reaches for it, naming the module and
the fix; see [Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake source, `level` reads `1`, `known` is `false`, `state` is
`'unknown'`, and `saving` and `low` are `false`.

## Reference

`Battery` is exported from `@solidnative/expo/solid/battery`. A test replaces the native module by
providing `Battery.SOURCE` (`level`, `state` and `saving` observed sources, each may be `null`) in
a `ServiceScope`.

<!-- api: Battery -->
