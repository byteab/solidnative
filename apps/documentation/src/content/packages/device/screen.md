---
title: Screen
summary: The window `Screen` tracks, the physical display, orientation, and the `compact` breakpoint.
---

# Screen

`Screen` tracks the window, physical display and orientation.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Text } from '@solidnative/components/solid';
import { Screen, useService } from '@solidnative/device/solid';

export function Frame() {
  const screen = useService(Screen);
  return <Text>{screen.window().width}pt wide</Text>;
}
```

`window` uses the [safe area](/packages/device/safe-area) provider's frame, since Android 15's
`Dimensions` excludes the system bars (838.5pt vs a drawable 914.3pt on a 1080x2400 phone);
`Dimensions` is only the fallback without a provider. `display` is the physical screen.
`orientation` follows `window`.

## The `compact` breakpoint

`compact` is whether the window is narrow enough to want the phone tree rather than the tablet one:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Screen, useService } from '@solidnative/device/solid';
import { Show } from '@solidnative/platform/solid';
import { SidebarLayout, TabBarLayout } from './layouts.solid.tsx';

export function Shell() {
  const screen = useService(Screen);
  return (
    <Show when={screen.compact()} fallback={<SidebarLayout />}>
      <TabBarLayout />
    </Show>
  );
}
```

Use `compact` to pick _components_; for styling, use `md:`. `COMPACT_WIDTH` is 768, matching
Tailwind's `md`. An iPad mini in portrait (744pt) counts as compact.

## Off a device and on the web

Off a device sizes are zero, `orientation` is `portrait` and `compact` is `true`. On the web, media
queries and viewport units use the same values.

## Reference

<!-- api: Screen -->
