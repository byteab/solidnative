---
title: Switching language
summary: Change the language in the app with no restart, or let the system do it.
---

# Switching language

After [Loading a language](/guide/localization-loading), switching is a signal write: every
message read through `t()` in JSX re-renders in place, with no reload or remount.

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { For } from '@solid-native/platform/solid';
import { Localisation } from './localisation.ts';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
];

export function LanguagePicker() {
  const localisation = useService(Localisation);
  return (
    <View>
      <For each={LANGUAGES}>
        {(language) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: localisation.language() === language.code }}
            onPress={() => localisation.choose(language.code)}
          >
            <Text>{language.name}</Text>
          </Pressable>
        )}
      </For>
      <Pressable accessibilityRole="button" onPress={() => localisation.choose(null)}>
        <Text>{localisation.t().settings.followDevice}</Text>
      </Pressable>
    </View>
  );
}
```

`choose` updates the screen at once and persists to `expo-secure-store` in the background;
`saved()` resolves when the write lands. `choose(null)` follows the device again. Show language
names in their own language so users can recover from an unreadable choice. A string copied into a
constant or never-re-read state stays in the old language.

Alternatively, let the system do it: with `supportedLocales`, iOS and Android 13+ offer per-app
language settings, which `Locale` reports:

```json
{
  "expo": {
    "plugins": [["expo-localization", { "supportedLocales": ["en", "fr"] }]]
  }
}
```

`Locale` re-reads device languages when the app returns to the foreground, so the screen follows
with no app code. iOS terminates the app after a Settings language change anyway. Android's
behavior for a running React Native app is unverified.

Next: [Formatting and right to left](/guide/localization-formatting).
