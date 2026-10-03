---
title: Locale
summary: The user's preferred locales and calendar settings, kept current as they change.
---

# Locale

`Locale` reports the user's preferred locales and calendar settings. `expo-localization`'s getters
are synchronous, so there is no placeholder default; the service exists because the answers
_change_ when the user switches language in Settings, and `Locale` keeps up.

## Install

```sh
npx expo install expo-localization
```

```ts
import { Locale } from '@solidnative/expo/solid/locale';
```

## The smallest useful example

```tsx
import { createMemo } from 'solid-js';
import { useService } from '@solidnative/device/solid';
import { Text } from '@solidnative/components/solid';
import { Locale } from '@solidnative/expo/solid/locale';

export function Today() {
  const locale = useService(Locale);
  const formatted = createMemo(() => new Intl.DateTimeFormat(locale.tag()).format(new Date()));
  return <Text>{formatted()}</Text>;
}
```

## What it reports

- **`locales`** - every preferred locale, most preferred first, at least one entry - so an app
  supporting the user's second language can use it instead of falling back to English.
- **`locale`** - the first of `locales`, the one to format with. Null before anything is installed.
- **`calendars`** - the user's calendar preferences: `calendar`, `timeZone`, `uses24hourClock`,
  `firstWeekday`.
- **`rtl`** - whether the preferred locale reads right to left (a layout decision, hence its own
  accessor).
- **`tag`** - the preferred locale's language tag, the string `Intl` wants; `undefined` until
  something is reported.

## When it updates

`expo-localization` does not export its hooks' internal listeners, and these changes happen in
Settings, outside the app. So `Locale` re-reads when the app returns to the foreground (via
`AppState`) - exactly when the answer can have changed.

## Without the module

On iOS and Android, a missing or not-yet-rebuilt `expo-localization` throws a `MissingModuleError` naming
the fix the first time `useService(Locale)` uses it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `Locale.SOURCE`, `locales` and `calendars` are empty arrays, `locale` is null, `rtl` is `false`, `tag` is
`undefined`.

## Reference

`Locale` is exported from `@solidnative/expo/solid/locale`, with the `LocaleLike` and `CalendarLike`
types.

<!-- api: Locale -->
