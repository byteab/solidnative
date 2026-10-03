---
title: Permissions
summary: Permission turns any Expo module's get/request pair into Solid accessors.
---

# Permissions

Expo modules expose permissions as `getXPermissionsAsync`, `requestXPermissionsAsync`, and a
`useXPermissions()` hook combining them with React state. `Permission` rebuilds that hook as Solid
accessors for any module's pair, so the module stays your app's own dependency.
[`ImagePicker`](/packages/expo/image-picker), [`Location`](/packages/expo/location) and
[`Camera`](/packages/expo/camera) are built on it. It lives on the bare `@solidnative/expo/solid`
import.

## Install

Nothing extra: use it with whichever module's permission functions you call.

```ts
import { Permission } from '@solidnative/expo/solid';
```

## The smallest thing that works

```tsx
import * as Camera from 'expo-camera';
import { createSignal } from 'solid-js';
import { Pressable, Text } from '@solidnative/components/solid';
import { Permission } from '@solidnative/expo/solid';

export function Scanner() {
  const camera = Permission.of(
    Camera.Camera.getCameraPermissionsAsync,
    Camera.Camera.requestCameraPermissionsAsync,
  );
  const [scanning, setScanning] = createSignal(false);
  const scan = async () => {
    if (await camera.ensure()) setScanning(true);
  };
  return (
    <Pressable onPress={scan}>
      <Text>{scanning() ? 'Scanning' : camera.status()}</Text>
    </Pressable>
  );
}
```

## Building one

**`Permission.of(get, request)`** returns a `Permission`; constructing it does not touch the
platform. It must be built under a Solid owner (a component body, a `createRoot`, a service
factory) or it throws; when the owner is disposed, an in-flight check or request resolves to
`false` and its late answer is dropped. `new Permission({ get, request })` takes a `PermissionApi`
object instead.

```ts
const notifications = Permission.of(getPermissionsAsync, requestPermissionsAsync);
```

## Reading and asking

- **`status`** (accessor) - `'granted'`, `'denied'`, `'undetermined'` (asked, person has not
  decided), or **`'unknown'`** (the platform has not been asked yet).
- **`granted`** (accessor) - whether it is currently granted.
- **`blocked`** (accessor) - true once the platform will no longer show a dialog; send the person to
  Settings instead.
- **`check()`** - reads the current state without showing anything.
- **`request()`** - shows the dialog and resolves to whether it was granted.
- **`ensure()`** - what most call sites want: checks first if nothing has asked yet, returns `true`
  if granted, `false` if blocked (without a pointless second ask), and otherwise shows the dialog.

A newer `check()` or `request()` outranks an older one, so a late answer never overwrites a fresher
one.

## Reference

<!-- api: Permission -->
