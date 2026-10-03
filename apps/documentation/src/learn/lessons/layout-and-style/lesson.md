---
title: Layout and style
---

A `.native.css` file is CSS, and on a phone it is compiled when the app is built: each rule
becomes a native style the engine matches against the elements of the components that pass the
sheet to `withNativeStyles`, so one component's `.title` never reaches another's.

Layout is flexbox, computed by Yoga, React Native's layout engine. Every `<View>` is a flex
container, and Yoga's defaults are not a browser's: `flex-direction: column`, `align-items: stretch`
and `flex-shrink: 0`. Children run top to bottom and stretch to the width of their parent unless it
says otherwise, and none of them shrinks to make room, so a long text beside another control in a
row needs `flex-shrink: 1` (or `flex: 1`) before it wraps rather than pushing past the edge.

## Make the title a title

Give the first `<Text>` a class, and style the class in `app.native.css`:

```tsx
<Text class="title">Today</Text>
```

```css
.title {
  font-size: 30px;
  font-weight: 700;
}
```

It is `class`, as in HTML, not React's `className`. These examples use `px`. The compiler turns
them into the density-independent units native layout uses, points on iOS and density-independent
pixels on Android, so `30px` is the same size on every screen density rather than 30 physical
pixels. `rem`, `em`, percentages and the viewport units work too.

## Put a habit in a card

A row is a `<View>` whose children run left to right. Add one under the two lines of text, with a
habit and its status in it:

```tsx
<View class="habit">
  <Text>Drink water</Text>
  <Text class="status">To do</Text>
</View>
```

```css
.habit {
  flex-direction: row;
  justify-content: space-between;
  padding: 16px;
  border-radius: 12px;
  background-color: #ffffff;
}

.status {
  color: #71717a;
}
```

`justify-content: space-between` pushes the two texts to either end of the row. The screen is
white, so the card only shows once the screen has a color of its own: give `.screen` a
`background-color: #f4f4f5`.

## Space things out

Margins work, but a container can space its children itself. Add `gap: 8px` to `.screen`, and every
child gets 8 points between it and the next.

Not every CSS property has a native equivalent. Try `display: grid` on `.screen`: the browser would
draw it, and a device build drops it with a warning, so the preview shows that warning under the
phone. Read it: it names the file, the line and the reason. Take it out again afterwards. CSS a
device cannot draw is dropped with a warning rather than left out without a word;
[Supported CSS](/packages/fabric/supported-css) lists what compiles.
