---
title: Loading a language
summary: Choose the language and provide its catalog before the app's first frame.
---

# Loading a language

With catalogs from [Extracting messages](/guide/localization-extraction), a service picks the
language and serves its catalog:

```ts
// localisation.ts
import { createMemo } from 'solid-js';
import { createServiceToken, useService } from '@solid-native/device/solid';
import { Locale } from '@solid-native/expo/solid/locale';
import { SecureStorage } from '@solid-native/expo/solid/store';
import { en, type Messages } from './locale/en.ts';
import { fr } from './locale/fr.ts';

/** The language the source text is written in. */
const SOURCE = 'en';

const CATALOGS: Record<string, Messages> = { en, fr };

/** The first language in the list that this app has, or the source language. */
export function chooseLanguage(preferred: readonly (string | null | undefined)[]): string {
  return preferred.find((code): code is string => code != null && code in CATALOGS) ?? SOURCE;
}

export const Localisation = createServiceToken('app.localisation', () => {
  const locale = useService(Locale);
  const store = useService(SecureStorage);
  // The in-app choice, if the user made one; `null` follows the device.
  const choice = store.signal<string | null>('language', null);
  const language = createMemo(() =>
    chooseLanguage([choice(), ...locale.locales().map((entry) => entry.languageCode)]),
  );
  return {
    language,
    t: createMemo(() => CATALOGS[language()]!),
    choose: (code: string | null) => choice.set(code),
    /** Resolves once the choice is written to the device. */
    saved: () => store.flush(),
  };
});
```

`useService` resolves in the nearest `ServiceScope`; the first component to ask creates the
service and everything below shares it:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { ServiceScope } from '@solid-native/device/solid';
import { Home } from './home.solid.tsx';

export function App() {
  return (
    <ServiceScope>
      <Home />
    </ServiceScope>
  );
}
```

The in-app choice ([Switching language](/guide/localization-switching)) wins, then device
languages in order. Use `Locale.locales()`, not `Locale.locale()`: a user preferring German then
French should get French, not English, from an app without German. Unsupported languages fall back
to `SOURCE`.

The first frame is already correct: catalogs are bundled, and `SecureStorage` reads the saved
choice synchronously when the signal is created. Without the native module, `Locale` reports no
languages, so Node tests and browser previews render the source language.

Next: [Switching language](/guide/localization-switching) after startup.
