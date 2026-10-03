---
title: Color scheme
summary: Light or dark mode, as the user set it, for the decisions CSS cannot make.
---

# Color scheme

`ColorScheme` reports whether the user has the system in light or dark mode.

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Image } from '@solid-native/components/solid';
import { ColorScheme, useService } from '@solid-native/device/solid';

export function Logo() {
  const scheme = useService(ColorScheme);
  const logo = () =>
    scheme.current() === 'dark' ? require('./logo-dark.png') : require('./logo-light.png');
  return <Image source={logo()} />;
}
```

Style with `@media (prefers-color-scheme: dark)` or `dark:`; use `ColorScheme` for images,
components or status bar style. `set(scheme)` overrides the system where supported; `null` resets.

## Off a device and on the web

Off a device `current()` is always `light`, as is no preference. On the web the engine answers
`prefers-color-scheme` itself.

## Reference

<!-- api: ColorScheme -->
