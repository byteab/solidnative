---
title: Location
summary: A position accessor, filled once by current() or continuously by start().
---

# Location

`Location` wraps `expo-location`'s foreground position: a `position` accessor written by a one-off
`current()` or a running `start()`. Nothing is watched until you call one, and accuracy is explicit.

## Install

```sh
npx expo install expo-location
```

```ts
import { Location } from '@solid-native/expo/solid/location';
```

## The smallest thing that works

```tsx
import { onMount } from 'solid-js';
import { useService } from '@solid-native/device/solid';
import { Show } from '@solid-native/platform/solid';
import { Text } from '@solid-native/components/solid';
import { Location } from '@solid-native/expo/solid/location';

export function Run() {
  const location = useService(Location);
  onMount(() => void location.start({ accuracy: 'high', distance: 10 }));

  return (
    <Show when={location.position()}>
      {(here) => (
        <Text>
          {here().latitude}, {here().longitude}
        </Text>
      )}
    </Show>
  );
}
```

Called under an owner (here, `onMount`), `start()` stops when the component is disposed. From an
event handler, keep the stop function it resolves to and call it yourself.

## Reading a position

- **`position`** - null until read, then the latest fix: `latitude`, `longitude`, `altitude`,
  `accuracy`, `heading`, `speed` and `timestamp` (the middle four null when unknown).
- **`current(accuracy)`** - reads once and returns it, or null without the permission or module.
- **`start({ accuracy, distance, interval })`** - follows the position, resolving to a stop
  function. `distance` is meters before the next update; `interval` is milliseconds, Android only
  (iOS updates on distance).
- Accuracy is a name, not Expo's numeric enum: `lowest`, `low`, `balanced` (default), `high`,
  `highest` or `navigation` - which keeps the GPS hot.

Both ask for the foreground permission via `location.permission` (see
[Permissions](/packages/expo/permissions)); refused, `current()` resolves to null and `start()` to a
no-op stop. All watches stop when the service's owner is disposed. Background location is not
wrapped; use `expo-location`'s background API directly.

Add to `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Allow this app to use your location</string>
```

The config plugin adds Android's `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`.

## Without the module

On iOS and Android, a missing or not-yet-rebuilt `expo-location` throws a `MissingModuleError`
naming the fix when first used; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake (`provideService(Location.SOURCE, () => fake)` in a
`ServiceScope`), `permission` reports `denied` with `canAskAgain: false`, and the calls behave as
refused above.

## Reference

`Location` is exported from `@solid-native/expo/solid/location`.

<!-- api: Location -->
