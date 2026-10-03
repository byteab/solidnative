---
title: Clipboard
summary: Read and write the pasteboard, and count changes without prompting for them.
---

# Clipboard

`Clipboard` reads and writes the system pasteboard. It uses `expo-clipboard`'s JavaScript rather
than the bare native module, since that carries the change event name and each call's option
defaults.

## Install

```sh
npx expo install expo-clipboard
```

```ts
import { Clipboard } from '@solid-native/expo/solid/clipboard';
```

## The smallest useful example

```tsx
import { useService } from '@solid-native/device/solid';
import { Pressable, Text } from '@solid-native/components/solid';
import { Clipboard } from '@solid-native/expo/solid/clipboard';

export function ShareLink() {
  const clipboard = useService(Clipboard);
  const copy = () => clipboard.write('https://example.com');
  return (
    <Pressable onPress={copy}>
      <Text>Copy link</Text>
    </Pressable>
  );
}
```

## What it does

- **`changes`** - an accessor counting pasteboard changes since the app started reading it. It
  holds a count, not the text, because on iOS 16+ _reading_ the clipboard prompts the user: an
  accessor holding the contents would prompt on every change, including other apps' changes.
- **`read()`** - resolves to the clipboard's text. On iOS 16+, this call prompts.
- **`write(text)`** - puts text on the clipboard; resolves once native has it.

There is one instance per `ServiceScope`, and its change listener is removed when the scope is
disposed, so remounting (a test, a reload, an embedding host) leaves no listener behind. A `read()`
or `write()` pending at disposal resolves to its empty answer (`''`, or nothing).

## Without the module

On iOS and Android, a missing `expo-clipboard` (never installed, or not rebuilt since) throws a
`MissingModuleError` naming the fix the first time `useService(Clipboard)` reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `Clipboard.SOURCE`, `changes` stays `0`, `read()` resolves
to `''` and `write()` does nothing.

## Reference

`Clipboard` is exported from `@solid-native/expo/solid/clipboard`.

<!-- api: Clipboard -->
