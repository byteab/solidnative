---
title: Hardware back
summary: Claiming Android's hardware back button, and letting the platform decide when nobody does.
---

# Hardware back

`HardwareBack` claims Android's back button. A handler returns `true` if it consumed the press;
`false` lets the platform act, backgrounding the app at the bottom of a stack.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { View } from '@solidnative/components/solid';
import { HardwareBack, useService } from '@solidnative/device/solid';

export function UnsavedForm() {
  const [dirty, setDirty] = createSignal(false);
  // Unsubscribed automatically when this component is disposed.
  useService(HardwareBack).handle(() => {
    if (!dirty()) return false;
    confirmDiscard();
    return true;
  });
  return <View />;
}

function confirmDiscard(): void {}
```

`handle(handler)` returns an unsubscribe. The newest handler runs first. `BackHandler` is an alias.

`@solidnative/router`'s `bindNativeNavigation(navigation, { back })` already handles stacks and
tabs (see [Tabs](/packages/router/tabs)); overlays are the other usual caller.

## Off a device and on the web

Off a device, on iOS and on the web the handler never runs.

## Reference

<!-- api: HardwareBack -->
