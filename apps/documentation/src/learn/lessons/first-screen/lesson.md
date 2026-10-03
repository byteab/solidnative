---
title: Your first screen
---

Over this course you build a habit tracker: a list of things to do each day, ticked off as you do
them. It is Solid as you already write it, with signals, components and control flow. What is new
is what it renders to: native views on iOS and Android, not a DOM. The course is about that
difference.

On a device, Solid's universal renderer drives React Native's Fabric renderer directly, with no
React component tree in between, and Expo provides the app runtime and the build tooling. The
preview beside the editor runs the same components in the browser, through `@solid-native/web/solid`.
X-ray labels each element with the native view it becomes on a device; it does not inspect a
running iOS or Android app.

There is no `<div>` or `<span>` on a phone. A screen is made of native components instead: `<View>`
becomes a plain native view, and `<Text>` native text. They come from
`@solid-native/components/solid`, imported like any other component. The comment on the first line,
`@jsxImportSource @solid-native/platform/solid`, is what tells the build to compile the file's JSX for
the native renderer rather than for a DOM.

## Name the screen

Change `Hello` to `Today`.

Text on a phone has to be inside a `<Text>`. A native view has no text of its own, so a word written
straight into a `<View>` has nowhere to be drawn. That is why the starter wraps it.

The styles live in `app.native.css`, and `withNativeStyles(sheet, ...)` hands them to the
components it renders, so `class="screen"` finds the `.screen` rule. Its `padding-top` adds 16
points to the top safe-area inset, so the heading clears the status bar and the notch. The preview
supplies example insets. On a device, a `<SafeAreaProvider>` at the root of the app measures them
and publishes them as CSS custom properties such as `--safe-area-inset-top`. Without one, the `0px`
fallback applies and the heading sits under the status bar. See
[Safe area](/packages/components/safe-area).

## Add a second line

A `<View>` lays out its children in a column, top to bottom. That is the default on a phone, where a
browser's would be a row of inline content. Add a second `<Text>` after the first, inside the same
`<View>`:

```tsx
<Text>3 left to do</Text>
```

Turn on X-ray to see what each element became. `<Text>` is a `Paragraph`, React Native's text view
on both platforms, and `<View>` is a `View`. Write an element nothing knows, such as `<txt>`, and
the preview warns that no component claims it, the way the engine does on a device.
