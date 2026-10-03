---
title: Variants
summary: Platform, dark-mode, hover and focus-visible variants, and what they mean on native.
---

# Variants

`@solid-native/tailwind` ships three stylesheets: `shared.css` (platform-independent), and
`native.css` and `web.css`, which import it and resolve the variants where touch and browser
disagree. Import `native.css` in an Expo app, `web.css` in a browser build.

## Platform, disabled and dark variants

The platform variants match an ancestor class: `platform-ios`, `platform-android` or
`platform-web`. `@solid-native/web/solid` adds `platform-web` to its root; on a phone, put the
class on your outermost view from `nativePlatform()` in `@solid-native/fabric`:

```tsx
<View class={`platform-${nativePlatform()}`} style={{ flex: 1 }}>
  {/* the app */}
</View>
```

Then `ios:`, `android:`, `web:` and `native:` (either native platform) work. A variant whose class
is absent just never matches - `ios:pt-2` in a shared class string is harmless on the web. Variants
stack: `android:dark:bg-zinc-950` applies on Android in dark mode, whether the classes sit on one
ancestor or two.

`disabled:` matches `[data-disabled]` as well as `:disabled`: the component consumes its `disabled`
prop and publishes `data-disabled` instead.

`dark:` matches a `.dark` class, which `watchConditions(root.engine)` (already called in the
template's `src/main.solid.ts`) keeps on the root in step with the system. For your own theme
switch, pass `{ darkClass: false }` and put `dark` on your outermost view:

```ts
watchConditions(root.engine, { sources, darkClass: false });
```

```tsx
<View class={theme()} style={{ flex: 1 }} />
```

Tailwind's own `dark:` is `@media (prefers-color-scheme: dark)`, which [the CSS
engine](/packages/fabric/css-engine) also answers; a class additionally lets a theme switch
disagree with the OS.

Custom-property palettes keep working too. The build inlines `var()` wherever it can, since the
device has no CSS parser. A property declared more than once with different values - `--primary`
under `:root` and `.dark`, the usual theme shape - is left for the runtime cascade to resolve per
node, so define tokens that way and the switch reaches them.

## `hover:` and `press:`

On native, `hover:` means pressed: `:hover` is dropped with a build warning (no pointer cascade),
and hover and press styles answer the same design question. The native preset maps it to `:active`
(set while a touch is down) and `data-hover`, for an iPad trackpad, which React Native's pointer
events report. Nothing sets `data-hover` for you; set it from your own pointer handlers. `press:`
and `hovered:` each name one half, for precision over portability.

On the web, `hover:` also keeps real `:hover`, so one class string behaves the same on desktop,
touchscreen laptop and phone browsers.

```css
/* native.css */
@custom-variant hover (&:active, &[data-hover]);

/* web.css */
@custom-variant hover (&:hover, &:active, &[data-hover]);
```

## `focus-visible:` and `focus:`

On native, `focus-visible:` aliases `focus:`: the web distinction (no ring on a clicked control)
has no case on a phone, where focus only comes from a keyboard, remote or assistive technology.
`:focus-visible` is dropped with a build warning there, like `:hover`. Both platforms also match
`[data-focus]`, because the ring's border and padding usually sit on a wrapper that can't see the
control's focus; set `data-focus` on it from the control's `onFocus` and `onBlur`.

## `peer-*` and `group-*`

`group-*` matches an ancestor with `group`, `peer-*` an earlier sibling with `peer`, as on the
web. The state must be visible to the engine: `peer-focus:` (focus or `data-focus`), `peer-active:`
and `peer-hover:` (a press), `peer-disabled:` (`disabled` prop or a text input's `data-disabled`),
`peer-data-[...]:`, `peer-aria-[...]:` on a real attribute, and arbitrary `peer-[.is-on]:`. A class
or state on the peer restyles the siblings after it.

```tsx
<TextInput class="peer border-b-hairline" placeholder="Email" />
<Text class="text-gray-500 peer-focus:text-green-600">We never share it</Text>
```

`peer-checked:` and `group-checked:` are dropped with a warning: a `Switch` keeps its state in its
`value` prop, which no selector reads. Publish it as an attribute and use the data variant:

```tsx
<Switch class="peer" value={on()} onValueChange={setOn} data-checked={on() ? '' : undefined} />
<Text class="peer-data-checked:text-green-600">On</Text>
```

## `font-mono`

Native `fontFamily` takes one name, and the compiler silently keeps only the first family of any
stack. Tailwind's `--font-mono` starts with `ui-monospace`, which neither iOS nor Android has, so
`font-mono` would fall back to the system font. `native.css` sets `--font-mono: 'Courier New'`
(real on both, even without a platform class) and upgrades it to Menlo on iOS and the `monospace`
alias (Roboto Mono) on Android once `.platform-ios`/`.platform-android` is present. `web.css`
doesn't import this; browsers resolve `ui-monospace`.

The same rule applies to any font stack you write: give native one real family.
