---
title: Safe area
summary: Keep content clear of the notch, status bar and home indicator with SafeAreaProvider and SafeAreaView.
art: safe-area
---

# Safe area

The safe area is the screen clear of the status bar, notch or Dynamic Island, home indicator and,
on Android, the navigation bar. `SafeAreaProvider` measures it once at the root; `SafeAreaView`
insets content by it. Code reads the numbers from the [`SafeArea`](/packages/device/safe-area)
service in `@solid-native/device/solid`, which the provider reports into.

Every `SafeAreaView` needs a provider above it, and a missing one fails silently: the view looks
for a provider once, on entering the window before layout, then falls back to its own insets,
which read as zero. That looks correct until run on a device with a notch or home indicator.

```tsx
<SafeAreaProvider>
  <NativeStackOutlet navigation={navigation} />
</SafeAreaProvider>
```

A modal sits outside the stack's view hierarchy and needs its own `SafeAreaProvider`. Give it
`reportInsets={false}` so it reports to a local `SafeArea` instead of overwriting the app-wide one;
nested providers always do this. `onInsetsChange` receives each native measurement.

`SafeAreaView` applies insets natively as padding (or margin, with `mode="margin"`) in the same
layout pass, so content never flashes under the notch. `edges` picks sides (default all four; under
a native header, usually `edges={['bottom']}`). A per-edge object takes the larger of padding and
inset (`'maximum'`), adds them (`'additive'`, default for a listed edge) or ignores it (`'off'`).

```tsx
<SafeAreaView edges={['bottom']} class="screen">
  <Text>Content that should not sit under the home indicator</Text>
</SafeAreaView>
```

Inside a tab, the provider's insets ignore the tab bar, so a `SafeAreaView` clears only the home
indicator. For content pinned to a tab's bottom use `TabSafeAreaView` from
`@solid-native/router/solid`, which asks the tab screen what the bar covers; see
[Content above the tab bar](/packages/router/tabs#content-above-the-tab-bar). The custom
properties below have the same limit.

The insets are also published to descendants as `--safe-area-inset-top`, `-right`, `-bottom` and
`-left`, the native equivalent of `env(safe-area-inset-bottom)`:

```css
.floating-button {
  margin-bottom: var(--safe-area-inset-bottom, 0px);
}
```

`env(safe-area-inset-*)` compiles to the same properties, so web-shared stylesheets can keep
`env()`. Both components need `react-native-safe-area-context`; without it they render as
unimplemented views.

## Reference

<!-- api: SafeAreaProvider -->
<!-- api: SafeAreaView -->
