---
title: Formatting and right to left
summary: Dates, numbers and currency through Hermes' Intl, and mirroring a layout for Arabic.
---

# Formatting and right to left

Beyond translations ([Localization](/guide/localization)), language affects formatting and layout direction.

## Dates, numbers and currency

Use Hermes' `Intl.DateTimeFormat` and `Intl.NumberFormat` with the language `Localisation` chose
([Loading a language](/guide/localization-loading)). Memos build each formatter once per language
and follow a switch:

```ts
// formatting.ts
import { createMemo } from 'solid-js';
import { createServiceToken, useService } from '@solid-native/device/solid';
import { Localisation } from './localisation.ts';

export const Formats = createServiceToken('app.formats', () => {
  const { language } = useService(Localisation);
  const date = createMemo(() => new Intl.DateTimeFormat(language(), { dateStyle: 'long' }));
  const number = createMemo(() => new Intl.NumberFormat(language(), { maximumFractionDigits: 2 }));
  const euros = createMemo(
    () => new Intl.NumberFormat(language(), { style: 'currency', currency: 'EUR' }),
  );
  return {
    date: (value: Date) => date().format(value),
    number: (value: number) => number().format(value),
    euros: (value: number) => euros().format(value),
  };
});
```

```tsx
const formats = useService(Formats);

<Text>{formats.date(when)}</Text>      // French: "24 septembre 2026"
<Text>{formats.number(1234567.891)}</Text>
<Text>{formats.euros(1234.5)}</Text>
```

French groups digits with narrow non-breaking spaces, as in a browser. For regional variants
(`fr-CA`, `en-GB`), pass the full tag, such as `Locale.tag()` from [`Locale`](/packages/expo/locale).

### Timezones

Hermes supports a named zone through `timeZone`:

```ts
new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', timeStyle: 'short' }).format(when);
// '23:30'
```

Without `timeZone`, the device's zone is used.

The iOS Hermes framework here has `Intl.Collator`, `Intl.DateTimeFormat` and `Intl.NumberFormat`,
but no `Intl.PluralRules`, `Intl.RelativeTimeFormat` or `Intl.ListFormat` (hence
[catalog plurals](/guide/localization#plurals-and-selects)). Feature-test first: `'PluralRules' in Intl`.

Language does not fix clock and calendar preferences. `Locale.calendars()` exposes
`uses24hourClock`, `firstWeekday` and `timeZone`, e.g. pass `hourCycle: 'h23'` when
`uses24hourClock` is true. Check such options on a device.

## Right to left

Enable `supportsRTL` in the plugin entry to lay out right-to-left languages:

```json
["expo-localization", { "supportedLocales": ["en", "ar"], "supportsRTL": true }]
```

React Native picks direction from the device language at startup, independent of translations,
and it cannot change while running. Padding, text alignment and row order mirror automatically.
For positions computed in TypeScript (a drawer's edge, a slider's drag direction), branch on
`useService(Direction).rtl()` from [`Direction`](/packages/device/direction), not `Locale.rtl()`,
which reports the language's direction rather than the layout's.
