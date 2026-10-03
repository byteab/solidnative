---
title: App state
summary: Whether the app is in front of the user, for anything that should stop when it is not.
---

# App state

`AppState` reports `active`, `background`, or (iOS only) `inactive` - app switcher, incoming call,
notification shade.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createEffect } from 'solid-js';
import { View } from '@solidnative/components/solid';
import { AppState, useService } from '@solidnative/device/solid';

export function VideoPlayer(props: { onPause: () => void }) {
  const appState = useService(AppState);
  createEffect(() => {
    if (!appState.active()) props.onPause();
  });
  return <View />;
}
```

To pause polls, video or timers, check `active()`: an `inactive` app is not in front either.
`current()` returns the full `AppStatus`.

## Off a device and on the web

Off a device `current` is always `active`. On the web, read `document.visibilityState` directly.

## Reference

<!-- api: AppState -->
