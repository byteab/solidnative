---
title: Animation
summary: Plain CSS, AnimatedStyle, and Reanimated worklets - and when to reach for each.
art: animation
---

# Animation

There are three ways to animate, chosen by where the work needs to run.

## Plain CSS

A `.native.css` sheet can use `transition` and `@keyframes` as on the web; they compile into the
native stylesheet and apply with `withNativeStyles`. Use this to ease between states a class change
describes. (`TouchableOpacity`'s press fade uses the same native transition clock, set from code.)

```css
/* pulsing-dot.native.css */
@keyframes pulse {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 1;
  }
}
.dot {
  width: 12px;
  height: 12px;
  background-color: #3b6ef5;
  animation: pulse 900ms ease-in-out infinite;
}
```

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { View } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './pulsing-dot.native.css';

export function PulsingDot() {
  return withNativeStyles(sheet, () => <View class="dot" />);
}
```

Only the default animation direction compiles; `alternate`, `reverse` and `alternate-reverse` are
dropped with a build warning. Write the return leg into the keyframes, as `0%, 100%` and `50%` do
above.

## AnimatedStyle

`AnimatedStyle`, from `@solid-native/components/solid/animations`, drives React Native's
`Animated` graph directly (`Animated.Value`, `timing`, `spring`, interpolation), which is not React.
Import `Animated` and `Easing` from the same path and pass `AnimatedStyle` an accessor for a style
built from `Animated` nodes; it returns a ref binding for the view:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { View } from '@solid-native/components/solid';
import { Animated, AnimatedStyle } from '@solid-native/components/solid/animations';

export function FadeIn() {
  const opacity = new Animated.Value(0);
  const fade = AnimatedStyle(() => ({ opacity }));
  Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  return <View ref={fade} />;
}
```

With `useNativeDriver: true` the animation runs on the UI thread and the binding hands over the
native tag once; without it, each frame runs in JavaScript and is written to the node. Returning
`null` from the accessor detaches the style.

There is no browser backend yet: the subpath loads React Native's `Animated`, which web builds
cannot use. The main entry's `AnimatedStyle(spec, backend)` takes any `AnimationBackend`, where one
would plug in. `Presence`, also from the main entry, handles class-driven mount and unmount
transitions.

<!-- api: AnimatedStyle -->

## Reanimated worklets

`WorkletStyle` and `WorkletScroll`, from `@solid-native/components/solid/reanimated`, compute styles
every frame off the JavaScript thread: a value following a gesture, a header shrinking on scroll.
`sharedValue` creates a value both runtimes see; `workletStyle` computes a style from shared values,
bound with `WorkletStyle`; `workletScroll` runs on every scroll frame, bound with `WorkletScroll`. A
shared value written by one and read by the other never touches the JavaScript thread:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { ScrollView, View } from '@solid-native/components/solid';
import {
  sharedValue,
  workletScroll,
  workletStyle,
  WorkletScroll,
  WorkletStyle,
} from '@solid-native/components/solid/reanimated';
import type { HostChild } from '@solid-native/platform/solid';

export function ParallaxHeader(props: { children?: HostChild }) {
  const offset = sharedValue(0);
  const onScroll = workletScroll([offset], (event, into) => {
    'worklet';
    into.value = event.contentOffset.y;
  });
  const header = workletStyle([offset], (at) => {
    'worklet';
    return { height: Math.max(80, 200 - at.value) };
  });
  const scrollRef = WorkletScroll(() => onScroll);
  const headerRef = WorkletStyle(() => header);
  return (
    <ScrollView ref={scrollRef}>
      <View ref={headerRef} />
      {props.children}
    </ScrollView>
  );
}
```

Pass every value a worklet reads in the first argument and read it from the function's
parameters, not the component's closure. The closure is captured by value and sent to the other
runtime, so reaching into a larger object would send that whole object too.

<!-- api: WorkletStyle -->

<!-- api: WorkletScroll -->
