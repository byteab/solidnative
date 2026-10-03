---
title: Image
summary: Image, sources at several scales, and alt text as the accessibility label.
art: image
---

# Image

`Image` renders as `RCTImageView` on both platforms. It takes React Native's `source` and the web
spellings `src` (a bare URI) and `srcSet` (URIs at several scales).

```tsx
<Image src={user.avatarUrl} alt={user.name} resizeMode="cover" class="avatar" />
```

## alt text

`alt` is the accessibility label and makes the image an accessibility element. Without `alt` the
image is decorative and left out of the accessibility tree, as on the web.

## Sources and sizing

`source` takes a `require()`d asset (resolved at commit time), a `{ uri, width?, height?, scale?,
headers?, ... }` object, or a list for native to choose from. `src` and `srcSet` parse into the same
list; `srcSet="a.png 1x, a@2x.png 2x"` reads as in HTML. `crossOrigin` and `referrerPolicy` become
request headers. `tintColor` works from `style` or a class too, since style is flattened into props.

A single source with known width and height (a `require()`d asset, or a `{ uri }` giving both) acts
like an `<img>`'s intrinsic size: used only when nothing else sizes the image. Any class, rule or
`style` width or height wins, so `class="size-11"` renders 44 by 44. Set one dimension and the other
follows the picture's proportions via `aspectRatio`, unless you set `aspect-ratio`. A source list,
`src` or `srcSet` has no intrinsic size; layout alone sizes it.

```tsx
// 44 by 44, not the asset's 600 by 600
<Image source={art} class="size-11 rounded-md" />
// 120 wide, and as tall as the picture's proportions make it
<Image source={art} style={{ width: 120 }} />
```

`defaultSource` shows until `source` loads. Android reads `loadingIndicatorSource` (shown instead
of the loading indicator), `resizeMethod` (downscaling while decoding), `resizeMultiplier` and
`fadeDuration` (default 300ms). iOS reads `capInsets`, the non-stretching edges. `resizeMode`
(default `cover`) and `blurRadius` apply on both.

## Events

`onLoad`, `onError`, `onLoadStart`, `onLoadEnd` and `onProgress` receive the native event.

<!-- api: Image -->

## Image background

`ImageBackground` lays an image behind its children: a `View` with an absolutely positioned `Image`
filling it, with the outer width and height copied onto the image as React Native does.
`imageStyle` styles the image; `style` styles the outer view.

```tsx
<ImageBackground source={banner} resizeMode="cover" class="banner">
  <Text class="banner-title">Featured</Text>
</ImageBackground>
```

<!-- api: ImageBackground -->
