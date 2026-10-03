---
title: Pressable
summary: Pressable, TouchableOpacity, and the touch responder negotiation behind them.
art: pressable
---

# Pressable

React Native negotiates a _responder_ for each touch: views under the finger are asked outside-in
whether they want to claim it, then inside-out whether they will take it. That is how a scroll view
claims a drag from a button inside it, and how a nested pressable beats its container.
`onPress`, `onPressIn`, `onPressOut` and `onLongPress` are built on this negotiation, as React
Native's `Pressability` does, not on plain touch listeners.

A touch held for `delayLongPress` (default 500ms) fires `onLongPress` instead of `onPress`, only if
`onLongPress` is passed; otherwise a slow tap is still an `onPress`.

## Pressable

`Pressable` is a plain view with the press machinery. `style` and `children` may be functions of
`PressableState` (`{ pressed, hovered }`):

```tsx
<Pressable style={(state) => ({ opacity: state.pressed ? 0.6 : 1 })} onPress={openDetail}>
  <Text>Tap me</Text>
</Pressable>
```

`TouchableOpacity` fades to `activeOpacity` (default `0.2`) while pressed via a native transition
with React Native's timings (150ms in, 250ms out), and adds a `pressed` class while held.

## Props

Every pressable takes `disabled`, `hitSlop` (how far outside the view a touch may _start_),
`pressRetentionOffset` (how far a finger may wander before cancelling), `delayLongPress`,
`delayPressIn`, `delayPressOut`, `minPressDuration` (minimum pressed look, default 130ms) and
`cancelable` (whether a scrolling ancestor may take the gesture). There is no `android_ripple`.

## Nested pressables

Nested pressables (a row with a delete button) need nothing extra: the innermost one that wants the
touch wins, so tapping the button never presses the row. Plain `onTouchStart` and `onTouchEnd` are
not negotiated and still bubble; call `event.stopPropagation()` to stop them.

## Composing pressability onto a component

A component that _is_ pressable, such as a custom button, returns a `Pressable` and forwards its
props, typed with `PressableProps` or `PressBehaviorProps`. Put `accessibilityRole` (or `role`),
`accessibilityState` and `aria-*` on the same element, so one view takes the touch and announces the
role.

```tsx
function PrimaryButton(props: PressableProps & { label: string }) {
  return (
    <Pressable accessibilityRole="button" class="button" {...props}>
      <Text class="label">{props.label}</Text>
    </Pressable>
  );
}
```

<!-- api: Pressable -->

<!-- api: TouchableOpacity -->
