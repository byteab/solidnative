---
title: Lists
summary: VirtualList and SectionList, the windowed replacement for FlatList and SectionList.
art: lists
---

# Lists

## Virtual list

`VirtualList` replaces `FlatList`, `SectionList` and `VirtualizedList`, which are React trees and
unreachable here. It is a native scroll view sized to the whole list, rendering only visible rows
plus a buffer (`overscan`, four rows by default, covering fling gaps), absolutely positioned.

`renderItem` is called once per row owner with the item and index as _accessors_, so a row staying
in the window updates in place. Read `item()` and `index()` inside the JSX, not at the top:

```tsx
<VirtualList
  class="list"
  items={rows()}
  itemHeight={56}
  keyExtractor={(row) => row.id}
  onEndReached={loadMore}
  listHeader={<Text>{rows().length} results</Text>}
  listFooter={<Text>End of list</Text>}
  renderItem={(row) => <Text class="row">{row().label}</Text>}
/>
```

The list positions rows and measures their layout itself; row content needs no wiring.

While scrolling, it builds `prefetch` rows (ten by default) _ahead_ of the window in the direction
of travel, a few per frame within a few milliseconds of budget, so rows usually exist a frame or two
before they appear. Prefetched rows are dropped when the direction reverses; nothing is prefetched
before the first scroll. `prefetch={0}` turns it off.

### Rows that size themselves

Leave `itemHeight` unset and rows take their content's height, as feed posts and chat messages do.
Rendered rows lay out in normal flow after a spacer for the rows above, so native places each row
correctly in its first frame, and its measured height sizes the unrendered part. Unmeasured rows
count as `estimatedItemHeight` (a number or a function of item and index; 50 by default).
Measurements are keyed by `keyExtractor`, so they follow items across inserts, removals and moves:

```tsx
<VirtualList
  items={posts()}
  estimatedItemHeight={(post) => (post.image ? 320 : 120)}
  keyExtractor={(post) => post.id}
  maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 40 }}
  renderItem={(post) => <Post post={post()} />}
/>
```

When a row above the visible one differs from its estimate, the offset is corrected so the
content does not move. The correction is a post-commit `scrollTo`, so mid-fling it lands where the
last scroll event put the list.

### Keeping position when rows change

`maintainVisibleContentPosition` (React Native's shape) keeps visible content still when rows are
inserted or removed before it, such as new posts at a feed's top or older messages loaded above.
Rows before `minIndexForVisible` never anchor; within `autoscrollToTopThreshold` points of the start
the list scrolls to the new rows instead. Without it, inserts above the viewport move the content,
as in `UITableView` and `FlatList`.

### Identity, recycling and row state

A row's key is `keyExtractor`'s result, or the item itself. By default each key gets its own row
owner, created when it scrolls in, kept while in the window (across inserts and removals) and
disposed when it leaves. State created in `renderItem` (say an expanded flag) belongs to the item.

`recycleItems` reuses slots like a `UITableView` reuse queue: an incoming row takes an outgoing
row's slot and views, updating only bindings, which is most of a fast fling's work. Up to six
departed slots per row type stay rendered but hidden (`display: none`) for later reuse. For rows of
different kinds (text and photo posts, messages and date dividers), `itemType` (a function of item
and index) keeps a pool per kind so slots are only reused for matching rows.

With `recycleItems`, local row state belongs to the slot and passes to the next item, like a reused
`UITableViewCell`. Keep per-item state outside the row (list data, or a store keyed by id), or
derive it from the `item` accessor so it resets on change, Solid's `prepareForReuse`:

```tsx
<VirtualList
  items={posts()}
  recycleItems
  renderItem={(post) => {
    const [expanded, setExpanded] = createSignal(false);
    createEffect(
      on(
        () => post().id,
        () => setExpanded(false),
      ),
    );
    return <Post post={post()} expanded={expanded()} onToggle={() => setExpanded((v) => !v)} />;
  }}
/>
```

Leave `recycleItems` off when a row must never be recycled: a focused text input, a row
mid-animation.

`listHeader` and `listFooter` render in normal flow around the rows, like `FlatList`'s. `itemHeight`
is a number or a function of item and index. `horizontal` lays rows along `x`; `inverted` scrolls
from the bottom with rows upright, so a chat needs no reversed array. `stickyIndices` pins rows to
the leading edge and `stickyHeader` pins `listHeader` until the first sticky row pushes it off;
together they cover `FlatList`'s `stickyHeaderIndices`. `refreshControl` works as on a `ScrollView`
(see the [scroll view page](/packages/components/scroll-view)). Scroll view props (`pagingEnabled`,
`snapToInterval`, `decelerationRate`, `showsHorizontalScrollIndicator`, `scrollEventThrottle`,
`keyboardDismissMode`, `contentInsetAdjustmentBehavior`, ...) pass through with the same defaults,
so horizontal lists rubber-band sideways and `'fast'` resolves to UIKit's rate. The `ref` callback
receives a `VirtualListRef`, adding `scrollToIndex` and `scrollToOffset` to the scroll view methods.

`renderSeparator` draws between rows (not after the last) and receives the neighbouring rows as
accessors, like `ItemSeparatorComponent`. It sits at the trailing edge of the leading row's slot, so
`itemHeight` includes it, as `getItemLayout`'s `length` does. Self-sizing rows get their separator
drawn over their trailing edge once measured:

```tsx
<VirtualList
  items={rows()}
  itemHeight={57}
  renderItem={(row) => <Text>{row().label}</Text>}
  renderSeparator={() => <View style={{ height: 1, backgroundColor: '#ddd' }} />}
/>
```

`onEndReached` fires once per item-count change when within `endReachedThreshold` viewport-heights
of the end, for loading the next page. Scrolling away and back fires it again, retrying a failed
page. `onViewableItemsChanged` reports visible rows by `itemVisiblePercentThreshold`.

<!-- api: VirtualList -->

## Section list

`SectionList` mirrors React Native's: `sections` of `{ key?, title?, data }`, drawn by
`renderSectionHeader`, `renderItem`, `renderSectionFooter` and `renderSeparator` (between items in a
section). It windows over flattened rows (header, items, footer per section) as `VirtualList` does.

```tsx
<SectionList
  sections={sections()}
  itemHeight={44}
  sectionHeaderHeight={28}
  onEndReached={loadMore}
  renderSectionHeader={(section) => <Text>{section().title}</Text>}
  renderItem={(contact) => <Text>{contact().name}</Text>}
  renderSeparator={() => <View class="line" />}
/>
```

Heights are fixed, as with `getItemLayout`: `itemHeight`, `sectionHeaderHeight` and
`sectionFooterHeight` are numbers or functions; item height includes its separator.
`stickySectionHeadersEnabled` defaults on for iOS, off for Android.
`scrollToLocation({ sectionIndex, itemIndex })` on the `SectionListRef` counts the header as item 0
and allows for a pinned header.
`listHeader`, `listFooter` and `refreshControl` pass through. There is no
`SectionSeparatorComponent` or `onViewableItemsChanged`.

<!-- api: SectionList -->
