---
title: Android permissions
summary: A common shape for Android's runtime permissions, granted outright on iOS.
---

# Android permissions

`androidPermission(name)` returns a `[check, request]` pair for one Android permission. Both resolve
to `{ status, granted, canAskAgain }`, with `status` one of `granted`, `denied` or `undetermined`.

```ts
import { androidPermission } from '@solid-native/device/solid';

const [check, request] = androidPermission('android.permission.CAMERA');

if (!(await check()).granted && !(await request()).granted) {
  // The user said no. Show them what the feature would have done, not an error.
}
```

`check()` reports a not-granted permission as `undetermined`, since `PermissionsAndroid.check`
cannot tell denied from never asked. `request()` maps `never_ask_again` to `canAskAgain: false`;
other refusals keep it `true`.

Results match Expo modules' permission records. Expo modules request their own permissions; use
this only for one they do not cover, such as `POST_NOTIFICATIONS`.

## Off a device and on iOS

On iOS and off a device everything resolves `granted` without asking.

`androidPermission` is a plain function needing no `ServiceScope`; `PermissionAnswer` is its return
shape. Tests use `androidPermissionOf(native, name)`, taking a `PermissionsAndroid` or `null`.
