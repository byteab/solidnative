---
title: Keyboard
summary: The software keyboard's height, position and animation timing.
---

# Keyboard

`Keyboard` reports the software keyboard's height, top edge and animation timing. It stays
subscribed for its scope's life, so late-mounting components get the current height.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { View } from '@solidnative/components/solid';
import { Keyboard, useService } from '@solidnative/device/solid';

export function Composer() {
  const keyboard = useService(Keyboard);
  return <View style={{ marginBottom: keyboard.height() + 16 }} />;
}
```

`metrics` holds everything reported, including `duration` and `easing`; `height` and `visible`
derive from it. `dismiss()` hides the keyboard.

## When it changes

- **iOS**: as it starts to move (`keyboardWill*` events), with its `duration` and `easing`; a hide
  reports `{ height: 0, duration, easing }`, and a frame change while up (the predictive bar)
  reports the new size.
- **Android**: after it arrives (`keyboardDid*`), with `duration` zero.

To move with the keyboard on iOS, pass its timing to [`LayoutAnimation`](/packages/device/layout-animation)
before the change, as `<KeyboardAvoidingView>` does:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createEffect, createSignal } from 'solid-js';
import { View } from '@solidnative/components/solid';
import {
  Keyboard,
  LayoutAnimation,
  useService,
  type LayoutEasing,
} from '@solidnative/device/solid';

export function Composer() {
  const keyboard = useService(Keyboard);
  const layoutAnimation = useService(LayoutAnimation);
  const [clearance, setClearance] = createSignal(16);

  createEffect(() => {
    const { height, duration, easing } = keyboard.metrics();
    const move = () => setClearance(height + 16);
    if (!duration) return move();
    void layoutAnimation.animate(move, {
      duration,
      easing: easing as LayoutEasing,
      appear: 'none',
      leave: 'none',
    });
  });

  return <View style={{ marginBottom: clearance() }} />;
}
```

## Off a device and on the web

Off a device `metrics` stays `{ height: 0 }`. On the web `dismiss()` only blurs the focused element.

## Reference

<!-- api: Keyboard -->
