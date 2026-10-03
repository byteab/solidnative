---
title: Media library
summary: Save photos and videos to the user's library, and query what is in it.
---

# Media library

`MediaLibrary` saves to and reads from the user's photos and videos, bound to
`expo-media-library`. To let the user pick a photo, the [image picker](/packages/expo/image-picker)
needs no permission and is usually the better fit.

An `Asset` or `Album` is a handle with async getters (`getFilename()`, `getWidth()`, `getUri()`...);
a `Query` is built by chaining. The service holds two permissions: full access to read, and
write-only access, which is all saving needs.

## Install

```sh
npx expo install expo-media-library
```

```ts
import { MediaLibrary, AssetField, MediaType } from '@solid-native/expo/solid/media-library';
```

## The smallest useful example

```tsx
import { useService } from '@solid-native/device/solid';
import { Pressable, Text } from '@solid-native/components/solid';
import { MediaLibrary } from '@solid-native/expo/solid/media-library';

export function SavePhoto() {
  const library = useService(MediaLibrary);

  async function save() {
    const asset = await library.save('file:///path/to/edited.jpg');
    if (!asset) console.log('saving was refused');
  }

  return (
    <Pressable onPress={() => void save()}>
      <Text>Save to Photos</Text>
    </Pressable>
  );
}
```

`save()` asks for write-only access itself, and resolves to `null` if it is refused.

## Reading the library

Reading needs full access; pass a function that builds the module's `Query`:

```ts
const library = useService(MediaLibrary);

async function loadRecent() {
  if (!(await library.permission.ensure())) return [];
  const recent = await library.assets((query) =>
    query
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .limit(30),
  );
  return Promise.all(recent.map((asset) => asset.getUri()));
}
```

`metadata(query)` runs the same query but returns each asset's details instead of handles.

## What it does

- **`permission`** - a [`Permission`](/packages/expo/permissions) for full (read and write) access.
- **`writePermission`** - a `Permission` for write-only access, which `save()` asks for.
- **`requestPermission(writeOnly?, granularPermissions?)`** - asks with the module's options (on
  Android 13+, which of `'photo'`, `'video'`, `'audio'`). Resolves to whether full access is granted.
- **`presentPermissionsPicker(mediaTypes?)`** - iOS and Android 14+: after partial access, shows the
  system picker to change which photos.
- **`save(uri, album?)`** - saves a local image or video file, into an album if one is given.
- **`assets(query?)`** and **`metadata(query?)`** - matching assets as handles or details; all
  assets without a query.
- **`asset(id)`** - the handle for an asset whose id is already known.
- **`deleteAssets(assets)`** - deletes them from the library.
- **`albums()`**, **`album(title)`**, **`createAlbum(name, assets, move?)`** and
  **`deleteAlbums(albums, deleteAssets?)`** - the user's albums.
- **`watch()`** - an accessor of the library's latest change. On iOS it carries the inserted,
  deleted and updated assets; on Android the event is empty. Listening starts on the first call,
  which belongs after access is granted, and stops when the service's owner is disposed.

Requests pending when the calling component is disposed resolve empty (`null`, an empty list, or
nothing).

`MediaType` and `AssetField` are the module's enums, exported without loading the module, so query
code runs in a test.

iOS permission dialog text comes from the config plugin options `photosPermission` and
`savePhotosPermission`.

## Without the module

On iOS and Android, a missing `expo-media-library` (not installed, or not rebuilt since) throws a
`MissingModuleError` naming the fix when the service first reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake (`provideService(MediaLibrary.SOURCE, () => fake)` in a
`ServiceScope`), both permissions are refused; `save()`, `album()` and `createAlbum()` resolve to
`null`, `asset()` returns `null`, queries and `albums()` resolve empty, `watch()` stays `null`, and
other methods are no-ops.

## Reference

`MediaLibrary` is exported from `@solid-native/expo/solid/media-library`.

<!-- api: MediaLibrary -->
