---
title: Safe area and hairlines
summary: Utility classes for safe-area insets and the thinnest line a screen can show.
---

# Safe area and hairlines

Tailwind doesn't ship these two families: neither means anything to a browser stylesheet.

## Safe-area utilities

`pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`, `p-safe`, `px-safe` and `py-safe` read the safe-area
insets as custom properties, updating on rotation without a rebuild. `mt-safe`, `mr-safe`,
`mb-safe` and `ml-safe` use margin, to push a sibling out of the inset instead of padding content.

```tsx
<View class="pt-safe px-4" style={{ flex: 1 }}>
  ...
</View>
```

`pt-safe-4` adds a spacing step to the inset. `min-pt-safe-4` takes the larger of the two, for
padding that only needs to grow where the device needs more:

```tsx
<View class="min-pt-safe-4">...</View>
```

Native insets come at runtime from `SafeAreaProvider` in `@solid-native/components/solid`; the
web uses `env(safe-area-inset-*)`.

## Hairline utilities

`h-hairline`, `w-hairline`, `border-hairline` and per-side `border-{t,r,b,l}-hairline` draw the
thinnest line the screen can show (a third of a point at 3x), unlike Tailwind's one-pixel `border`,
which looks fat on a phone.

```tsx
<View class="border-t-hairline border-gray-200" />
```

The width comes from `deviceTokens()` on native and a `min-resolution` media query on the web.
