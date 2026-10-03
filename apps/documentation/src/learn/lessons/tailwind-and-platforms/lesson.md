---
title: Tailwind and platforms
---

Stylesheets work, and for a small app they are plenty. Tailwind is the other way to style one.
`@solid-native/tailwind` takes the CSS Tailwind generates and passes it through the same native CSS
compiler as a `.native.css` file, so the two treat a declaration a device cannot draw the same way:
it is dropped with a build warning, and a utility with no native equivalent does nothing on the
device. The preset also adds what a phone needs and a browser does not: `ios:` and `android:`
variants, and safe-area utilities such as `pt-safe`.

The course sets Tailwind up for you. In an Expo app, a stylesheet imports Tailwind's theme and
utilities and `@solid-native/tailwind/native.css`, but not Tailwind's preflight, which is a browser
reset; `withTailwind` in the Metro config builds it; and the generated stylesheet goes to the native
root as `globalStyles`, so every component sees it without a `withNativeStyles` of its own.
[Tailwind](/packages/tailwind) covers the setup.

## Swap the screen's stylesheet for classes

Take `withNativeStyles` and the `app.native.css` import out of `app.tsx`, and put the same design on
the elements as classes:

```tsx
<View class="flex-1 gap-2 bg-zinc-100 px-5 pt-safe">
  <Text class="pt-4 text-3xl font-bold text-zinc-900">Today</Text>
  <Text class="text-zinc-500">{remaining()} left to do</Text>
  ...
</View>
```

`app.native.css` has nothing left to do, so it can go too. `pt-safe` applies the top safe-area
inset, and `pt-4` on the title adds the 16 points the stylesheet's calculation did. `pt-safe-4`
would do both on the screen in one class. Either reads the safe-area custom properties from the
first lesson, so on a device they need a `<SafeAreaProvider>` too.

## Style the habit row with utilities

Do the same in `habit-row.tsx`. `active:` styles the row while a finger is on it, and a class
chosen in code is a string like any other:

```tsx
<Pressable
  class="mt-2 flex-row items-center justify-between rounded-xl bg-white p-4 active:bg-zinc-200"
  accessibilityRole="button"
  onPress={() => props.onToggle?.()}
>
  <Text class="text-base text-zinc-900">{props.name}</Text>
  <Text class={props.done ? 'text-emerald-600' : 'text-zinc-500'}>
    {props.done ? 'Done' : 'To do'}
  </Text>
</Pressable>
```

## Look at home on each platform

`ios:` and `android:` apply a class on one platform only. They match a `platform-ios` or
`platform-android` class on the root of the app, which the preview puts there for the platform it
shows. For this design, give Android a smaller, medium-weight title, and iOS a small uppercase
count. These are design choices, not platform rules:

```tsx
<Text class="pt-4 text-3xl font-bold text-zinc-900 android:text-2xl android:font-medium">
  Today
</Text>
<Text class="text-zinc-500 ios:text-xs ios:font-semibold ios:uppercase">
  {remaining()} left to do
</Text>
```

Then add `android:rounded-md` to the pressable in `habit-row.tsx`, for squarer corners on Android.
Switch the preview between iOS and Android to compare.

## Follow the phone into dark mode

`dark:` applies beneath an element with the `dark` class. In an app generated from the template,
`main.solid.ts` calls `watchConditions(root.engine, { sources })`, which keeps that class on the
root in step with the system's color scheme, so `dark:` follows the phone with nothing more to
write. The preview's Dark setting does the same for the phone it shows.

Give the screen, the title and the rows their dark colors: `dark:bg-black` on the screen,
`dark:text-white` on the text, and `dark:bg-zinc-900` and `dark:active:bg-zinc-800` on the row.

Code that needs the scheme itself, to pick an image say, reads it from the `ColorScheme` service in
`@solid-native/device/solid`: `useService(ColorScheme).current()` is `'light'` or `'dark'`, and
follows the phone. An app with a theme switch of its own calls
`watchConditions(root.engine, { darkClass: false })` and puts the class on its root itself.
