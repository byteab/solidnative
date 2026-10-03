---
title: Expo
summary: Solid services over Expo's native modules - battery, haptics, storage and more.
---

# Expo

`@solidnative/expo` puts Expo's native modules behind Solid services: accessors instead of hooks,
`useService()` instead of a React `use*()` call. Use it for anything Expo already wraps - device
state, haptics, notifications, storage, sensors, media, location, sign-in, the on-device language
model, SwiftUI and Jetpack Compose controls - instead of writing your own wrapper. It is optional:
nothing else in the framework depends on it.

## The smallest thing that works

Every wrapped module is an optional peer dependency, so the package brings no native code of its
own. Install the module you want, import its entry point (`@solidnative/expo/solid/<module>`),
and resolve the service inside a [`ServiceScope`](/packages/device):

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Text } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Battery } from '@solidnative/expo/solid/battery';
import { Show } from '@solidnative/platform/solid';

export function Status() {
  const battery = useService(Battery);
  return (
    <Show when={battery.low()}>
      <Text>Battery saver recommended</Text>
    </Show>
  );
}
```

A service is created on first resolve and cleaned up with its scope. The views and controls -
`ExpoImage`, `ExpoSymbol`, `ExpoGlass`, `SegmentedControl` and the Expo UI components - come from
`@solidnative/expo/solid` itself. Install the Expo dependencies of every entry point you import:
runtime fallbacks do not stop Metro reporting an unresolved package. See
[Using a module](/packages/expo/using-a-module) for details.

## Modules

### Basics

- [Using a module](/packages/expo/using-a-module) - installing a module, entry points, and what happens without one.
- [Permissions](/packages/expo/permissions) - any Expo module's get/request permission pair, as accessors.

### Device state

- [Battery](/packages/expo/battery) - charge level and low-power mode, as accessors.
- [Brightness](/packages/expo/brightness) - read and set the screen's brightness.
- [Network](/packages/expo/network) - whether the device is connected, and reachable.
- [Orientation](/packages/expo/orientation) - the screen orientation, and locking it.
- [Locale](/packages/expo/locale) - the user's preferred locales, in order, and text direction.
- [Sensors](/packages/expo/sensors) - the accelerometer, gyroscope, magnetometer and more, one shape for all.
- [Keep awake](/packages/expo/keep-awake) - hold the screen on, with the release handed back.
- [App info](/packages/expo/app-info) - the app's own version and build, and the device it is on.

### Feedback

- [Haptics](/packages/expo/haptics) - a tap the user feels, without a promise to await.
- [Clipboard](/packages/expo/clipboard) - write to the pasteboard, and count when it changes.
- [Notifications](/packages/expo/notifications) - local and push notifications, with arrivals and taps as accessors.
- [Store review](/packages/expo/store-review) - the platform's own "rate this app" prompt.

### Storage and files

- [Storage](/packages/expo/storage) - a persisted value as a readable, writable accessor.
- [File system](/packages/expo/file-system) - read and write files in the app's own directories.
- [Database](/packages/expo/database) - a SQLite database, opened once, with migrations.
- [Assets](/packages/expo/assets) - preload images a screen should not pop in with.

### Media and camera

- [Image picker](/packages/expo/image-picker) - pick a photo from the library, or take one with the system camera.
- [Document picker](/packages/expo/document-picker) - pick files with the system's own picker.
- [Image editor](/packages/expo/image-editor) - resize, crop, rotate, flip and re-encode an image file.
- [Media library](/packages/expo/media-library) - save photos and videos to the user's library, and query what is in it.
- [Camera](/packages/expo/camera) - `<expo-camera>` on screen, and a picture taken from it.
- [Player](/packages/expo/player) - a video or audio player with readable, releasable state.

### Location and identity

- [Location](/packages/expo/location) - a position accessor, filled once or followed continuously.
- [Maps](/packages/expo/maps) - `<expo-map>`, Apple Maps on iOS and Google Maps on Android, with markers and taps.
- [Biometrics](/packages/expo/biometrics) - Face ID, Touch ID and fingerprint unlock.
- [Sign in with Apple](/packages/expo/apple-sign-in) - Apple's sign-in sheet and its approved button.
- [Tracking](/packages/expo/tracking) - Apple's App Tracking Transparency permission, and the advertising identifier.
- [Crypto](/packages/expo/crypto) - random UUIDs, secure random bytes and hashes.
- [Screen capture](/packages/expo/screen-capture) - keep a screen out of screenshots and recordings, and count the screenshots taken.
- [Browser](/packages/expo/browser) - an in-app browser, and a sign-in session.

### Intelligence

- [On-device AI](/packages/expo/language-model) - Apple Foundation Models and Gemini Nano, streamed into the UI, with nothing leaving the phone.

### App lifecycle

- [Fonts](/packages/expo/fonts) - register custom faces with the platform before the first frame.
- [Splash screen](/packages/expo/splash-screen) - hold the native splash until the app is ready.
- [Updates](/packages/expo/updates) - check for and apply an over-the-air update.
- [Background task](/packages/expo/background-task) - register work for the platform to run while the app is in the background.

### Native views

- [Native views](/packages/expo/native-views) - register an Expo module's view, or a community library's, as a component.
- [Expo UI](/packages/expo/expo-ui) - real SwiftUI and Jetpack Compose controls as components.

### Web interop

- [DOM components](/packages/expo/dom-components) - a Solid DOM component rendered by a browser, in a web view inside a native screen.
