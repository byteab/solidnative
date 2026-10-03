---
title: Storage
summary: A persisted value as a writable Solid accessor, backed by AsyncStorage or the keychain.
---

# Storage

`Storage` and `SecureStorage` bind a key to a value that reads back once and writes through on
every set. The underlying APIs are already plain promises, so what this adds is the binding.

## Install

```sh
npx expo install @react-native-async-storage/async-storage expo-secure-store
```

```ts
import { Storage, SecureStorage } from '@solidnative/expo/solid/store';
```

Install only what you use: `Storage` needs `@react-native-async-storage/async-storage`,
`SecureStorage` needs `expo-secure-store`.

## The smallest useful example

```tsx
import { Pressable, Text } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Storage } from '@solidnative/expo/solid/store';

export function Settings() {
  const store = useService(Storage);
  const theme = store.signal<'light' | 'dark'>('theme', 'light');

  function toggleTheme() {
    theme.set(theme() === 'light' ? 'dark' : 'light');
  }

  return (
    <Pressable onPress={toggleTheme}>
      <Text>Theme: {theme()}</Text>
    </Pressable>
  );
}
```

`theme()` reads the preference; `theme.set('dark')` persists it. Nothing else to call.

## `signal(key, initial)`

Returns a `StoredSignal` (an accessor with `set` and `update`) that shows `initial` until the read
comes back - at least one turn for `Storage`; `SecureStorage` answers synchronously, so `initial`
is never shown. One service instance returns the same signal per key, so components bound to
`theme` stay in step. A `set` before the read returns wins over the stored value.

An `update` before the read returns shows at once against what is known, then is re-applied to the
stored value once it arrives and written: `notes.update((list) => [...list, note])` during startup
adds to the stored notes instead of replacing them. Updates after a `set` apply to what was set.

Values are JSON, since both native stores hold only strings. A value that fails to parse (say,
written by an older app version) is treated as absent, so `initial` comes back instead of an error.
A stored `null` is valid JSON: `signal<string | null>('choice', 'fallback')` reads back `null`.

## `remove(key)`

Forgets a key in the native store and resets its signal to the `initial` it was first asked for
with. It stays the one signal for that key, so a later `signal(key, somethingElse)` returns it still
holding the first `initial`. A read in flight during `remove()` does not bring the old value back.

The promise rejects if the platform could not remove the key; the failure is also on `error`.

## `ready`

An accessor: true once every key asked for so far has been read back (and before any is asked for),
false while a read is outstanding. Most components do not need it, since signals show `initial`
until their read is back. A failed read counts as read back, so `ready` never hangs: the signal
keeps `initial` and the failure is on `error`.

## When the platform fails

Reads and writes can fail (full disk, locked keychain, rejected value). None become unhandled
rejections:

- **`error`** - an accessor with the latest read or write failure as an `Error`, or `null`. `set()`
  has no promise, so its failures land here. The signal keeps the set value either way.
- **`flush()`** - waits for every write sent so far and rejects with the first write failure since
  the previous `flush()` (including one before the call). Each failure rejects one flush only. Await
  it where persistence must be known, such as before signing out.
- **`remove(key)`** - rejects with its own failure.

```tsx
import { Show } from '@solidnative/platform/solid';
import { Pressable, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Storage } from '@solidnative/expo/solid/store';

export function Draft() {
  const store = useService(Storage);
  const draft = store.signal('draft', '');

  async function saveDraft() {
    draft.set('Dear diary');
    // Rejects if the write did not reach the disk; the message is on error() either way.
    await store.flush().catch(() => {});
  }

  return (
    <View>
      <Pressable onPress={saveDraft}>
        <Text>Save</Text>
      </Pressable>
      <Show when={store.error()}>{(error) => <Text>Could not save: {error().message}</Text>}</Show>
    </View>
  );
}
```

## `Storage` versus `SecureStorage`

Two services, both instances of the same `Store` class, so the choice is visible at `useService`.

- **`Storage`** - a plain key-value file: bigger, faster, readable by anyone with the device
  unlocked. For preferences and other non-secrets.
- **`SecureStorage`** - the iOS keychain or Android keystore: small values, async writes, an
  undocumented but real size limit. For tokens and anything that should not sit unencrypted in a
  backup.

## Without the module

On iOS and Android, a missing `@react-native-async-storage/async-storage` or `expo-secure-store`
(never installed, or not rebuilt since) throws a `MissingModuleError` when the store first reaches
for it, naming the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, reads resolve to `null` and writes are dropped: `signal()`
stays at `initial`, `ready` becomes `true`, `error` stays `null`, `flush()` resolves, nothing
throws. A test supplies its own `NativeStore` with `provideService(Storage.SOURCE, () => fake)` (or
`SecureStorage.SOURCE`).

Pending `flush()` and `remove()` answers belong to the component that called `useService`; once it
is disposed they resolve without reporting, and later writes are ignored.

## Working offline

`Storage` caches one value (a preference, a "last synced at" timestamp), not a list - use
[Database](/packages/expo/database) for that. See [Working offline](/guide/offline) for the
pattern: show the cache immediately, refresh when connected, fall back to the cache offline.
