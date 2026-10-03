# AGENTS.md

This is a SolidJS app rendering real native iOS and Android views with
[solid-native](https://solid-native.com): Solid components on React Native's Fabric renderer, inside an
Expo app. It is not a web app and not React: there is no DOM, and React never renders anything.
JSX here is Solid's, compiled for a native renderer.

Solid's own documentation applies to signals, effects, stores and components:
https://docs.solidjs.com. Its DOM-only parts do not: there is no `solid-js/web`, no `render()`, no
`<Portal>` and no DOM events. Where the two disagree, this file wins.

## Commands

```sh
npm start           # Metro; press i or a for a simulator, or scan the QR code with Expo Go
npm run ios         # the iOS simulator
npm run android     # the Android emulator
npm test            # Node's test runner, against a fake native layer: no simulator needed
npm run typecheck
```

`src/main.solid.ts` mounts the root component, `src/app/app.solid.tsx`. Run `npm test` and
`npm run typecheck` after a change; both are fast.

## Rules that are easy to get wrong

- **A file with JSX is a `.solid.tsx` file**, or starts with
  `/** @jsxImportSource @solid-native/platform/solid */`. Without either, Metro compiles it as React
  and nothing it renders reaches the screen. A `.solid.ts` file without JSX reloads cleanly in
  development, as `main.solid.ts` does.
- **Elements are native components**, imported from `@solid-native/components/solid`: `View`, `Text`,
  `Pressable`, `ScrollView`, `TextInput`, `Image`, `Switch`, `SafeAreaView`, `VirtualList`,
  `Modal`. There is no `<div>`, `<span>`, `<button>` or `<input>`, no `document` and no `window`.
- **Text only renders inside `<Text>`.** `<View>Hello</View>` compiles and shows nothing.
- **Events are native props:** `onPress` on `Pressable`, `onChangeText` on `TextInput`,
  `onValueChange` on `Switch`, `onScroll`, `onLayout`. There is no `onClick`.
- **Control flow is `<Show>` and `<For>` from `@solid-native/platform/solid`**, the native renderer's
  own; `Index` and `ErrorBoundary` are re-exported there too.
- **Components run once.** Read signals inside JSX or `createMemo`/`createEffect`, not at the top
  of the component, and do not destructure `props`: both freeze the value at its first read.
- **Accessibility is props:** `accessibilityRole="button"`, `accessibilityLabel`,
  `accessibilityState`. Screen readers read them, and so can a test.

## Styling

- `style` takes a React Native style object: camelCase keys, numbers in points
  (`{ padding: 16, backgroundColor: '#fff' }`).
- `class` names resolve against a `.native.css` file the component imports and wraps its JSX in:
  `withNativeStyles(sheet, () => <View class="card" />)`, `withNativeStyles` from
  `@solid-native/platform/solid`. The CSS is compiled at build time: type, class, id and attribute
  selectors, combinators, `@media`, custom properties, transitions and `@keyframes`. Grid, float,
  `::before`/`::after`, `:hover` and `:focus-visible` are dropped with a build warning - lay out
  with flexbox. Everything is `display: flex` with `flex-direction: column` by default, as in React
  Native.
- Tailwind v4 works through `@solid-native/tailwind`, with `ios:`, `android:` and `dark:` variants.

## Lists and navigation

- A long list is `<VirtualList>`, which recycles rows as they scroll. `<ScrollView>` renders
  everything, so keep it for short content.
- Navigation is `@solid-native/router/solid` on native stacks and tabs: routes are a `NativeRoute[]`
  (`{ path, lazy: () => import('./x.solid.tsx').then((m) => m.X) }`),
  `createNativeNavigation(routes)` makes the navigation, and `<NativeStackOutlet navigation={...} />`
  renders it.

## Tests

`src/app/app.test.ts` shows the shape, with `@solid-native/testing`: `render(App)` mounts the
component onto a fake Fabric that records what native would be handed, `screen` queries the
committed tree the way Testing Library does, and `userEvent.press(...)` sends the touch events
native would. `@solid-native/testing/register`, imported by the test command, compiles Solid's JSX and
`.native.css` for Node the way Metro does for the device. Tests run in Node with no simulator, so
write one alongside a change.
