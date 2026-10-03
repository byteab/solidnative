---
title: Text
summary: Text, why text cannot be bare, and how fonts and truncation work.
art: text
---

# Text

Native views have no bare text nodes: every character on screen must sit inside a `Text`.
`<View>Hello</View>` compiles and renders nothing.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Text, View } from '@solidnative/components/solid';

export function Greeting(props: { name?: string }) {
  return (
    <View>
      <Text>Hello, {props.name ?? 'there'}</Text>
    </View>
  );
}
```

A nested `Text` is an inline run on the parent's baseline, for mixed styles:
`<Text>Plain <Text class="bold">and bold</Text></Text>`. Text styles (`color`, `font-size`, weight)
inherit through the CSS cascade as on the web, but not from an ancestor `View`'s inline `style`: put
them in a stylesheet rule or on the `Text`.

## Presses

A `Text` is pressable only with an `onPress`, `onPressIn`, `onPressOut` or `onLongPress`
callback; otherwise touches go to its parent.

```tsx
<Text onPress={select}>Select</Text>
```

## Fonts

Fonts use `font-family`, `font-weight` and `font-size` as on the web, resolved to native's
single-name `fontFamily` at build time. Custom fonts must be registered first: call `loadFonts()`
(see [Load custom fonts](/packages/expo/fonts)) before mount so the first frame avoids the fallback.

## Truncation, selection and font scaling

`numberOfLines` truncates; `ellipsizeMode` places the ellipsis (`clip` is iOS only). `selectable`
allows copying; `selectionColor` tints the selection. `allowFontScaling` (default on) and
`maxFontSizeMultiplier` limit system text-size scaling. `suppressHighlighting` (iOS) removes the
grey highlight on a held pressable run. `TextProps` omits `adjustsFontSizeToFit`,
`minimumFontScale`, `dynamicTypeRamp` and `dataDetectorType`.

<!-- api: Text -->
