---
title: Layout and views
summary: View, Yoga's flexbox defaults, and safe area insets.
art: layout
---

# Layout and views

`View` is the plain flexbox box. It has only the shared props; everything else comes from `style`,
`class` and the component's `.native.css` sheet.

```tsx
import { Text, View } from '@solidnative/components/solid';

<View class="card" style={{ backgroundColor: tint() }}>
  <Text>Card content</Text>
</View>;
```

<!-- api: View -->

## Yoga, not CSS

Every element lays out with Yoga, React Native's flexbox: no `display: block`, no inline
formatting, no opting out of flex. Yoga's defaults differ from the browser's:
`display: flex; flex-direction: column; align-items: stretch; flex-shrink: 0`, so unstyled `View`s
stack vertically and stretch to the parent's width. Write `flex-direction: row` where you need it.

`Text` is the one element that is not a flex container, since its content lays out as text
(wrapping, nested runs on a shared baseline). It is still a flex child of its parent.

## Safe area

`SafeAreaProvider` and `SafeAreaView` keep content clear of the notch, status bar and home
indicator; see [Safe area](/packages/components/safe-area).

## Escape hatches

Every primitive's `ref` callback receives a `NativeRef` for its native node, for reaching past the
component API (e.g. issuing a native command). It exposes `.node`, `isAttached()`,
`dispatchCommand()`, `focus()` and `measure()`; commands wait for the next host commit and are
no-ops once the view is gone. Custom native view adapters build one with `createNativeRef`.

```tsx
let card: NativeRef | undefined;

<View ref={(ref) => (card = ref)} />;
```

<!-- api: createNativeRef -->
