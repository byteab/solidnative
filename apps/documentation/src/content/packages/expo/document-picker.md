---
title: Document picker
summary: Pick files with the system's own picker, and get nothing back when it is canceled.
---

# Document picker

`DocumentPicker` opens the system file picker through `expo-document-picker`: the Files browser on
iOS, the storage access framework on Android. Options are the module's own
(`DocumentPickerOptions`), passed through unchanged. A canceled picker answers with no files, and no
permission is needed or asked for.

## Install

```sh
npx expo install expo-document-picker
```

```ts
import { DocumentPicker } from '@solid-native/expo/solid/document-picker';
```

## The smallest useful example

```tsx
import { createSignal } from 'solid-js';
import { useService } from '@solid-native/device/solid';
import { Pressable, Text } from '@solid-native/components/solid';
import { DocumentPicker } from '@solid-native/expo/solid/document-picker';

export function Attach() {
  const documents = useService(DocumentPicker);
  const [attached, setAttached] = createSignal('');

  async function attach() {
    const [file] = await documents.pick({ type: 'application/pdf' });
    if (file) setAttached(file.name);
  }

  return (
    <>
      <Pressable onPress={() => void attach()}>
        <Text>Attach a PDF</Text>
      </Pressable>
      <Text>{attached()}</Text>
    </>
  );
}
```

## What it does

- **`pick(options?)`** - opens the picker and resolves to the chosen files, empty if canceled. Each
  is a `PickedDocument`: `uri`, `name`, `mimeType`, `size` and `lastModified` (plus `file` and
  `base64` on the web).
  - `type` - a MIME type such as `'image/*'`, or a list. Everything by default.
  - `multiple` - allow more than one file.
  - `copyToCacheDirectory` - on by default: copies each file into the app's cache so
    [the file system](/packages/expo/file-system) and other Expo modules can read its `uri`. Off
    keeps the platform's own reference, which only some readers understand.
  - `base64` - on the web, whether each `uri` is the file's contents as base64. On by default.

## Without the module

On iOS and Android, a missing `expo-document-picker` (never installed, or not rebuilt since) throws
a `MissingModuleError` naming the fix when the service first reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake (`provideService(DocumentPicker.SOURCE, () => fake)` in a
`ServiceScope`), `pick()` resolves to an empty list, as does a pick still open when the calling
component is disposed.

## Reference

`DocumentPicker` is exported from `@solid-native/expo/solid/document-picker`.

<!-- api: DocumentPicker -->
