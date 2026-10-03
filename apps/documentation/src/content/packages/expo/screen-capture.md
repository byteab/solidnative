---
title: Screen capture
summary: Keep a screen out of screenshots and recordings, and count the screenshots taken.
---

# Screen capture

`ScreenCapture` keeps sensitive screens out of screenshots and screen recordings, and counts the
screenshots the user takes, bound to `expo-screen-capture`.

Prevention is held by key and stays on while any key is held, so two screens that each prevent it
do not undo each other. A key is tied to the Solid owner that called `prevent()` and released when
that owner is disposed. The screenshot listener lives as long as the service's scope.

## Install

```sh
npx expo install expo-screen-capture
```

```ts
import { ScreenCapture } from '@solid-native/expo/solid/screen-capture';
```

## The smallest useful example

```tsx
import { Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Show } from '@solid-native/platform/solid';
import { ScreenCapture } from '@solid-native/expo/solid/screen-capture';

export function CardDetails() {
  const capture = useService(ScreenCapture);
  // Released automatically when CardDetails is disposed.
  void capture.prevent('card-details');

  return (
    <>
      <Text>4242 4242 4242 4242</Text>
      <Show when={capture.screenshots() > 0}>
        <Text>Screenshots of this screen show your card number.</Text>
      </Show>
    </>
  );
}
```

## What it does

- **`screenshots`** - accessor: how many screenshots the user has taken while the app was in front
  (the event carries nothing more).
- **`prevent(key?)`** - keeps the app out of screenshots and recordings until `allow()` with the
  same key, the calling component is disposed, or the app restarts. No key means one shared default.
- **`allow(key?)`** - releases the key; capture is allowed once no key is held.
- **`available()`** - whether the platform can prevent capture.
- **`protectAppSwitcher(blurIntensity?)`** and **`unprotectAppSwitcher()`** - iOS: blurs the app
  while not in focus (app switcher, background, interruptions), intensity 0 to 1, half by default.
  Dropped when the calling component is disposed. Android already hides the app in the switcher
  while capture is prevented.
- **`permission`** - a [`Permission`](/packages/expo/permissions) for screenshot detection, needed
  on Android 13 and earlier (detection reads the photo library). Later Android needs none; iOS
  always answers granted.

In a test, provide a `NativeScreenCapture` fake with
`provideService(ScreenCapture.SOURCE, () => fake)` inside a `ServiceScope` (both from
`@solid-native/device/solid`).

## Without the module

On iOS and Android, a missing `expo-screen-capture` (never installed, or not rebuilt since) throws a
`MissingModuleError` when the service first reaches for it, naming the module and the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, `screenshots` stays `0`, `available()` resolves to `false`,
the permission is refused, and every other method resolves without doing anything.

## Reference

`ScreenCapture` is exported from `@solid-native/expo/solid/screen-capture`.

<!-- api: ScreenCapture -->
