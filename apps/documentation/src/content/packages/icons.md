---
title: Icons
summary: Render lucide-static icons, or any SVG string, as real native shapes with Icon.
---

# Icons

`@solidnative/icons/solid` renders web icons as real native shapes.
[`lucide-static`](https://lucide.dev/guide/packages/lucide-static) exports each Lucide icon as an
SVG string; `Icon` parses it into react-native-svg's native views. React Native has no `innerHTML`
and no CSS engine to size an SVG, so this is the only way to get one on screen.

## Setup

Install `react-native-svg` and `lucide-static`, then pass the icons to an `IconProvider`:

```sh
npm install @solidnative/icons lucide-static
npx expo install react-native-svg
```

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Icon, IconProvider } from '@solidnative/icons/solid';
import { BookOpen, GraduationCap } from 'lucide-static';

export function App() {
  return (
    <IconProvider icons={{ BookOpen, GraduationCap }}>
      <Icon name="book-open" size={28} color="#ff9f0a" />
    </IconProvider>
  );
}
```

`@solidnative/metro` replaces a named import from `lucide-static` with the strings it names at
build time, so only imported icons reach the bundle.

Providers nest: an `Icon` looks a name up in the nearest `IconProvider`, then outer ones. `name`
accepts the provided key (`BookOpen`), its camel case (`bookOpen`) or Lucide's kebab case
(`book-open`). An unknown name renders an empty box with no fallback glyph and no error.

## Color and stroke width

Two things a web page usually overrides on an icon become props:

- `color` sets the icon host's color, which native paints into every `currentColor` stroke and
  fill directly, without re-parsing or rebuilding shapes.
- `strokeWidth` replaces the root `<svg>`'s `stroke-width` (2 in Lucide), inherited by every shape
  without its own width.

```tsx
<Icon name="book-open" size={20} color="#0a84ff" strokeWidth={1.5} />
```

## Raw markup

Pass `svg` instead of `name` to render markup from elsewhere, such as fetched or generated SVG:

```tsx
<Icon svg={mySvgString} size={24} />
```

The parser recognizes `svg`, `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline` and
`polygon`, enough for Lucide, heroicons and bootstrap-icons. Anything else (`<defs>`, gradients,
`<style>`, `<text>`) is silently skipped, so such an SVG renders incomplete with no error.

## Accessibility

Without `accessibilityLabel` an icon is decorative and left out of the accessibility tree, which
suits an icon beside a text label. Set it when the icon alone carries meaning, such as an icon-only
button; it then becomes an element with `accessibilityRole="image"`:

```tsx
<Icon name="trash-2" accessibilityLabel="Delete" />
```

## Sizing

`size` is a number (or numeric string) setting both width and height in points; icons are square,
drawn from their `viewBox`. It defaults to 24.

## API

<!-- api: @solidnative/icons#Icon -->
