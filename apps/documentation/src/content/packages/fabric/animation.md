---
title: Animation and transitions
summary: How transitions, Presence enter/leave classes and @keyframes actually run with no DOM.
---

# Animation and transitions

React Native has no CSS animation engine, so the engine provides three mechanisms: `transition`,
`Presence`'s enter and leave classes from `@solid-native/components/solid` (built on the other
two), and `@keyframes`/`animation`, played independently of transitions.

## Transitions

A `transition` compiles to a spec the engine drives in JavaScript, interpolating from the old
value to the new on a `requestAnimationFrame` loop and committing each frame. Numbers interpolate
directly, colors per channel, lengths and angles only when both ends share a unit
(`translateY(10%)` to `translateY(100%)` works; `10%` to `20px` does not). A named color (`'red'`)
does not interpolate, because the compiler emits `rgb()`; write `rgb()` to animate it.

## Enter and leave: `Presence`

`Presence` keeps a view on screen through its exit: it renders a `View` with `enterClass` when
`when` turns true, and swaps in `leaveClass` then removes the view when it turns false. Style those
classes with a `transition` or `animation`:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Presence, Text } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './toast.native.css';

export function Toast(props: { open: boolean; message: string }) {
  return withNativeStyles(sheet, () => (
    <Presence
      when={props.open}
      class="toast"
      enterClass="toast-enter"
      leaveClass="toast-leave"
      enterDuration={200}
      leaveDuration={200}
    >
      <Text>{props.message}</Text>
    </Presence>
  ));
}
```

`Presence` waits the given milliseconds after the commit, then calls `onEntered`, or removes the
view and calls `onExited`; there is no `transitionend`, so match the CSS durations. Without a
duration the phase ends at the next commit. Turning `when` back on mid-leave keeps the same view and
its descendants' state.

## `@keyframes` and `animation`

`animation: spin 1s linear infinite` plays on any element, as do the longhands `animation-name`,
`animation-duration`, `animation-timing-function`, `animation-delay`, `animation-iteration-count`,
`animation-direction`, `animation-fill-mode` and `animation-play-state`. They apply in written
order, as in CSS: a longhand after the shorthand changes only its part; a shorthand resets it:

```css
.spinner {
  animation: spin 1s linear infinite;
  animation-duration: 2s; /* still spin, linear and infinite, now over 2s */
}
```

A duration or delay can be a token, or `calc()` with tokens, which is how a list staggers rows:
`animation-delay: calc(var(--i) * 60ms)` with `style={{ '--i': index() }}` on each row of a
`<For>`. A time token is read in milliseconds whatever its unit.

An `animation-timing-function` inside a keyframe eases to the next keyframe, as in CSS (Tailwind's
`animate-bounce`). A keyframe with `transform: none` eases to the identity of the translate, scale,
rotate and skew functions beside it (a percent translate to `0%`); a `perspective()` is kept.

`animation-direction` takes `normal`, `reverse`, `alternate` and `alternate-reverse`; a fill holds
the frame the last iteration finished on.

`animation-play-state: paused` holds the current frame and `running` resumes; neither restarts. A
rule of its own such as `.held { animation-play-state: paused }` holds a carousel while a finger is
down. An animation that starts paused shows its first frame.

`animation-name: none` (or `animation: none`) stops an animation a weaker rule started, and a rule
with durations but no name plays nothing, as in a browser. One constraint, whichever spelling:

- Only one animation per rule, so `animation-name` takes one name and the shorthand one entry. Two
  would need two players and a rule for what happens when they touch the same property, which
  nothing here implements. The other longhands may be lists; the first entry pairs with the name.

Anything beyond that is dropped with a build warning; only that declaration goes.

The `transition-*` longhands (`transition-property`, `transition-duration`,
`transition-timing-function`, `transition-delay`) follow the same order rule, pair by position with
a shorter list repeating, and override `transition` when written after it, even back to `0s`. A
timing longhand also cascades alone, as in a browser, onto a transition another rule names, so
Tailwind's `transition duration-300 ease-linear` runs for 300ms; such a rule takes one value.

## Scroll-driven animations

`animation-timeline: scroll()` drives a `@keyframes` animation by the nearest scroll view's offset
instead of the clock. The keyframes go to React Native's animated module, which moves the view with
the scroll and no JavaScript in between, so a collapsing header follows the finger exactly.

```css
@keyframes collapse {
  to {
    opacity: 0;
    transform: translateY(-40px) scale(0.9);
  }
}
.hero {
  animation: collapse linear both;
  animation-timeline: scroll();
  animation-range: 0 160px;
}
```

- `scroll()` and `scroll(nearest)` follow the block axis (vertical on native); `scroll(inline)` or
  `scroll(x)` follows a horizontal scroll view. `scroll(root)`, `scroll(self)`, `view()` and named
  timelines are dropped with a warning.
- `animation-range` (and `-start`/`-end`) takes points or a percentage of the scroll distance,
  default the whole scroll. The distance is known only after the first scroll event; until then a
  percentage or missing end leaves the animation at its start. The named ranges (`entry`, `cover`)
  belong to `view()` and are dropped.
- The offset is the content offset. With `contentInsetAdjustmentBehavior: automatic` under a
  translucent header the view rests at a negative offset, so a range from 0 starts once the content
  passes the inset.
- The timing function eases each keyframe segment, as on the clock; `linear` is usually right.
- `animation-fill-mode` and `reverse` work as in CSS. Duration, delay and iteration count are
  unused.
- Native animates `opacity` and the transforms (`transform`, `translate`, `rotate`, `scale`); a
  percent translate or any other property holds its first frame, with a development warning.

## Where a commit for this comes from

No signal changes on a transition frame, so Solid schedules no commit. While anything animates,
the native root runs its own `requestAnimationFrame` loop and commits once per frame. See [the
renderer](/packages/platform/renderer) for normal scheduling.
