---
title: Accessibility
summary: The screen reader, reduced motion, bold text and font scale settings `Accessibility` reports.
---

# Accessibility

`Accessibility` reports the user's system accessibility settings.

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, Text, View } from '@solid-native/components/solid';
import { Accessibility, useService } from '@solid-native/device/solid';

export function SearchResults() {
  const accessibility = useService(Accessibility);
  const [label, setLabel] = createSignal('');

  function showResults(count: number) {
    setLabel(`${count} results`);
    accessibility.announce(label());
  }

  return (
    <View>
      <Pressable onPress={() => showResults(3)}>
        <Text>Search</Text>
      </Pressable>
      <Text>{label()}</Text>
    </View>
  );
}
```

Components already apply accessibility defaults; use this for logic those cannot decide.
`screenReader` is VoiceOver or TalkBack running. `reduceMotion` matches
`@media (prefers-reduced-motion: reduce)`, better for styling. `boldText` is the heavier system
font. `fontScale` multiplies text size (1 default, past 3 at the largest), read at startup and on
return to the app. `announce(message)` speaks a change no focus move would reveal.

`watchConditions(root.engine, { sources })`, called in the template's `main.solid.ts`, remeasures
every `<Text>` and `<TextInput>` when the system text size changes; otherwise call
`root.engine.remeasureText()`. Values start neutral until React Native answers.

## Off a device and on the web

Off a device settings stay neutral and `announce()` does nothing. On the web the browser covers
most of this; `boldText` and `fontScale` come only from `Accessibility` on native.

## Reference

<!-- api: Accessibility -->
