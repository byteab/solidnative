---
title: Dev menu
summary: Adding switches to the shake menu in development, gone entirely in a release build.
---

# Dev menu

`DevMenu` adds shake-menu entries (mock user, feature flag, reset) in development builds. Release
builds have no shake menu, so the calls can stay.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { View } from '@solidnative/components/solid';
import { DevMenu, useService } from '@solidnative/device/solid';

export function Root() {
  const devMenu = useService(DevMenu);
  if (devMenu.available) devMenu.add('Reset onboarding', resetOnboarding);
  return <View />;
}

function resetOnboarding(): void {}
```

`available` reads `__DEV__`; check it to skip registration work in release. `add(title, handler)`
registers an item; re-adding a title replaces its handler, and disposing the component makes it
inert (items cannot be removed). `reload(reason?)` reloads the bundle.

## Off a device

Off a device and in a release build, `available` is `false` and `add()` and `reload()` do nothing.

## Reference

<!-- api: DevMenu -->
