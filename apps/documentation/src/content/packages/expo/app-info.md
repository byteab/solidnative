---
title: App info
summary: The app's version, build and identifier, and the device it is running on, as plain values.
---

# App info

`AppInfo` reports the app's version and build, and the device it runs on, from `expo-application`
and `expo-device`. These are constants read once, not accessors. Anything the platform does not
report is null.

## Install

```sh
npx expo install expo-application expo-device
```

```ts
import { AppInfo } from '@solid-native/expo/solid/app-info';
```

## The smallest useful example

```tsx
import { Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { AppInfo } from '@solid-native/expo/solid/app-info';

export function About() {
  const info = useService(AppInfo);

  return (
    <Text>
      {info.version} ({info.build}) on {info.device.model}
    </Text>
  );
}
```

## What it reports

From `expo-application`:

- **`version`** - `CFBundleShortVersionString` on iOS, `versionName` on Android.
- **`build`** - `CFBundleVersion` on iOS, `versionCode` on Android.
- **`id`** - the bundle identifier on iOS, the package name on Android.
- **`name`** - the name under the icon.

From `expo-device`, on `device`:

- **`model`** - `iPhone 17 Pro`, `Pixel 9`.
- **`brand`**
- **`os`** - `iOS`, `iPadOS`, `Android`.
- **`osVersion`**
- **`physical`** - false in a simulator or emulator.
- **`type`** - `'phone'`, `'tablet'`, `'desktop'`, `'tv'` or `'unknown'`; null if not reported.

## Without the module

On iOS and Android, a missing `expo-application` or `expo-device` (never installed, or not rebuilt
since) throws a `MissingModuleError` when the service first reaches for it, naming the module and
the fix; see [Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, `version`, `build`, `id` and `name` are null without
`expo-application`, and every `device` field (including `physical`) is null without `expo-device`.
The modules are independent: either one alone fills in its own fields. A test supplies a
`NativeAppInfo` with `provideService(AppInfo.SOURCE, () => fake)`.

## Reference

`AppInfo` is exported from `@solid-native/expo/solid/app-info`.

<!-- api: AppInfo -->
