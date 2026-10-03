---
title: Tracking
summary: Apple's App Tracking Transparency permission, and the advertising identifier behind it.
---

# Tracking

`Tracking` is Apple's App Tracking Transparency permission, bound to `expo-tracking-transparency`.
On iOS 14.5+, an app must ask before tracking the user across other companies' apps and sites, and
gets the advertising identifier only after a yes. iOS asks once; afterwards `permission.blocked()`
tells the app to point the user at Settings. Android has no such permission and answers granted.

## Install

```sh
npx expo install expo-tracking-transparency
```

```ts
import { Tracking } from '@solid-native/expo/solid/tracking';
```

The config plugin sets the dialog text (`NSUserTrackingUsageDescription`) from its
`userTrackingPermission` option, or a generic sentence, and adds Android's `AD_ID` permission.

## The smallest useful example

```tsx
import { useService } from '@solid-native/device/solid';
import { Pressable, Text } from '@solid-native/components/solid';
import { Tracking } from '@solid-native/expo/solid/tracking';

export function Consent() {
  const tracking = useService(Tracking);
  const allow = async () => {
    if (await tracking.permission.ensure()) {
      console.log('advertising id', tracking.advertisingId());
    }
  };
  return (
    <Pressable onPress={allow}>
      <Text>Personalise ads</Text>
    </Pressable>
  );
}
```

## What it does

- **`permission`** - a [`Permission`](/packages/expo/permissions): `ensure()` shows the dialog only
  if unanswered; `granted()` and `blocked()` are accessors.
- **`available()`** - whether the device has the tracking API; without it the permission answers
  granted.
- **`advertisingId()`** - the IDFA on iOS, the advertising ID on Android. Null on iOS until
  allowed, in the simulator, and on Android with ad tracking limited.

## Without the module

On iOS and Android, a missing `expo-tracking-transparency` (never installed, or not rebuilt since)
throws a `MissingModuleError` the first time `useService(Tracking)` reaches for it, naming the fix;
see [Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `Tracking.SOURCE`, the permission is refused and cannot be
asked for, `available()` is `false`, and `advertisingId()` is `null`.

## Reference

`Tracking` is exported from `@solid-native/expo/solid/tracking`.

<!-- api: Tracking -->
