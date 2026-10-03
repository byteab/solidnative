---
title: Layout animation
summary: Animating a layout change - a list insertion, a row leaving - which CSS cannot express.
---

# Layout animation

`LayoutAnimation` animates the next layout change instead of snapping to it.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, Text, View } from '@solidnative/components/solid';
import { LayoutAnimation, useService } from '@solidnative/device/solid';
import { For } from '@solidnative/platform/solid';

export function TodoList() {
  const layout = useService(LayoutAnimation);
  const [rows, setRows] = createSignal(['Milk', 'Eggs', 'Bread']);

  const removeRow = (id: string) =>
    void layout.animate(() => setRows((current) => current.filter((row) => row !== id)));

  return (
    <View>
      <For each={rows()}>
        {(row) => (
          <Pressable onPress={() => removeRow(row)}>
            <Text>{row}</Text>
          </Pressable>
        )}
      </For>
    </View>
  );
}
```

A CSS `transition` cannot animate rows that Yoga moves, since they have no old value.
`animate(change, options?)` applies `change` and resolves when the animation ends (on Android, after
the duration plus a margin) or when the component is disposed.

`LayoutChange` takes `duration` (300ms default), `easing` (`'spring' | 'linear' | 'easeInEaseOut' |
'easeIn' | 'easeOut' | 'keyboard'`, default `'easeInEaseOut'`; `'spring'` is the platform's own,
used by native lists, and `'keyboard'` is iOS's keyboard curve), and `appear`/`leave`
(`'opacity' | 'scaleXY' | 'none'`, both defaulting to `'opacity'`) for views appearing or leaving.

For a single property, use a `transition` or a [worklet style](/packages/components/animation).

## Off a device

Off a device `animate()` still runs the change and resolves, without animating.

## Reference

<!-- api: LayoutAnimation -->
