---
title: Scroll view
summary: ScrollView, its content container, sticky headers, and pull-to-refresh.
art: scroll-view
---

# Scroll view

`ScrollView` wraps its content in an inner container, as React Native's `ScrollView.js` does.
`contentContainerStyle` styles that container (padding and gaps go there); `style` styles the
scroll view's frame.

```tsx
<ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
  <For each={items()}>{(item) => <Text>{item.label}</Text>}</For>
</ScrollView>
```

## Horizontal scrolling

`horizontal` sets the flex direction of both the scroll view and its content container. If
something overrides the container's layout, the content stretches to the frame width and nothing
scrolls, which looks like there is simply too little content.

## Keyboard taps

`keyboardShouldPersistTaps` sets what a tap does while a `TextInput` has focus: `'never'` (default)
only dismisses the keyboard, `'handled'` dismisses only if the tapped view did not handle it, and
`'always'` never dismisses.

## Sticky headers

`stickyHeaderIndices` pins children to the top until the next sticky child pushes them off. As in
React Native, this translates the child against the scroll offset, but from the scroll event rather
than the native animation driver, so a pinned header can trail a fast fling by a frame.

## Methods

The `ref` callback receives a `ScrollViewRef`: `scrollTo({ x, y, animated })`,
`scrollToEnd({ animated })`, `flashScrollIndicators()` and, on iOS, `zoomToRect(rect, animated)`,
alongside the shared `NativeRef` methods.

## A scroll handler and fine-grained updates

`onScroll` runs on every scroll event. Setting a signal there re-runs only the expressions reading
it: a header fading with the offset updates one style, and the rows beside it in a `<For>` are not
visited. There is no component re-render, so no need to split the list out to keep scrolling cheap.

```tsx
const [headerOpacity, setHeaderOpacity] = createSignal(1);

<ScrollView onScroll={(event) => setHeaderOpacity(fade(event.nativeEvent.contentOffset.y))}>
  <View style={{ opacity: headerOpacity() }}>
    <Text>Inbox</Text>
  </View>
  <MessageRows messages={messages()} />
</ScrollView>;
```

<!-- api: ScrollView -->

## Refresh control

Pull-to-refresh is the `refreshControl` prop of `ScrollView` and `VirtualList`, a
`RefreshControlProps` object, not a child. Native shows the spinner as soon as the user pulls; then
`onRefresh` fires and the app sets `refreshing` to `true`, then `false` when done. If `refreshing`
is never set, the refresh is stopped for you; if it is never cleared, it spins forever (no timeout).

```tsx
<ScrollView refreshControl={{ refreshing: loading(), onRefresh: reload }}>
  <For each={items()}>{(item) => <Text>{item.label}</Text>}</For>
</ScrollView>
```

iOS reads `tintColor`, `title` and `titleColor`. Android reads `colors` (cycled by the spinner),
`progressBackgroundColor`, `size` (`'default'` or `'large'`) and `enabled` (default true). Both read
`progressViewOffset`, the spinner's distance from the top.

On Android the swipe layout must be the scroll view's _parent_, so `AndroidSwipeRefreshLayout` is
committed in its place with the scroll view inside. Pass `refreshControl` at mount so the wrapper is
installed. The layout part of the inline style (size, margins, flex, position, transform) moves to
the wrapper, as in React Native's `ScrollView.js`; layout from a class stays on the scroll view.
`RefreshControl` is also exported as a component for custom hosts.

<!-- api: RefreshControl -->
