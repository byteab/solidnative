---
title: Safe area insets
summary: The insets `SafeArea` reports, and how `<SafeAreaProvider>` feeds them in.
---

# Safe area insets

`SafeArea` reports the edge insets taken by the notch, system bars, home indicator and cutouts.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, Text } from '@solidnative/components/solid';
import { SafeArea, useService } from '@solidnative/device/solid';

export function FloatingButton(props: { onPress: () => void }) {
  const safeArea = useService(SafeArea);
  return (
    <Pressable style={{ marginBottom: safeArea.insets().bottom + 16 }} onPress={props.onPress}>
      <Text>Compose</Text>
    </Pressable>
  );
}
```

Insets are reported by `<SafeAreaProvider>` (in `@solidnative/components`) one frame after mount.
The first provider feeds the scope's `SafeArea`; nested ones, or `reportInsets={false}`, create a
local one with `createSafeArea()`.

`insets` is `{ top, right, bottom, left }` in points, zero until measured. `frame` is the
provider's area, used by [screen](/packages/device/screen)'s `window`. `known()` says whether a
measurement has arrived.

Prefer [`<SafeAreaView>`](/packages/components/safe-area) or the `--safe-area-inset-*` tokens.
Only the provider calls `report()`; tests override `SafeArea.SOURCE`.

## Off a device and on the web

Off a device and on the web, `insets` stays zero and `known()` stays `false`.

## Reference

<!-- api: SafeArea -->
