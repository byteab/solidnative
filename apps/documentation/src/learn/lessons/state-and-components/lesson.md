---
title: Touch
---

A phone has no click. A finger goes down, may move, and comes up, and the responder system decides
which view the touch belongs to. `<Pressable>` is the view that takes part in that: it claims the
touch, works out with nested controls and scrolling ancestors which of them keeps it, and calls
`onPress` when a short touch ends without being canceled.

## Tick a habit off

Make each card a `<Pressable>`, import `Pressable`, and flip the habit in the signal when it is
pressed. The signal needs its setter now:

<!-- prettier-ignore -->
```tsx
<Pressable class="habit" accessibilityRole="button" onPress={() => toggle(habit.id)}>
  ...
</Pressable>
```

```tsx
const [habits, setHabits] = createSignal<readonly Habit[]>([...]);

const toggle = (id: string) =>
  setHabits((list) =>
    list.map((habit) => (habit.id === id ? { ...habit, done: !habit.done } : habit)),
  );
```

Toggling by `id` rather than `name` is what keeps this correct once two habits can share a name:
matching on `name` would flip every habit called the same thing at once.

`accessibilityRole="button"` is what VoiceOver and TalkBack announce, and what a screen reader user
can activate: there is no `<button>` element to carry the role, so the pressable says it.

A touch that wanders too far before lifting is canceled, and is not a press. How far it may go is
`pressRetentionOffset`, which reaches past the card's visible edge, so crossing the edge does not
cancel the press straight away. A touch held past the long-press delay calls `onLongPress` instead
of `onPress`.

## Show the press

A card that gives nothing back under a finger feels broken. The engine applies `:active` to the
view holding the touch responder and to its ancestors. Here the pressable claims the touch, so
`.habit:active` changes the card the moment it is touched:

```css
.habit:active {
  background-color: #e4e4e7;
}
```

It is written as on the web, but set by the engine from the responder rather than by a browser. It
clears when the touch is released or canceled, or when another view, such as a scroll view starting
to scroll, takes the touch over.

## Give each row a component of its own

Move the card into `habit-row.tsx` as a `HabitRow` component, with its rules in
`habit-row.native.css`, which it passes to `withNativeStyles` itself. Its props are the habit's
`name`, whether it is `done`, and an `onToggle` the pressable calls:

```tsx
export interface HabitRowProps {
  readonly name: string;
  readonly done?: boolean;
  readonly onToggle?: () => void;
}

export function HabitRow(props: HabitRowProps) {
  return withNativeStyles(sheet, () => (
    <Pressable class="habit" accessibilityRole="button" onPress={() => props.onToggle?.()}>
      <Text>{props.name}</Text>
      <Text class="status">{props.done ? 'Done' : 'To do'}</Text>
    </Pressable>
  ));
}
```

Read the props as `props.name`, not by destructuring them at the top: Solid's props are live, and
reading one inside the JSX is what keeps that one text up to date when it changes. Then, in
`app.tsx`:

```tsx
<HabitRow name={habit.name} done={habit.done} onToggle={() => toggle(habit.id)} />
```

Look at it in X-ray. A Solid component is a function, not an element: `HabitRow` adds no native view
of its own, and the pressable it returns is a direct child of the scroll view's content container.
