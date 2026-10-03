---
title: File system
summary: The cache and document directories, and the create-then-write dance a first write needs.
---

# File system

`FileSystem` locates files by purpose, cache or document, and hands back Expo's own `File`. It is a
locator, not a file API: moving, listing, downloading and streaming are on the returned object,
documented by `expo-file-system`.

## Install

```sh
npx expo install expo-file-system
```

```ts
import { FileSystem } from '@solidnative/expo/solid/file-system';
```

## The smallest useful example

```tsx
import { Pressable, Text } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { FileSystem } from '@solidnative/expo/solid/file-system';

export function Notes() {
  const files = useService(FileSystem);

  function saveNote() {
    files.write(files.document('notes.txt'), 'Buy milk');
  }

  return (
    <Pressable onPress={saveNote}>
      <Text>Save</Text>
    </Pressable>
  );
}
```

## `cache(name)` and `document(name)`

Both return Expo's `File` (typed structurally as `NativeFile`) for a name in one of two
directories:

- **`cache(name)`** - the system may delete it under storage pressure. For anything that can be
  rebuilt or re-downloaded.
- **`document(name)`** - survives and is backed up. For anything the user would notice losing.

Neither touches disk. `File` carries `uri`, `exists`, `size`, and its own `text()`, `textSync()`,
`bytes()`, `create()` and `delete()`; use those for anything beyond writing.

## `write(file, content)`

`File.write()` throws on a file that was never created. `write()` creates it first (with
intermediate directories) if needed, then writes text or bytes, replacing any contents.

```ts
files.write(files.cache('thumb.jpg'), imageBytes);
```

## Without the module

On iOS and Android, a missing `expo-file-system` (never installed, or not rebuilt since) throws a
`MissingModuleError` naming the fix when the service first reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

Unlike most services here, it has no silent fallback: on the web, and in a test with no fake,
`cache()`, `document()` and `write()` throw
`FileSystem needs expo-file-system: npx expo install expo-file-system`, since a silently failed write
is worse than an error. The same calls throw after the calling component is disposed. A test
supplies a `NativeFiles` fake with `provideService(FileSystem.SOURCE, () => fake)`.

## Reference

`FileSystem` is exported from `@solidnative/expo/solid/file-system`.

<!-- api: FileSystem -->
