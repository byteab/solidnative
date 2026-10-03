---
title: The CSS engine
summary: How .native.css stylesheets get compiled, matched and cascaded with no DOM involved.
---

# The CSS engine

A `.native.css` file is real CSS: classes, selectors, custom properties, media queries and
transitions reach a native view. The work splits into a build-time and a runtime half.

## Build time: compiling to a rule set

The Metro transform compiles each `.native.css` import with lightningcss to a sorted rule set of
plain data: selectors as compounds and combinators, values in React Native's style form, specificity
precomputed. Anything native cannot express is dropped with a build warning; see [what CSS reaches a
device](/packages/fabric/supported-css) and [Metro](/packages/metro/configuration).

### Applying a sheet

`withNativeStyles(sheet, render)` from `@solidnative/platform/solid` puts the sheet in Solid
context; every element created inside `render`, including later branches and child components
without their own sheet, is matched against it:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Text, View } from '@solidnative/components/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import shared from '../shared/cards.native.css';
import sheet from './card.native.css';

export function Card(props: { title: string }) {
  return withNativeStyles(sheet, () => (
    <View class="box">
      <Text class="title">{props.title}</Text>
    </View>
  ));
}

export function PlainCard() {
  return withNativeStyles(shared, () => <View class="box" />);
}
```

An element matches one component sheet, so shared CSS goes in its own `.native.css` file imported
by each component, or in the global sheet. A sheet can also be chosen at runtime or built in code.

## Runtime: matching and merging

At runtime nothing is reparsed. Matching goes right to left: each rule is filed under the most
selective type, class or id in its key selector, so a node only tries rules that could match.

A node is matched against up to three sheets: the global stylesheet (`engineOptions.globalStyles`,
see [Bootstrapping](/packages/platform/bootstrapping)), the sheet in context when the node was
created, and the sheet of the component it hosts (`setNativeStyleHost(node, sheet)`), from which
only `:host` rules apply, so a parent's class on the host cannot hit the component's same-named
rule. Component rules get one extra class of specificity over global ones, so they beat a utility
class of equal specificity.

## Inheritance is emulated, not real

React Native views inherit nothing (only text-inside-text does), so the cascade emulates it for
`color`, `direction`, `fontFamily`, `fontSize`, `fontStyle`, `fontWeight`, `fontVariant`,
`letterSpacing`, `lineHeight`, `textAlign`, `textTransform`, `textDecorationLine`,
`writingDirection`, the text shadow and `selectable` (`user-select`). Nothing else is inherited, as
in real CSS.

A paragraph's `text-align` resolves against its inherited `direction`: unset or `start`/`end`
follow it; `left` and `right` do not. See [Direction](/packages/device/direction).

## Custom properties and tokens

A custom property (`--primary: ...`) inherits, so it is the one thing that reaches inside a
component, whose sheet matches only elements created under it. `var()` resolves per node, so a
parent's `--primary` can retheme a child's internals; a selector into its markup cannot.

An undefined `var()` with no fallback drops the declaration, as in a browser, with a one-time
development warning per name.

## Media queries

`@media` conditions are evaluated against [the root's
`engineOptions.conditions`](/packages/platform/bootstrapping): `width`, `height`, `orientation`,
`prefers-color-scheme` and `prefers-reduced-motion`. Those are the only features a device can
answer; `hover`, `pointer`, `print` and `not` are build errors. Rotation or a theme change writes
no signal, which is why
`@solidnative/device/solid`'s `watchConditions(engine)` exists; see
[Bootstrapping](/packages/platform/bootstrapping).
