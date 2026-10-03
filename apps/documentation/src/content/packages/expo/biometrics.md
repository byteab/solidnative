---
title: Biometrics
summary: Face ID, Touch ID and fingerprint unlock through one authenticate() call.
---

# Biometrics

`Biometrics` wraps `expo-local-authentication`: whether the device can authenticate the user, and
the system prompt that does it.

## Install

```sh
npx expo install expo-local-authentication
```

```ts
import { Biometrics } from '@solid-native/expo/solid/biometrics';
```

## The smallest thing that works

```tsx
import { useService } from '@solid-native/device/solid';
import { Pressable, Text } from '@solid-native/components/solid';
import { Biometrics } from '@solid-native/expo/solid/biometrics';

export function Wallet() {
  const biometrics = useService(Biometrics);

  async function unlock() {
    if (!(await biometrics.available())) return;
    const result = await biometrics.authenticate('Unlock your wallet');
    if (result.success) reveal();
  }

  return (
    <Pressable onPress={() => void unlock()}>
      <Text>Unlock</Text>
    </Pressable>
  );
}

function reveal(): void {}
```

## Checking and asking

- **`available()`** - whether there is a sensor _and_ something enrolled on it. Check before
  showing a "Use Face ID" button.
- **`kinds()`** - the kinds the device has (`'fingerprint'`, `'face'`, `'iris'`), so a button can
  say "Use Face ID" instead of "Use biometrics".
- **`authenticate(message, options)`** - shows the system prompt with `message` as the reason and
  resolves to `{ success: true }` or `{ success: false, error }`, where `error` is the platform's
  reason (`'user_cancel'`, `'lockout'`, `'not_enrolled'`, ...). `options` is
  `AuthenticateOptions`: `expo-local-authentication`'s options except `promptMessage`, namely
  `promptSubtitle`, `promptDescription`, `cancelLabel`, `disableDeviceFallback`,
  `requireConfirmation`, `biometricsSecurityLevel` and `fallbackLabel`.

A prompt still open when the calling component is disposed resolves to
`{ success: false, error: 'app_cancel' }`.

## Face ID needs a usage string

Without one, Face ID kills the app the first time it is asked. Add to `Info.plist`:

```xml
<key>NSFaceIDUsageDescription</key>
<string>Allow this app to use Face ID</string>
```

The module's config plugin writes this, and adds Android's `USE_BIOMETRIC` and `USE_FINGERPRINT`
permissions. Neither platform has a separate runtime permission dialog; `authenticate()` shows the
system UI.

## Without the module

On iOS and Android, a missing `expo-local-authentication` (never installed, or not rebuilt since)
throws a `MissingModuleError` when the service first reaches for it, naming the module and the
fix; see [Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake (`provideService(Biometrics.SOURCE, () => fake)` in a
`ServiceScope`), **`authenticate()` fails rather than passes** - `{ success: false, error:
'not_available' }` - unlike other services here, which report nothing. A lock that opens without
its sensor is not a lock. `available()` resolves to `false` and `kinds()` to an empty list.

## Reference

`Biometrics` is exported from `@solid-native/expo/solid/biometrics`.

<!-- api: Biometrics -->
