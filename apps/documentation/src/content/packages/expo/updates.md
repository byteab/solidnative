---
title: Updates
summary: Checking for and downloading an OTA update, and applying it on the app's own terms.
---

# Updates

`Updates` checks for and downloads an OTA update in one call, wired to `expo-updates`. Applying one
**restarts the app**, so the app learns an update is ready and picks a moment the user loses
nothing.

## Install

```sh
npx expo install expo-updates
```

```ts
import { Updates } from '@solidnative/expo/solid/updates';
```

## The smallest useful example

```tsx
import { createEffect } from 'solid-js';
import { AppState, useService } from '@solidnative/device/solid';
import { Updates } from '@solidnative/expo/solid/updates';

export function UpdateOnForeground() {
  const updates = useService(Updates);
  const appState = useService(AppState);

  // On foreground, where a restart costs the user nothing.
  createEffect(() => {
    if (appState.active()) void refreshApp();
  });

  async function refreshApp() {
    if (await updates.check()) await updates.apply();
  }

  return null;
}
```

## `check()`

Checks and downloads any update, resolving to whether one is now waiting (checking without
downloading is useless to an app). `state()` moves through `'checking'` then `'downloading'`; a
failure lands in `error()` and sets `state()` to `'error'` rather than throwing.

## `apply()`

Restarts the app into the downloaded update. Does nothing unless `state()` is `'ready'`, so call it
after `check()` resolves `true` or `ready()` is true. **This restarts the app**, so nothing calls it
automatically: pick the moment - not mid-form or mid-upload, usually on next foreground.

## State

- **`state`** - an accessor: `'idle'`, `'checking'`, `'downloading'`, `'ready'` or `'error'`.
- **`ready`** - `true` exactly when `state()` is `'ready'`.
- **`error`** - whatever `check()` caught, or `null`.
- **`enabled`** - whether updates are enabled. **False in development and in Expo Go**, where the
  bundle comes from Metro; hide any "update available" banner then. `check()` resolves `false`
  without doing anything, so it is safe to call unconditionally.

## Without the module

On iOS and Android, a missing `expo-updates` (never installed, or not rebuilt since) throws a
`MissingModuleError` when the service first reaches for it, naming the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, it behaves as in Expo Go: `enabled` is `false`, `check()`
resolves `false`, and `apply()` does nothing. A test supplies a `NativeUpdates` fake with
`provideService(Updates.SOURCE, () => fake)`.

A `check()` still running when the calling component is disposed resolves `false`, and a newer
`check()` supersedes an older one.

## Reference

`Updates` is exported from `@solidnative/expo/solid/updates`.

<!-- api: Updates -->
