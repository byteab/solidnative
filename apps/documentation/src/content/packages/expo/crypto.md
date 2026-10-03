---
title: Crypto
summary: Random UUIDs, secure random bytes and hashes, where Hermes has no Web Crypto.
---

# Crypto

`Crypto` provides random identifiers, secure random bytes and hashes, bound to `expo-crypto`.
Hermes has no Web Crypto, so `crypto.randomUUID()` does not exist on a device; use this instead.

It is the one Expo service that is not inert without its module: an empty identifier is a key every
record shares, and an empty hash matches every input. So without `expo-crypto`, every call throws
an error naming the package.

## Install

```sh
npx expo install expo-crypto
```

```ts
import { Crypto, CryptoDigestAlgorithm, CryptoEncoding } from '@solid-native/expo/solid/crypto';
```

## The smallest useful example

```tsx
import { createSignal } from 'solid-js';
import { Pressable, Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Crypto, CryptoDigestAlgorithm } from '@solid-native/expo/solid/crypto';

export function NewNote() {
  const crypto = useService(Crypto);
  const [id, setId] = createSignal('');

  async function createNote() {
    setId(crypto.randomUUID());
    console.log(await crypto.digestString(CryptoDigestAlgorithm.SHA256, id()));
  }

  return (
    <Pressable onPress={createNote}>
      <Text>New note {id()}</Text>
    </Pressable>
  );
}
```

## What it does

- **`randomUUID()`** - a version 4 UUID from the platform's secure random source.
- **`digestString(algorithm, text, options?)`** - a string's hash, hex by default or base64 with
  `{ encoding: CryptoEncoding.BASE64 }`.
- **`digest(algorithm, bytes)`** - the hash of bytes as an `ArrayBuffer`, like Web Crypto's `digest`.
- **`randomBytes(count)`** and **`randomBytesAsync(count)`** - 0 to 1024 secure random bytes, as a
  `Uint8Array`.
- **`randomValues(array)`** - fills an integer typed array with secure random values in place and
  returns it, like Web Crypto's `getRandomValues`.

`CryptoDigestAlgorithm` (`SHA1`, `SHA256`, `SHA384`, `SHA512`, `MD5`, and on iOS `MD2` and `MD4`)
and `CryptoEncoding` are plain constant objects exported beside the service, so hashing code runs in
a test without loading the module.

Once the calling component is disposed, a pending promise rejects with "Crypto request was
cancelled." and any further call throws.

AES encryption is not part of the service: `aesEncryptAsync` and `aesDecryptAsync` need the
module's own `AESEncryptionKey` and `AESSealedData` classes, so import `expo-crypto` directly.

## Without the module

On iOS and Android, a missing `expo-crypto` (never installed, or not rebuilt since) throws a
`MissingModuleError` naming the fix when the service first reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, every method throws (or rejects) with an error naming
`expo-crypto`. A test provides a fake `NativeCrypto` through
`provideService(Crypto.SOURCE, () => fake)` in a `ServiceScope`.

## Reference

`Crypto` is exported from `@solid-native/expo/solid/crypto`.

<!-- api: Crypto -->
