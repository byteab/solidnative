---
title: Direction
summary: Which way round the world is, for the TypeScript the cascade cannot decide.
---

# Direction

`Direction` reports the locale's layout direction.

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { View } from '@solid-native/components/solid';
import { Direction, useService } from '@solid-native/device/solid';

export function Drawer() {
  const direction = useService(Direction);
  return <View style={direction.rtl() ? { right: 0 } : { left: 0 }} />;
}
```

The cascade already mirrors the _paint_ for `direction: rtl`. Use `Direction` for positions
computed in TypeScript, such as drag deltas or a panel's edge. `current` is `'ltr'` or `'rtl'`;
`rtl` is a boolean.

A `direction` style applies to a subtree as on the web: rows reverse, logical edges and
`text-align: start`/`end` follow it, `left`/`right` and explicit `writingDirection` stay. Without
one, text follows the app's language.

Override it for a subtree with `provideService(Direction, () => ({ current, rtl }))` or
`provideService(Direction.SOURCE, ...)` in a `<ServiceScope>`.

## Off a device and on the web

Off a device and on native, `current` reads `I18nManager.isRTL` once; `forceRTL` needs a restart.
The browser host's `Direction.SOURCE` follows `document.dir` changes.

## Reference

<!-- api: Direction -->
