---
title: Components
summary: The React Native element set as Solid components, one per native view.
---

# Components

`@solid-native/components/solid` is the element set: `View`, `Text`, `ScrollView`, `TextInput` and
the rest, each a Solid component that commits as a real native view through React Native's Fabric
renderer, with no DOM and no React. A `View` is a `UIView` on iOS and an Android `View`; a `Switch`
is the platform's own switch. Styling (`class` against a `.native.css` sheet, and `style`) is in the
[theming guide](/guide/theming).

Elements are imported functions written as JSX tags. A file using them carries the
`@jsxImportSource @solid-native/platform/solid` pragma or a `.solid.tsx` suffix.

## One name, two layers

Each component creates a host element named in kebab case (`View` creates `view`, `TextInput`
creates `text-input`), which the engine maps to a native view (`text` is `Paragraph`). The component
adds typed props, React Native's defaults, accessibility, events, and for `Text` the text layer.
Stylesheets select on host names (`text-input[data-invalid]`), unprefixed so React Native's docs
apply directly. On the web, `@solid-native/web` creates `text`, `image` and `switch` as HTML, not
SVG.

A misspelled component is an unresolved import; a misspelled prop is a TypeScript error against
its props type (`TextProps`, `ViewProps`, ...). Declare an undeclared native prop once with
`declareNativeProps` from `@solid-native/fabric`.

Most elements come from the Solid entry point:

```ts
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  Switch,
  ActivityIndicator,
  Modal,
  VirtualList,
  SafeAreaProvider,
  SafeAreaView,
} from '@solid-native/components/solid';
```

The gesture, `Animated` and Reanimated backends import React Native's uncompiled source, which
Node cannot parse, so they live on subpaths the tested entry point does not load:
`@solid-native/components/solid/gestures`, `@solid-native/components/solid/animations` and
`@solid-native/components/solid/reanimated` (see [gestures](/packages/components/gestures) and
[animation](/packages/components/animation)).

The smallest example:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Text, View } from '@solid-native/components/solid';

export function Greeting(props: { name?: string }) {
  return (
    <View>
      <Text>Hello, {props.name ?? 'there'}</Text>
    </View>
  );
}
```

## Shared props

Every element accepts the common native view props, typed as `ViewProps`: accessibility
(`accessibilityLabel`/`aria-label`, `accessibilityRole`/`role`, `accessibilityState` and its
`aria-*` aliases), identity and hit testing (`nativeID`/`id`, `testID`, `hitSlop`,
`pointerEvents`), `class`, `classList`, `style` and `data-*`. Per-element tables omit them.

<!-- api: @solid-native/components#View -->

## Events

Events are callback props: `onLayout`, `onTouchStart`, `onTouchEnd`, `onFocus` and the rest on
every view, plus each element's own (`onPress`, `onValueChange`, `onScroll`). Native only sends an
event once a handler is passed. `Pressable`'s press events are resolved from touch-responder
negotiation; see [pressable](/packages/components/pressable).

Events bubble to the root as in React Native, except target-only ones (`layout`, the scroll events,
`load`, `error`). Handlers receive a `NativeSyntheticEvent` (from `@solid-native/fabric`) with the
payload on `nativeEvent`, plus `stopPropagation()` and `isPropagationStopped()`.
`stopPropagation()` ends the bubble after the current view; that view's other handlers still run:

```tsx
<View onTouchEnd={() => dismiss()}>
  <View
    onTouchEnd={(event) => {
      event.stopPropagation();
      keep();
    }}
  />
</View>
```

## Where each element lives

- [layout](/packages/components/layout): `View` and Yoga's flexbox defaults;
  [safe area](/packages/components/safe-area): clearing the notch.
- [text](/packages/components/text): `Text`, why nothing renders without one, fonts.
- [input](/packages/components/input): `TextInput`, keyboards, `bindFormField`.
- [pressable](/packages/components/pressable): `Pressable`, `TouchableOpacity`, press events;
  [gestures](/packages/components/gestures): `react-native-gesture-handler`.
- [scroll view](/packages/components/scroll-view): `ScrollView`, pull-to-refresh;
  [lists](/packages/components/lists): `VirtualList`, `SectionList`.
- [keyboard-avoiding view](/packages/components/keyboard-avoiding-view): clearing the keyboard.
- [image](/packages/components/image): `Image`, `ImageBackground`;
  [activity indicator](/packages/components/activity-indicator),
  [switch](/packages/components/switch), [modal](/packages/components/modal).
- [animation](/packages/components/animation): CSS transitions, `AnimatedStyle`, Reanimated
  worklets.

## Every page

**Layout** - [layout](/packages/components/layout),
[safe area](/packages/components/safe-area),
[scroll view](/packages/components/scroll-view),
[keyboard-avoiding view](/packages/components/keyboard-avoiding-view),
[lists](/packages/components/lists)

**Content** - [text](/packages/components/text), [image](/packages/components/image),
[activity indicator](/packages/components/activity-indicator)

**Input** - [input](/packages/components/input), [switch](/packages/components/switch),
[pressable](/packages/components/pressable), [gestures](/packages/components/gestures)

**Presentation** - [modal](/packages/components/modal), [animation](/packages/components/animation)
