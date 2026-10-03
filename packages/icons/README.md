# @solid-native/icons

Renders SVG icon strings - such as the [`lucide-static`](https://lucide.dev/guide/packages/lucide-static)
set - as real native shapes from Solid, through `Icon` and react-native-svg, instead of the
`innerHTML` a web app uses.

Alpha: APIs may change before 1.0.

## Install

```sh
npm install @solid-native/icons solid-js react-native-svg
npm install lucide-static   # or any package of SVG strings
```

`lucide-static` exports each icon as a string of SVG markup. `@solid-native/metro` inlines the
named imports a file makes from it at build time, so only the icons an app uses reach its bundle.

## Example

```tsx
import { Icon, IconProvider } from '@solid-native/icons';
import { BookOpen } from 'lucide-static';

export function Reading() {
  return (
    <IconProvider icons={{ BookOpen }}>
      <Icon name="book-open" size={28} color="#ff9f0a" />
    </IconProvider>
  );
}
```

## What's in the package

- `Icon` - taking `name` (resolved through the nearest `IconProvider`; `book-open` finds
  `bookOpen` or `BookOpen`) or `svg`, plus `size`, `color`, `strokeWidth` (which replaces the
  root's `stroke-width`) and the usual view props.
- `IconProvider` - icon sets for its subtree, nesting over its parent's.
- A narrow SVG parser (`svg`, `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`,
  `polygon`) that covers lucide, heroicons and bootstrap-icons.

## Docs

- [Icons](https://solid-native.com/packages/icons)
- [Root README](https://github.com/byteab/solid-native/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solid-native/blob/main/ARCHITECTURE.md)

## License

MIT
