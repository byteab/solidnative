---
title: The renderer
summary: How Solid's universal renderer turns JSX into retained native nodes, and when it commits.
---

# The renderer

## From JSX to engine calls

Metro compiles each Solid file with `generate: 'universal'` and
`moduleName: '@solidnative/platform/solid'`, so compiled code calls this package's
`createElement`, `insert`, `setProp` and friends. No virtual DOM: each call goes to Fabric's
`Engine`, a retained tree diffed against what native last saw.

A file opts in with a leading `/** @jsxImportSource @solidnative/platform/solid */` comment or a
`.solid.tsx` suffix. `view` and `text` are the only raw intrinsics; `Pressable`, `TextInput`,
`ScrollView` etc. come from `@solidnative/components/solid`, built on the host adapter
(`createHostElement`, `spreadHostProps`, `insertHostChildren`) so they also render in a browser.

## Which stylesheet a node gets

`withNativeStyles(sheet, render)` puts a compiled `.native.css` sheet in Solid context; elements
created inside match its rules (plus the global sheet), and child components inherit it. See
[Fabric's CSS engine](/packages/fabric/css-engine) for what rules match against.

## What props become

The renderer sorts props by name. These translations fail silently if you write around them:

- **`class` and `classList`** set classes; both may be used on one element and are merged.
- **`style`** takes an object, an array of objects, a declaration string (`"flex: 1"`), or `null`.
  Dash-case is camel-cased and numeric strings (`'10px'`, `'10'`) become numbers, as Fabric wants
  `fontSize: 10`. A `--` key sets a custom property instead.
- **`onXxx` props are native events.** `onTouchEnd` listens for Fabric's `topTouchEnd`; `on:name`
  listens for raw event `name`. A listener runs under the owner that set it.
- **`responder`** installs responder handlers on the node.
- **Anything else** passes to the view as a native prop.

Fabric sends no `press` event: `Pressable` (here as in React Native) synthesizes `onPress` from the
touch responder in JavaScript. On a raw `<view>`, `onPress` waits for a `topPress` that never comes.

## Commits are batched to a microtask

A signal write re-runs only the effects that read it, each writing straight to the engine. The
first dirtying write schedules a microtask that sends all changes in one `completeRoot`. Native
events dispatch inside Solid's `batch`, so one handler makes one commit.

Two things need frames outside that path:

- **CSS transitions and keyframe animations** change values without signals. While anything
  animates, the root runs a `requestAnimationFrame` loop, one commit per frame. See
  [Animation](/packages/fabric/animation).
- **`root.afterCommit(callback)`** and `afterHostCommit` (in a component) run after the next
  commit, for work that needs the node on native - measuring it or sending a command.

A removed node is destroyed at the next commit unless re-inserted meanwhile, so a `<Show>` or
`<For>` that moves a node keeps its native view.

## Control flow

`For`, `Index`, `Show`, `Switch`, `Match`, `ErrorBoundary`, `Suspense` and `SuspenseList` are
Solid's own, re-exported from `@solidnative/platform/solid` and typed for native children; import
them from here in native files.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { For, Show } from '@solidnative/platform/solid';
import { Text, View } from '@solidnative/components/solid';

export function Reviews(props: { reviews: readonly string[] }) {
  return (
    <Show when={props.reviews.length} fallback={<Text>No reviews yet</Text>}>
      <View>
        <For each={props.reviews}>{(review) => <Text>{review}</Text>}</For>
      </View>
    </Show>
  );
}
```

### Mounting part of a screen later

`Defer`, this package's own, renders its `fallback` (default nothing) in the first commit and its
children a frame later. Use it for what the first frame can skip: content below the fold, a chart,
an unselected tab's body.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Defer, For } from '@solidnative/platform/solid';
import { Text, View } from '@solidnative/components/solid';

export function Product(props: { name: string; reviews: readonly string[] }) {
  return (
    <View>
      <Text>{props.name}</Text>
      <Defer fallback={<Text>Loading reviews…</Text>}>
        <For each={props.reviews}>{(review) => <Text>{review}</Text>}</For>
      </Defer>
    </View>
  );
}
```

Children are created once and never unmounted; `Defer` only slices a mount across frames. To load
code lazily, use the router's `lazy` routes or Solid's `lazy()` inside `<Suspense>`.

## Errors and cleanup

A throwing listener, cleanup or after-commit callback goes to `engineOptions.onError` (or
`console.error`) and the rest still run: one failing `onCleanup` can't leave siblings alive, and no
exception unwinds into Fabric's dispatch. `onNativeCleanup(node, cleanup)` ties a cleanup to a
node's lifetime instead of an owner.

## Reading commit stats

`engine.stats` on the root's `engine` tracks commit counts and timings (worst commit, worst
render span, slow commits over 8ms), showing whether jank is in the commit or the effects.
