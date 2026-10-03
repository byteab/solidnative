---
title: Image picker
summary: Pick a photo from the library, or take one with the system camera.
---

# Image picker

`ImagePicker` wraps `expo-image-picker`: the system's photo library and camera UI, for an avatar,
an attachment, anything picked or shot once.

## Install

```sh
npx expo install expo-image-picker
```

```ts
import { ImagePicker, type PickedAsset } from '@solid-native/expo/solid/image-picker';
```

## The smallest thing that works

```tsx
import { createSignal } from 'solid-js';
import { useService } from '@solid-native/device/solid';
import { Pressable, Text } from '@solid-native/components/solid';
import { ImagePicker, type PickedAsset } from '@solid-native/expo/solid/image-picker';

export function Avatar() {
  const picker = useService(ImagePicker);
  const [photo, setPhoto] = createSignal<PickedAsset | null>(null);

  async function choose() {
    const [picked] = await picker.pick({ mediaTypes: ['images'], allowsEditing: true });
    if (picked) setPhoto(picked);
  }

  async function take() {
    const [taken] = await picker.capture({ quality: 0.8 });
    if (taken) setPhoto(taken);
  }

  return (
    <>
      <Pressable onPress={() => void choose()}>
        <Text>Choose a photo</Text>
      </Pressable>
      <Pressable onPress={() => void take()}>
        <Text>Take one</Text>
      </Pressable>
    </>
  );
}
```

## Picking and capturing

- **`pick(options)`** opens the system photo picker. It never asks for a permission: the system
  UI runs outside your app's sandbox.
- **`capture(options)`** asks for the camera permission, then opens the system camera; refused, it
  resolves to an empty list.
- Both resolve to a list of assets, **empty if the person canceled**, so
  `const [photo] = await picker.pick()` gives `undefined` - no `{ canceled: true }` to check.
- `options` is `PickerOptions`, `expo-image-picker`'s `ImagePickerOptions` passed through:
  `mediaTypes` (`'images'`, `'videos'`, `'livePhotos'`), `allowsEditing`, `quality`,
  `allowsMultipleSelection` and the rest.
- A picker still open when the calling component is disposed resolves to an empty list.

## Permissions

Two separate permissions, each a `Permission` (see [Permissions](/packages/expo/permissions)):

- **`libraryPermission`** - only for reading the library directly, outside `pick()`.
- **`cameraPermission`** - what `capture()` asks for via `ensure()`. `cameraPermission.blocked()`
  says when to send the person to Settings instead.

Add to `Info.plist`:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>Allow this app to access your photos</string>
<key>NSCameraUsageDescription</key>
<string>Allow this app to access your camera</string>
<key>NSMicrophoneUsageDescription</key>
<string>Allow this app to access your microphone</string>
```

Android's permissions are added automatically by the module's config plugin.

## Without the module

On iOS and Android, a missing or not-yet-rebuilt `expo-image-picker` throws a `MissingModuleError`
naming the fix when first used; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake (`provideService(ImagePicker.SOURCE, () => fake)` in a
`ServiceScope`), it acts as though the person refused: `pick()` and `capture()` resolve to an empty
list, and both permissions report `denied` with `canAskAgain: false`.

## Reference

`ImagePicker` is exported from `@solid-native/expo/solid/image-picker`.

<!-- api: ImagePicker -->
