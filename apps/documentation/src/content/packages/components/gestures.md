---
title: Gestures
summary: react-native-gesture-handler's pans, pinches and rotations, without React.
art: gestures
---

# Gestures

`react-native-gesture-handler`'s gestures are recognized by the platform (a real
`UIPanGestureRecognizer`, a real Android `GestureDetector`), not by this package's touch handling
(see the [pressable page](/packages/components/pressable)). That is what makes pinches, rotations
and pans that cooperate with scroll views possible. Build a gesture with the library's `Gesture`
API and attach it with `NativeGesture`, which takes an accessor and returns a ref binding:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Gesture } from 'react-native-gesture-handler';
import { View } from '@solid-native/components/solid';
import { NativeGesture } from '@solid-native/components/solid/gestures';
import { WorkletStyle, sharedValue, workletStyle } from '@solid-native/components/solid/reanimated';

export function Draggable() {
  const x = sharedValue(0);
  const slide = workletStyle([x], (dx) => {
    'worklet';
    return { transform: [{ translateX: dx.value }] };
  });
  const pan = Gesture.Pan().onUpdate((event) => {
    'worklet';
    x.value = event.translationX;
  });
  const panRef = NativeGesture(() => pan);
  const slideRef = WorkletStyle(() => slide);
  return (
    <View
      testID="box"
      collapsable={false}
      ref={(ref) => {
        panRef(ref);
        slideRef(ref);
      }}
    />
  );
}
```

Return `null` from the accessor to detach the gesture, e.g. while another screen is in front:
`NativeGesture(() => (front() ? pan : null))`, with `front` from `useService(SCREEN_IN_FRONT)`.

## Installing

Install three native libraries at the versions this Expo SDK expects:

```sh
npx expo install react-native-gesture-handler react-native-reanimated react-native-worklets
```

Rebuild the development build (`npx expo run:ios` or `npx expo run:android`); Expo Go already
includes them. Then restart Metro: installing worklets or Reanimated adds the worklets Babel plugin,
and the Metro preset keys its cache on their versions, so a restart recompiles everything. A Metro
already running keeps its old Babel setup and serves files without worklets.

## The gesture root

Wrap the whole app in one `GestureRoot`, as `GestureHandlerRootView` in React Native:

```tsx
import { GestureRoot } from '@solid-native/components/solid/gestures';

<GestureRoot>
  <NativeStackOutlet navigation={navigation} />
</GestureRoot>;
```

On Android it is `RNGestureHandlerRootView`, a view group that intercepts touches first; on iOS
recognizers attach to the target view, so it renders a plain view. The
`@solid-native/components/solid/gestures` version also initializes the library's Fabric support; the
main entry's `GestureRoot` only renders the view.

## Imports come from their own file

`Gesture`, `Animated` and Reanimated import React Native's uncompiled source, which Node cannot
parse, so the bindings with backends wired in live on subpaths the tested main entry does not load:
`@solid-native/components/solid/gestures`, `@solid-native/components/solid/animations` and
`@solid-native/components/solid/reanimated` (see [animation](/packages/components/animation)). The
main entry, `@solid-native/components/solid`, exports `NativeGesture`, `AnimatedStyle`,
`WorkletStyle` and `WorkletScroll` taking the backend as a second argument.

## A gesture inside a scroll view that moves the same way

A vertical `ScrollView` or `VirtualList` leaves sideways pans to the gesture inside. A sideways
scroll view, such as a pager, takes the drag first, so a swipe-to-delete row inside it never sees
its swipe. Give the pager its own `Gesture.Native()` and have the row's pan block it, failing as
soon as the drag goes the pager's way:

```tsx
const pager = Gesture.Native();
const pagerRef = NativeGesture(() => pager);

<ScrollView horizontal pagingEnabled ref={pagerRef}>
  ...
</ScrollView>;
```

```ts
const swipe = Gesture.Pan()
  .activeOffsetX(-12) // a drag to the left swipes the row
  .failOffsetX(12) // a drag to the right fails it, and the pager takes it
  .failOffsetY([-10, 10]) // so does a vertical one, and the list scrolls
  .blocksExternalGesture(pager);
```

Without `failOffsetX` the pager waits for a pan that never fails, and does not page at all.

## Testing a component with gestures

Under Node there is no recogniser, so a test calls the gesture's callbacks directly.
`@solid-native/testing/register` stubs `react-native-gesture-handler` and Reanimated, so
`NativeGesture` screens render as on a device. `gestureOf(node)` returns a view's gesture, or with a
kind such as `'Pan'`, that gesture inside a composed one:

```tsx
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Gesture } from 'react-native-gesture-handler';
import { View } from '@solid-native/components/solid';
import { NativeGesture } from '@solid-native/components/solid/gestures';
import { cleanup, gestureOf, render, screen } from '@solid-native/testing';

afterEach(cleanup);

test('a pan reports its movement', () => {
  let moved = 0;
  function Card() {
    const pan = Gesture.Pan().onUpdate(() => moved++);
    return <View testID="card" ref={NativeGesture(() => pan)} />;
  }
  render(Card);
  gestureOf(screen.getByTestId('card'), 'Pan').callbacks['onUpdate']!();
  assert.equal(moved, 1);
});
```

See [the testing setup](/packages/testing/setup) for running tests under that register.
