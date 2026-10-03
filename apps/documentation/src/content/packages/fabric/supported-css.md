---
title: What CSS reaches a device
summary: A scannable reference for what compiles to native and what is dropped with a build warning.
---

# What CSS reaches a device

The rule: if React Native's style API can express it, CSS has a spelling for it here; if not, the
declaration or rule is dropped with a build warning naming the file, line and reason. A dropped
declaration leaves the rest of its rule in place. CSS that does not parse fails the build.

## Selectors that work

Type, class and id selectors. Attribute selectors: `[name]`, `[name="value"]`, `[name^="value"]`,
`[name$="value"]`, `[name*="value"]`, `[name~="value"]` and `[name|="value"]`. `:is()`, `:where()`
and `:not()`, with compound arguments only; a combinator inside is dropped, except two forms
Tailwind writes: `<compound> *` (its `group-*` ancestor test) and `<compound> ~ *` or
`<compound> + *` (its `peer-*` test, read as the sibling combinator). `:host`,
`:host(<compound>)`, `:host-context(<compound>)`. `:first-child`, `:last-child`, `:only-child`,
`:nth-child()` and `:nth-last-child()` (not the `of <selector>` form). `:empty`. `:root`.
`:disabled` (from the element's `disabled` prop). `:focus` and `:active`, tracked by the engine
from native focus, blur and press events. Every combinator: descendant (` `), child (`>`),
next-sibling (`+`) and later-sibling (`~`).

`html` means the top of the tree, like `:root`.

## Selectors that are dropped

A rule with one of these selectors is dropped with a warning.

Pseudo-elements (`::before`, `::after`, all others) are permanently unsupported; write the element.

`:hover` and `:focus-visible` have nothing to answer from on a phone. Use `:active` and `:focus`,
or an attribute such as `data-hover`; the `hover:` and `focus-visible:` variants in
[`@solidnative/tailwind`](/packages/tailwind/variants) already map to them.

`:checked`, `:indeterminate`, `:valid`, `:invalid`, `:placeholder-shown` and other form-state
pseudo-classes are unsupported (native controls keep that state in props); select on an attribute
set from the same signal (`data-checked={on() ? '' : undefined}`). `:has()` is unsupported.

## Everything else CSS can paint

Colors can be a named color, hex, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()` or
`oklch()`, with or without alpha, or a `color-mix()` of two such colors in any of those spaces. Each
converts to sRGB `rgb()` at build time by CSS Color 4, gamut-mapped by reducing chroma so the hue
holds. `color()` with a named space such as `display-p3` is dropped. A `color-mix()` with a `var()`
is computed on device in the space it names (`srgb`, `oklab`, `oklch`, `lab`, `lch`, `hsl` or `hwb`)
with CSS Color 4 arithmetic (premultiplied alpha, shorter hue by default, achromatic colors taking
the other's hue) and the same gamut mapping, e.g. `[style.--cover]="track.colour"` on a row with
`color-mix(in oklch, var(--cover) 70%, white)` for its lighter shade.

A relative color from a token, such as `oklch(from var(--brand) l c h / 0.2)` or
`hsl(from var(--brand) h s calc(l - 20))`, is computed on device too, in `rgb()`, `hsl()`,
`hwb()`, `lab()`, `lch()`, `oklab()` or `oklch()`. Channel keywords use CSS Color 5's scale (`r g
b` 0 to 255, the `s l w b` of `hsl()` and `hwb()` 0 to 100); a channel is a keyword, a number, or
`calc()` of them; a percentage or angle stands alone. A gray's missing hue is 0.

`light-dark(<light>, <dark>)` picks by the app's color scheme (no per-element `color-scheme`) and
works anywhere a color does, including tokens (`--surface: light-dark(white, black)`), gradient
stops, shadows and `color-mix()`.

Gradients (`background-image: linear-gradient(...)` or `radial-gradient(...)`, compiled for
Fabric's `experimental_backgroundImage` prop) are linear and radial only, not conic. A stop can be
a `var()`, a `color-mix()` containing one, or a literal color; a lone `var()` stop nobody defines
is dropped, making it optional. A radial gradient with token stops
takes its shape, size and center as keywords and positions (`circle closest-side at 50% 18%`), not
an explicit radius; a position can be a token (`at var(--x) 30%`) with a fallback after its name.
`background-image` takes gradients only; a `url()` is dropped (no image loader), so use an
`<image>` element.

`filter` compiles to React Native's `filter` prop; which functions draw depends on the platform:

| Function                                                                         | iOS | Android                       |
| -------------------------------------------------------------------------------- | --- | ----------------------------- |
| `brightness()`, `opacity()`                                                      | yes | yes                           |
| `contrast()`, `grayscale()`, `hue-rotate()`, `invert()`, `saturate()`, `sepia()` | no  | yes                           |
| `blur()`, `drop-shadow()`                                                        | no  | Android 12 (API 31) and later |

On Android a list containing `blur()` or `drop-shadow()` is drawn from Android 12 and ignored
whole before that. A function iOS does not draw is dropped with a warning in any rule that can
apply on iOS; scope the rule under `.platform-android`, the class an app puts on its outermost view
from `nativePlatform()` (Tailwind's `android:` variant), to keep it.

```css
.platform-android .photo-disabled {
  filter: grayscale(1);
}
```

Sheets compile per bundled platform, so an unscoped filter survives on Android and warns on iOS; a
sheet with no platform (a component under test) or a Tailwind sheet must suit both, so `grayscale`
warns while `android:grayscale` is kept. A filter in `@keyframes` is checked against the platform
alone.

A `filter` can be a list of tokens each holding one function or nothing (`filter: var(--blur,)
var(--grayscale,)`); each token is checked against the platforms of the rule setting it.

`transform` takes translate, scale, rotate, skew and perspective functions. `translate`, `rotate`
and `scale` (Tailwind 4) are separate properties, as on the web (`.rotate-45.translate-x-4` turns
and moves), each transitioned (`transition: rotate 200ms`) or animated on its own, applied in CSS
order before `transform`. `transition: transform` does not cover them; name them, as Tailwind's
`transition-transform` does. `rotate` turns about x, y or z; other axes are dropped. Any of them
can take tokens, with `calc()` around them (`translate: var(--tw-translate-x)
var(--tw-translate-y)`, `transform: translateY(var(--y)) rotate(var(--r))`); an angle token is
read in degrees whatever its unit, so `--r: 0.25turn` turns 90. With a token, `transform` takes
translate, scale, rotate and skew functions.

`skewX()` and `skewY()` draw on iOS only (Android drops `skewX()` and turns `skewY()` into a
rotation), so a nonzero skew warns in any rule that can apply on Android and is kept under
`.platform-ios` (Tailwind's `ios:`), in an iOS build, and in an iOS build's keyframe.

`box-shadow` works; `text-shadow` takes one shadow, clipped on iOS to the text's box (pad the text).
A `box-shadow` can contain tokens: a color that is a `var()`, `color-mix()`, relative color,
`rgba(var(--channels), 0.25)` or `hsl()` of tokens; a length that is a `var()` or `calc()` around
one (`0 0 0 var(--ring-width)`); and a whole shadow as a token, in a list with others, with the
shadows after its name as fallback. Exception: a shadow whose lengths are all one token, since a
token is read in one form; write the lengths out or put the whole shadow in the token. A shadow
token can contain a color token, `--ring: 0 0 0 2px var(--ring-color, currentcolor)`, filled in
where used; a `currentcolor` fallback is the element's own or inherited `color`, or black.
`text-shadow` takes tokens the same way.

Truncation is paragraph props on native. `white-space: nowrap` compiles to `numberOfLines: 1`,
`line-clamp` or `-webkit-line-clamp` to that many lines, and `text-overflow` to `ellipsizeMode`
(`ellipsis` is `tail`, the default; `clip` draws on iOS only). `line-clamp: none`, `unset` and
`white-space: normal` clear the limit. They apply only to the `<text>` the rule matches, not a
wrapping `<view>`. `display: -webkit-box` is read as flex along the `-webkit-box-orient` axis, so
the line-clamp idiom compiles; `-webkit-box-orient` alone is ignored, as in a browser. A bound
`[numberOfLines]` wins over the stylesheet. Other `white-space` values, which keep spaces and line
breaks, are dropped. `font-variant-numeric` takes `tabular-nums`, `proportional-nums`,
`lining-nums` and `oldstyle-nums`, as `fontVariant`.

`display` takes `flex`, `none`, `block` and `contents`. `block` and `inline-flex` read as `flex`
(every view is a column flex container), so `.d-none` then `.d-md-block` works. `contents` is
Yoga's: no box of its own, children laid out as the parent's. `inline`, `inline-block`,
`grid` and the table values are dropped.

`overflow` is one value for both axes, so differing `overflow-x`/`overflow-y` are dropped with a
warning; `auto` reads as `scroll`, `clip` as `hidden`. `cursor` takes `auto` and `pointer` (what an
iPad pointer draws), with `default` read as `auto`; any other cursor is dropped with a warning, as
are `mix-blend-mode: plus-darker` and `text-decoration-line: overline`. `align-content: baseline` is
`start` in both engines. `border-style: none` and `hidden` draw no border whichever rule set the
width, as on the web, so `border-hidden border-x` draws no side.

The logical properties work: `inset-inline`, `inset-block`, `margin-inline`, `margin-block`,
`padding-inline` and `padding-block` with their `-start` and `-end` longhands, plus the border
shorthands `border-inline`, `border-block` and their `-start` and `-end` sides, so Tailwind's
`inset-x-*`, `inset-y-*`, `mx-*`, `ps-*`, `start-*` and the rest work. Block is top to bottom;
`-start`/`-end` are Yoga's edges, swapping in right-to-left. They compile to edges every view
reads, not the `insetInlineStart`/`marginBlock` aliases some views (`<safe-area-view>`) ignore.
Unlike a browser, a logical edge beats a physical one (`inset-inline-start` vs `left`) in any
order.

`border-style` is one value for all sides, so a disagreeing per-side style is dropped. `border-top`
and the other per-side shorthands set width and color, with `solid` or `none` as style.

A custom property can hold a font stack (read as its first family), a unitless line-height, an
`aspect-ratio` ratio, a whole `box-shadow` list, or bare color channels for `rgba(var(--channels),
<alpha>)` (Bootstrap). Shorthands may mix `var()`s and literals: `padding: var(--y) var(--x)`,
`border: var(--width) solid var(--colour)`. `flex: var(--grow)` is grow by the token, shrink 1,
basis 0; unset, it is the initial `0 1 auto` whatever a weaker rule set, as on the web, and
likewise for `flex-grow`, `flex-shrink` and `flex-basis` (the one place an unset token writes a
value, since Yoga's shrink is 0).

A length needs a unit: `margin-top: 3`, or a token holding a bare number where a length is read,
is dropped with a warning. `0` needs none, a bare number is a factor inside `calc()`, and
`line-height` takes a ratio. `opacity` is clamped to 0 to 1; a `font-weight` outside 1 to 1000 is
dropped.

`calc()` may add one viewport- or font-relative length to absolute ones (`calc(1.375rem + 1.5vw)`).
`min()`, `max()` and `clamp()` fold when every argument is absolute. A `calc()` may hold any number
of tokens with numbers and absolute lengths, `+ - * /` and brackets (`calc((var(--end) -
var(--start)) * 1px)`), computed on device with length tokens in points. A percentage, em or
viewport unit beside a token is dropped.

Switch-off keywords (`max-width: none`, `z-index: auto`, `letter-spacing: normal`, `filter: none`,
`box-shadow: none`) reset to native's default. CSS-wide keywords (`inherit`, `initial`, `unset`,
`revert`, `revert-layer`) are dropped with a warning.

Layout is Yoga's flexbox, with some differences from CSS. An absolutely positioned child's
percentage size is taken from the width offered to its parent, not the width the parent shrinks
to (`width: 84%` under an `align-self: flex-start` parent); give such a parent an explicit size.
Three more:

- A box whose margins are larger than its container is 0 high in Yoga, with its children
  overflowing it. A browser keeps the box as tall as its content.
- A percentage `min-height` is measured against the height of the box two levels up rather than the
  parent's: `min-height: 50%` in a 40-point box inside an 80-point one is 40 points, not 20.
- A percentage `gap` in a box with no fixed size along that axis grows the box by the gap. A
  browser resolves the percentage against the size the box ends up with.

Transitions, `animate.enter`/`animate.leave`, `@keyframes` and `animation`: see
[Animation](/packages/fabric/animation).

## What has nothing to map onto

These are dropped with a warning:

- `float`
- `grid` and its whole family
- `list-style`
- Table layout: `table-layout`, `border-collapse`, `caption-side`, `empty-cells`
- Multi-column layout
- `will-change`
- `contain`
- CSS counters
- `clip-path`

## What a warning says

Each warning names the file and line, what was dropped and why, and the native alternative if any:

```text
[solidnative] src/app/card.native.css:12: dropped 'float': 'float' has no React Native equivalent: no style prop of a native view does what it does. Lay the row out with flexbox: flex-direction: row on the parent.
```

The rest of the rule still applies. A rule whose selector native cannot match is dropped whole,
with a warning saying `dropped a rule` and why. A stylesheet lifted from a design system builds
as is, with a warning per web-only declaration. See [Metro](/packages/metro/configuration).
