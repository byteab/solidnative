---
title: Using a module
summary: Install the Expo module, import its service by entry point, read it with useService, and what happens without it.
---

# Using a module

`@solid-native/expo` pulls in no native code. Install each Expo module your app uses alongside it:

```sh
npm install @solid-native/expo
npm install expo-battery   # only if you use Battery
```

## One entry point per module

**Most services have their own entry point** (`@solid-native/expo/solid/battery`,
`@solid-native/expo/solid/haptics`, ...) instead of the package root, so importing haptics never
pulls in the video player:

```ts
import { Battery } from '@solid-native/expo/solid/battery';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { Storage, SecureStorage } from '@solid-native/expo/solid/store';
```

Each name is both a type and a service token, so `useService(Clipboard)` and `clipboard: Clipboard`
both work. `useService` comes from `@solid-native/device/solid` and runs wherever a Solid owner is
active:

```tsx
import { useService } from '@solid-native/device/solid';
import { Text } from '@solid-native/components/solid';
import { Battery } from '@solid-native/expo/solid/battery';

export function Charge() {
  const battery = useService(Battery);
  return <Text>{Math.round(battery.level() * 100)}%</Text>;
}
```

Each service's factory reaches its module through a nested token, `X.SOURCE`, so there is nothing to
register: `useService` is the whole setup, unused services are never constructed, and each instance
lives (and releases its native listeners and claims) with the nearest `ServiceScope`. A test or
storybook swaps the native side by providing a fake source:

```tsx
import { ServiceScope, provideService } from '@solid-native/device/solid';
import { Battery } from '@solid-native/expo/solid/battery';
import { Charge } from './charge';

export function LowBatteryPreview() {
  return (
    <ServiceScope
      services={[
        provideService(Battery.SOURCE, () => ({
          level: { current: () => 0.1, subscribe: () => () => {} },
          state: null,
          saving: null,
        })),
      ]}
    >
      <Charge />
    </ServiceScope>
  );
}
```

## What happens without the module installed

A service `require()`s its module inside its factory on first construction. A static import would
make the file unloadable in Node: Expo's build output uses extensionless relative imports and
reaches `react-native`, which is Flow.

Where the module can exist on the current platform, a missing one throws a `MissingModuleError`
instead of silently doing nothing. That covers a package never installed and, more often, one
installed after the last build - a development build and Expo Go contain only the native modules
they were built with. The message names the fix:

```text
expo-haptics is not in this build of the app. Install it with "npx expo install expo-haptics",
then rebuild the app ("npx expo run:ios", or a new EAS build): a development build, and Expo Go,
contain only the native modules they were built with.
```

`MissingModuleError` is exported from `@solid-native/expo/solid` with a `module` property naming the
package, for apps that catch it. The same import has `expoModule` and `optional`, the helpers every
service uses to reach its module, for wrapping a module of your own.

Where the module cannot exist - an iOS-only module such as
[Sign in with Apple](/packages/expo/apple-sign-in) on Android, any service on the web, a test in
Node - the service goes inert so shared code and fake-less tests keep working. Inert means
reporting nothing rather than throwing: a level of `1`, a status of `'unknown'`, a method resolving
to `null` or an empty list. Each module's page says what its service does in both cases. A few
throw anyway, since an empty answer would be wrong: a [database](/packages/expo/database) or
[player](/packages/expo/player) also throws on the web, and [Crypto](/packages/expo/crypto) throws
wherever its module is missing, because an empty identifier or hash looks right and is not.

## What is on the bare import

Exports not bound to one optional module live on `@solid-native/expo/solid` itself:
[`Permission`](/packages/expo/permissions); `registerExpoView`, `registerExpoViews`,
`registerNativeViews`, `registerExpoUiViews` and `registerExpoMap` (see
[Native views](/packages/expo/native-views) and [Expo UI](/packages/expo/expo-ui)); the views
`ExpoImage`, `ExpoSymbol`, `ExpoGlass`, `ExpoGlassContainer` and `SegmentedControl`; the `Ui*` Expo
UI components; and `nativeState` (also on the Expo UI page).

## Where everything else lives

Every module has its own page, grouped by purpose, from the [overview](/packages/expo).
