---
title: The native header
summary: NativeHeader and NativeHeaderItem, where their default colors come from, and NativeBarDefaults.
---

# The native header

A screen gets a navigation bar by rendering `<NativeHeader>` in its own JSX:

<!-- api: NativeHeader -->

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, Text } from '@solid-native/components/solid';
import { NativeHeader, NativeHeaderItem } from '@solid-native/router/solid';

export function Detail() {
  const star = () => {
    /* ... */
  };
  return (
    <>
      <NativeHeader title="Detail" backTitle="Back" largeTitle>
        <NativeHeaderItem type="right">
          <Pressable accessibilityRole="button" onPress={star}>
            <Text>★</Text>
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>
      {/* the rest of the screen */}
    </>
  );
}
```

The header can go anywhere in the screen, including inside `<SafeAreaView>`, `<Show>` or a layout
component; it is committed among the screen's direct children, where native looks, but behaves
where you wrote it. Write one header per screen.

## Large titles

A large title collapses into the bar on scroll when the page's scroll view comes first in the
screen, unwrapped and with nothing ahead of it, and adjusts its insets for the bar:

```tsx
<>
  <NativeHeader title="Library" largeTitle />
  <ScrollView contentInsetAdjustmentBehavior="automatic">{/* ... */}</ScrollView>
</>
```

`<VirtualList>` takes the same prop; put anything above the rows, such as filters, in its
`listHeader`. On iOS a large-title header is translucent with a clear, unlined bar over the content
(`largeTitleBackgroundColor` is `transparent`, `largeTitleHideShadow` is `true`), as UIKit draws it;
setting either, directly or in `<NativeBarDefaults>`, takes precedence.

A header removed by `<Show>` hides the bar; bringing it back restores it. Once a screen has had a
header it keeps one config for life: removing the header commits it as hidden, and the next header
takes it over; `hidden` does the same with the header in place. While covered, the header applies
prop changes only once back in front.

`<NativeHeaderItem>` places any native content in one of the bar's slots: `left`, `center`/`title`,
`right`, `back` (replaces the chevron; needs `backButtonInCustomView` on the header), or
`searchBar` for a `<NativeSearchBar>`. Presses use the ordinary responder system, so a
`<Pressable>` inside works as usual.

<!-- api: NativeHeaderItem -->

## Colors

Left alone, iOS follows the system appearance and Android uses the theme's `colorPrimary`
(framework blue). `NativeHeader` instead defaults `backgroundColor`, `color`, `titleColor` and
`largeTitleColor` to a neutral pair for the color scheme, `DEFAULT_HEADER_PALETTE`:

```ts
import { DEFAULT_HEADER_PALETTE } from '@solid-native/router/solid';

DEFAULT_HEADER_PALETTE.dark; // { background: 'rgb(10, 10, 10)', foreground: 'rgb(250, 250, 250)' }
```

It is a frozen constant, not an injectable token; retune it with `<NativeBarDefaults>`, below.
`backgroundColor`, `color` or `titleColor` set on a `<NativeHeader>` wins over both.

## Defaults for every header

`<NativeBarDefaults>`, around the component that creates the navigation, sets props once for
every `<NativeHeader>`:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { NativeBarDefaults } from '@solid-native/router/solid';
import { Shell } from './shell.solid.tsx'; // calls createNativeNavigation(routes)

export function App() {
  return (
    <NativeBarDefaults
      header={(scheme) => ({
        backgroundColor: scheme === 'dark' ? '#101014' : '#f4f4f7',
        titleColor: scheme === 'dark' ? '#ffffff' : '#101014',
        largeTitleColor: scheme === 'dark' ? '#ffffff' : '#101014',
        color: '#3b6ef5',
        userInterfaceStyle: scheme,
        hideShadow: true,
      })}
    >
      <Shell />
    </NativeBarDefaults>
  );
}
```

Pass an object, or a function of the color scheme (`'light'` or `'dark'`, from `ColorScheme` in
`@solid-native/device/solid`). It runs in each header's reactive computation, so signals it reads,
such as an in-app theme, are tracked. Nested `<NativeBarDefaults>` merge inner over outer.

The defaults (`HeaderDefaults`) take any `NativeHeader` prop except `title`, `testID` and
`children`, but are meant for appearance: `userInterfaceStyle`, `backgroundColor`, `color`,
`blurEffect`, `hideShadow`, `translucent`, the `title*` and `largeTitle*` colors and fonts,
`largeTitleHideShadow`, `backTitleFontFamily`, `backTitleFontSize` and `backButtonDisplayMode`.
Anything a `<NativeHeader>` sets, even `false`, wins; omitted colors fall back to
`DEFAULT_HEADER_PALETTE`.

## Insets

A header owns the top safe-area inset, so don't also wrap the screen in a `<SafeAreaView>`; that
clears the notch twice. A screen opened with `present()` has no header, being outside the
navigation controller; see [Screens and navigation](/packages/router/screens) for what it owns
instead.
