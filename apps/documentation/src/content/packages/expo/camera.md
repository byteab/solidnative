---
title: Camera
summary: The Camera component on screen, and a picture taken through its ref.
---

# Camera

`ImagePicker.capture()` (see [Image picker](/packages/expo/image-picker)) opens the system camera
over your app. For a camera inside your own screen, such as a scanner or a custom shutter, render
`Camera`; its `ref` callback hands you a `CameraRef` that takes pictures.

## Install

```sh
npx expo install expo-camera
```

```ts
import { Camera, type CameraRef } from '@solidnative/expo/solid/camera';
```

## The smallest thing that works

```tsx
import { Show } from '@solidnative/platform/solid';
import { Pressable, Text } from '@solidnative/components/solid';
import { Permission, registerExpoViews } from '@solidnative/expo/solid';
import { Camera, type CameraRef } from '@solidnative/expo/solid/camera';
import * as ExpoCamera from 'expo-camera';

registerExpoViews('expo-camera'); // once, before the app mounts

export function Shutter() {
  const permission = Permission.of(
    ExpoCamera.Camera.getCameraPermissionsAsync,
    ExpoCamera.Camera.requestCameraPermissionsAsync,
  );
  let camera: CameraRef | undefined;

  async function shoot() {
    const picture = await camera?.takePicture({ quality: 0.8 });
    if (picture) console.log(picture.uri, picture.width, picture.height);
  }

  return (
    <Show
      when={permission.granted()}
      fallback={
        <Show
          when={permission.blocked()}
          fallback={
            <Pressable onPress={() => void permission.ensure()}>
              <Text>Allow camera access</Text>
            </Pressable>
          }
        >
          <Text>Enable camera access in Settings to take a picture.</Text>
        </Show>
      }
    >
      <Camera facing="back" class="flex-1" ref={(ref) => (camera = ref)} />
      <Pressable onPress={() => void shoot()}>
        <Text>Take picture</Text>
      </Pressable>
    </Show>
  );
}
```

The camera, and so `shoot()`, renders only once `permission.granted()` is true. When
`permission.blocked()` is true the platform will not show its dialog again, so that branch sends the
user to Settings instead of retrying.

## Registering the view

`Camera` does not register the `expo-camera` view, and it is not registered by default. Call
`registerExpoViews('expo-camera')` (from `@solidnative/expo/solid`) once at startup, before the
first commit that renders a `Camera`. It registers as the module's _default_ view, Fabric name
`ViewManagerAdapter_ExpoCamera` with no view name suffix, since it is the module's only view.

## The camera permission

The view shows nothing without the camera permission, and `Camera` does not ask for it. Ask with
`Permission.of()` against `expo-camera`'s own functions (see [Permissions](/packages/expo/permissions)):

```ts
const permission = Permission.of(
  ExpoCamera.Camera.getCameraPermissionsAsync,
  ExpoCamera.Camera.requestCameraPermissionsAsync,
);
```

`Permission` belongs to the component that creates it, so create it inside the component function.

Add to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Allow this app to access your camera</string>
<key>NSMicrophoneUsageDescription</key>
<string>Allow this app to access your microphone</string>
```

The module's config plugin adds the Android `CAMERA` (and, for video with audio, `RECORD_AUDIO`)
permissions.

## Taking a picture

**`takePicture(options)`** takes `PictureOptions` (`quality`, `base64`, `exif`, `skipProcessing`,
`imageType`, `shutterSound` and the rest of `expo-camera`'s applicable picture options) and
resolves to a `CameraPicture`: `uri`, `width`, `height`, `format`, and `base64` or `exif` if asked
for. It resolves to **null** before the view reaches the screen, after it leaves, without the
module, and when the component is disposed while the picture is pending.

It calls the same native view function as React's `takePictureAsync`
(`AsyncFunction('takePicture')`), with the tag the engine committed the view under. The ref is
also an ordinary `NativeRef`, so `measure()` and the rest work on it.

## Props

`Camera` takes the ordinary view props plus `expo-camera`'s own: `facing`, `flashMode`,
`enableTorch`, `autoFocus`, `mute`, `zoom`, `active`, `mirror`, `animateShutter`, `pictureSize`,
`selectedLens`, `mode`, `videoQuality`, `videoBitrate`, `videoStabilizationMode`, `ratio`,
`poster`, `responsiveOrientationWhenOrientationLocked`, `barcodeScannerEnabled` and
`barcodeScannerSettings`. Events are callbacks: `onCameraReady`, `onMountError` and
`onBarcodeScanned`. **`foreground`** is an accessor for whether the screen is in front; while it is
false, `takePicture()` resolves to null and a picture already in progress is discarded. There is no
video recording method: the ref offers `takePicture()` only.

A test swaps the native view functions with `provideService(Camera.SOURCE, () => ({ takePicture }))`
in a `ServiceScope`.

## Reference

`Camera` is exported from `@solidnative/expo/solid/camera`.

<!-- api: Camera -->
