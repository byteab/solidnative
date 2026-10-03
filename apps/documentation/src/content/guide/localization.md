---
title: Localization
summary: Ship an app in more than one language with typed message catalogs that switch at runtime.
---

# Localization

solid-native has no i18n framework, message marker or extractor. It provides the parts underneath:
[`Locale`](/packages/expo/locale) for device languages, [`Direction`](/packages/device/direction)
for layout direction, Hermes' `Intl.NumberFormat` and `Intl.DateTimeFormat`, and Solid's reactivity,
which re-renders every message when the language changes.

This guide builds i18n from plain TypeScript: one catalog per language, a service that picks one,
and components that read from it. Apart from imported package APIs, everything in the snippets is
your app code. Catalogs are imported modules, so one build carries every language and nothing loads
over the network.

## Install

```sh
npx expo install expo-localization expo-secure-store
```

`Locale` reads device languages through `expo-localization`. `expo-secure-store` backs
`SecureStorage`, which remembers an in-app choice and reads it synchronously at startup; omit it if
the app always follows the device.

## Write the source catalog

The source catalog is an ordinary object. Text that takes values is a function, so a translation
can place them where its grammar needs:

```ts
// locale/en.ts
export const en = {
  home: {
    title: 'Your basket',
    greeting: (name: string) => `Hello, ${name}!`,
  },
  checkout: { pay: 'Pay now' },
  dialog: { close: 'Close the dialog' },
  settings: { followDevice: 'Use the device language' },
  basket: {
    count: (count: number) =>
      count === 0 ? 'Your basket is empty' : count === 1 ? 'One item' : `${count} items`,
  },
};

/** Every other language must match this shape; a missing key is a type error. */
export type Messages = typeof en;
```

[Extracting messages](/guide/localization-extraction) covers handing this file to translators.

## Use the messages

### In a component

`t()` from the `Localisation` service ([Loading a language](/guide/localization-loading)) returns
the current catalog. Reading it in JSX subscribes, so text follows a language change:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Localisation } from './localisation.ts';

export function BasketHeader(props: { name: string; count: number }) {
  const { t } = useService(Localisation);
  return (
    <View>
      <Text>{t().home.title}</Text>
      <Text>{t().home.greeting(props.name)}</Text>
      <Text>{t().basket.count(props.count)}</Text>
    </View>
  );
}
```

Read `t()` where the text is used: `const title = t().home.title` at the top of a component
freezes one language.

### Attributes

Accessibility text is a prop, translated the same way:

```tsx
<Pressable accessibilityRole="button" accessibilityLabel={t().dialog.close} onPress={close}>
  <Text>×</Text>
</Pressable>
```

Labels are invisible and easy to forget; listen for English, or silence, from a screen reader.

### Plurals and selects

There is no ICU syntax. A plural is a function that picks a form, as `basket.count` does. Hermes
has no `Intl.PluralRules` (`new Intl.PluralRules(...)` throws on device), so each catalog writes its
own rule: English needs `one` and `other`; Polish also has `few` and `many`.

A select is a branch: `<Switch>`/`<Match>` from `@solid-native/platform/solid` for an element, a
catalog function for a string:

```ts
reply: {
  line: (author: 'me' | 'them', name: string) =>
    author === 'me' ? 'You replied' : `${name} replied`,
},
```

## Recipes

- [Extracting messages](/guide/localization-extraction) - complete catalogs and translators.
- [Loading a language](/guide/localization-loading) - the right catalog before the first frame.
- [Switching language](/guide/localization-switching) - in the app, and following the system.
- [Formatting and right to left](/guide/localization-formatting) - dates, numbers, currency, mirroring.

## What does not exist

- **A message extractor.** The source catalog is the message list; see [Extracting messages](/guide/localization-extraction).
- **ICU plurals and selects.** Write them as catalog functions.
- **Build-time translation.** Catalogs are bundled together and chosen at runtime.
- **Locale data for formatting.** Hermes' `Intl` is used; see [Formatting and right to left](/guide/localization-formatting) for its gaps.
