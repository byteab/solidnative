---
title: Status bar
summary: A stack of claims on the status bar's style, visibility and color, not a setter.
---

# Status bar

`StatusBar` is a stack of claims, so closing a modal restores the screen's own bar.

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { View } from '@solid-native/components/solid';
import { useStatusBar } from '@solid-native/device/solid';

export function PhotoViewer() {
  // Claimed while this screen is in front; released when the component is disposed.
  useStatusBar(() => ({ style: 'light', hidden: true }));
  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}
```

`useStatusBar(state)` claims while its screen is in front. Via `useService(StatusBar)`, `set()`
replaces the base claim and `push()` adds one, returning its remover. `state` merges all claims,
later ones winning.

`StatusBarState` takes `style` (`'default' | 'light' | 'dark'`, `'light'` meaning light _content_
for a dark bar, as CSS would), `hidden`, `animated`, and two Android-only properties: `backgroundColor`
(iOS has no such thing) and `translucent` (whether content draws underneath the bar).

`height` is zero on iOS; use [`SafeArea`](/packages/device/safe-area)'s top inset there.
`expo-status-bar` can be used alongside this service.

## Off a device and on the web

Off a device and on the web, claims do nothing and `height` stays zero.

## Reference

<!-- api: StatusBar -->
