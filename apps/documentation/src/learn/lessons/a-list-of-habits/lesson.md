---
title: A list of habits
---

One card is a design. The tracker needs one per habit, drawn from data. The data is a signal and
the cards come from `<For>`, as in any Solid app. The part worth knowing is what that turns into on
a phone.

## Draw a card for every habit

Keep the habits in a signal, and draw the card for each with `<For>`, imported from
`@solid-native/platform/solid` along with `withNativeStyles`:

```tsx
import { createSignal } from 'solid-js';
import { For, withNativeStyles } from '@solid-native/platform/solid';

interface Habit {
  readonly id: string;
  readonly name: string;
  readonly done: boolean;
}

export function App() {
  const [habits] = createSignal<readonly Habit[]>([
    { id: 'water', name: 'Drink water', done: false },
    { id: 'read', name: 'Read ten pages', done: false },
    { id: 'walk', name: 'Walk', done: true },
  ]);
  // ...
}
```

<!-- prettier-ignore -->
```tsx
<For each={habits()}>
  {(habit) => (
    <View class="habit">
      <Text>{habit.name}</Text>
      <Text class="status">To do</Text>
    </View>
  )}
</For>
```

Every card is a set of native views, created when its habit appears and destroyed when it goes.
`<For>` keeps a row's views for as long as its item is the same object, and moves them when the
list is reordered, rather than tearing them down and building them again, which on a phone is the
expensive part. Replace an item with a changed copy, as the next lesson does, and that row alone
gets new views. The `id` is not for `<For>`: it is how the app tells two habits apart, which
matters once two can share a name.

## Say what is done, and what is left

Show each habit's status, replace the hand-written 3 with a count of what is left, and give the
`<For>` a `fallback` for when there are no habits at all:

```tsx
<Text class="status">{habit.done ? 'Done' : 'To do'}</Text>
```

```tsx
const remaining = createMemo(() => habits().filter((habit) => !habit.done).length);
```

<!-- prettier-ignore -->
```tsx
<Text class="summary">{remaining()} left to do</Text>
<For each={habits()} fallback={<Text class="summary">No habits yet</Text>}>
  ...
</For>
```

Import `createMemo` from `solid-js` alongside `createSignal`. Only the text that reads
`remaining()` changes when the list does: Solid updates that one native text, and nothing else is
rendered again.

## Let the list scroll

A native screen does not scroll on its own, the way a web page does. Content taller than the screen
is cut off unless it is inside a `<ScrollView>`. Import `ScrollView`, and put the `<For>` inside
one, with the title and the count above it so they stay where they are while the habits move:

<!-- prettier-ignore -->
```tsx
<Text class="summary">{remaining()} left to do</Text>
<ScrollView contentContainerStyle={{ gap: 8 }}>
  <For each={habits()} fallback={...}>
    ...
  </For>
</ScrollView>
```

A native scroll view is two views: the frame, which stays the size it is given, and a content
container inside it, which grows with the rows and moves when they scroll. A `class` or `style` on
`<ScrollView>` styles the frame. `contentContainerStyle` styles the content container, so padding
and gaps between the rows go there, as numbers in the same units as `px` in a stylesheet. The frame
grows to fill the space left under the count by default, as React Native's own scroll view does.

To see it scroll, add a few more habits to the signal for a moment, then take them out again: the
lessons after this one start from these three.

Every row in a scroll view is a real native view, all the time, including the ones off screen. A
very long list wants [`<VirtualList>`](/packages/components/lists) instead, which works out which
rows are on screen, plus a small buffer, and only those rows exist as native views.
