---
title: Background task
summary: Register work for the platform to run while the app is in the background.
---

# Background task

`BackgroundTask` registers work for the platform to run while the app is in the background, using
`expo-background-task`: WorkManager on Android, BGTaskScheduler on iOS.

The platform decides when a task runs. The interval is a minimum, not a schedule, and iOS picks
its own windows, such as overnight. Use it for work that can wait: syncing, pruning a cache,
refreshing content.

## Install

```sh
npx expo install expo-background-task expo-task-manager
```

```ts
import { BackgroundTask } from '@solid-native/expo/solid/background-task';
```

## Defining the task

A background task runs through `expo-task-manager`, which evaluates the app's entry module but
does not run the app, so no Solid root is mounted. Only a launch with a screen runs the
`AppRegistry.registerRunnable` callback in the entry module (`src/main.solid.ts`). Define the task
at the top level of that module, beside the registration, without components or `useService()`
(which needs an owner):

```ts
// src/main.solid.ts
import { AppRegistry } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { BackgroundTaskResult } from '@solid-native/expo/solid/background-task';

TaskManager.defineTask('sync', async () => {
  try {
    // Plain functions and modules only: fetch, write to storage, update the badge.
    return BackgroundTaskResult.Success;
  } catch {
    return BackgroundTaskResult.Failed;
  }
});

AppRegistry.registerRunnable('main', ({ rootTag }) => {
  // mount the Solid app as before
});
```

The `@solid-native/*` packages have no native side effects on import, so the task can share plain
modules (a storage wrapper, an API client) with the app, as long as they do not need
`useService()`.

## The smallest useful example

Register the task from any component:

```tsx
import { useService } from '@solid-native/device/solid';
import { Pressable, Text } from '@solid-native/components/solid';
import { BackgroundTask, BackgroundTaskStatus } from '@solid-native/expo/solid/background-task';

export function SyncSettings() {
  const tasks = useService(BackgroundTask);

  async function enable() {
    if ((await tasks.status()) !== BackgroundTaskStatus.Available) return;
    await tasks.register('sync', { minimumInterval: 60 });
  }

  return (
    <Pressable onPress={() => void enable()}>
      <Text>Sync in the background</Text>
    </Pressable>
  );
}
```

## What it does

- **`status()`** - `BackgroundTaskStatus.Available` on a device, `Restricted` on the web.
- **`register(name, options?)`** - asks the platform to run the task of that name, defined with
  `expo-task-manager`. `minimumInterval` is in minutes: twelve hours by default, at least fifteen.
- **`unregister(name)`** - stops the platform running it.
- **`triggerForTesting()`** - runs every registered task now, in a debug build. `false` in a
  release build.

`BackgroundTaskStatus` and `BackgroundTaskResult` are the module's enums, exported without loading
the module so code using them runs in a test.

On iOS, background processing needs the `processing` background mode and the module's scheduler
identifier in `BGTaskSchedulerPermittedIdentifiers`. The module's config plugin adds both, so
rebuild the development build after installing it.

## Without the module

On iOS and Android, a missing `expo-background-task` (never installed, or not rebuilt since)
throws a `MissingModuleError` when the service first reaches for it, naming the module and the
fix; see [Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake (`provideService(BackgroundTask.SOURCE, () => fake)` in a
`ServiceScope`), `status()` resolves to `BackgroundTaskStatus.Restricted`, `register()` and
`unregister()` resolve without doing anything, and `triggerForTesting()` resolves to `false`.

## Reference

`BackgroundTask` is exported from `@solid-native/expo/solid/background-task`.

<!-- api: BackgroundTask -->
