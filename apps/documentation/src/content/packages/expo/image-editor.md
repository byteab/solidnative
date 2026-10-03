---
title: Image editor
summary: Resize, crop, rotate, flip and re-encode an image file, with the native memory released.
---

# Image editor

`ImageEditor`, bound to `expo-image-manipulator`, resizes, crops, rotates, flips and re-encodes an
image file - e.g. turning an oversized [image picker](/packages/expo/image-picker) photo into a
thumbnail or upload-sized JPEG.

`edit()` runs the module's actions in order through its contextual API and saves the result to a
new cache file. The context and rendered image hold native memory nothing else frees, so both are
released once the file is written, or the write fails.

## Install

```sh
npx expo install expo-image-manipulator
```

```ts
import { ImageEditor, SaveFormat, FlipType } from '@solidnative/expo/solid/image-editor';
```

## The smallest useful example

```tsx
import { createSignal } from 'solid-js';
import { useService } from '@solidnative/device/solid';
import { Pressable, Text } from '@solidnative/components/solid';
import { ImagePicker } from '@solidnative/expo/solid/image-picker';
import { ImageEditor, SaveFormat } from '@solidnative/expo/solid/image-editor';

export function Avatar() {
  const picker = useService(ImagePicker);
  const editor = useService(ImageEditor);
  const [uri, setUri] = createSignal<string | null>(null);

  async function choose() {
    const [photo] = await picker.pick({ mediaTypes: ['images'] });
    if (!photo) return;
    const avatar = await editor.edit(photo.uri, [{ resize: { width: 256 } }], {
      format: SaveFormat.WEBP,
      compress: 0.8,
    });
    setUri(avatar?.uri ?? null);
  }

  return (
    <Pressable onPress={() => void choose()}>
      <Text>Choose a photo</Text>
    </Pressable>
  );
}
```

## What it does

- **`edit(uri, actions?, options?)`** - applies each `Action` in order and resolves to the saved
  `ImageResult` (`uri`, `width`, `height`, and `base64` when asked for). Each action has one key:
  - `{ resize: { width?, height? } }` - one side given keeps the aspect ratio.
  - `{ rotate: degrees }` - clockwise.
  - `{ flip: FlipType.Horizontal }` or `FlipType.Vertical`.
  - `{ crop: { originX, originY, width, height } }` - in pixels of the image as it is at that step.
  - `{ extent: { width, height, originX?, originY?, backgroundColor? } }` - web only (skipped
    elsewhere): resizes the canvas, filling new space with the color.

  `SaveOptions` are `format` (`SaveFormat.JPEG` by default, `PNG` or `WEBP`), `compress` (0 to 1)
  and `base64`.

- **`manipulate(uri)`** - the module's `ImageManipulatorContext` for chaining by hand (`resize()`,
  `rotate()`, `flip()`, `crop()`, `reset()`, then `renderAsync()` and the image's `saveAsync()`);
  the caller releases both. `null` once the component that called `useService(ImageEditor)` is
  disposed.

`SaveFormat` and `FlipType` are the module's enums, exported without loading the module so editing
code runs in a test.

## Without the module

On iOS and Android, a missing `expo-image-manipulator` (not installed, or not rebuilt since) throws
a `MissingModuleError`, naming the fix, when the service first reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed). An
`edit()` running when the component is disposed resolves to `null`, both native handles released.

On the web, and in a test with no fake (`provideService(ImageEditor.SOURCE, () => fake)` in a
`ServiceScope`), `edit()` and `manipulate()` give `null`.

## Reference

`ImageEditor` is exported from `@solidnative/expo/solid/image-editor`.

<!-- api: ImageEditor -->
