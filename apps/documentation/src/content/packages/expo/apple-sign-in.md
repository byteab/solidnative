---
title: Sign in with Apple
summary: Apple's sign-in sheet and its approved button, with a canceled sheet answering null.
---

# Sign in with Apple

`AppleSignIn` wraps `expo-apple-authentication`: availability, the sign-in sheet, and the checks
afterwards. `AppleSignInButton` is Apple's own button. The App Store requires Sign in with Apple
in an app that offers another social sign-in. iOS only; elsewhere `available()` is false.

## Install

```sh
npx expo install expo-apple-authentication
```

Turn the capability on in `app.json`, which adds the entitlement:

```json
{ "expo": { "ios": { "usesAppleSignIn": true } } }
```

```ts
import { AppleSignIn, AppleSignInButton } from '@solidnative/expo/solid/apple-sign-in';
```

`AppleSignInButton` registers its native view (`registerExpoViews('apple-sign-in-button')`, from
`@solidnative/expo/solid`) on first render, so no startup step is needed. An app that registers
its Expo views in one place can list it there too.

## The smallest thing that works

```tsx
import { createSignal, onMount } from 'solid-js';
import { useService } from '@solidnative/device/solid';
import { Show } from '@solidnative/platform/solid';
import {
  AppleAuthenticationScope,
  AppleSignIn,
  AppleSignInButton,
} from '@solidnative/expo/solid/apple-sign-in';

export function SignIn() {
  const apple = useService(AppleSignIn);
  const [offered, setOffered] = createSignal(false);
  onMount(() => void apple.available().then(setOffered));

  async function signIn() {
    const credential = await apple.signIn({
      requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
    });
    if (credential) startSession(credential.identityToken);
  }

  return (
    <Show when={offered()}>
      <AppleSignInButton
        class="h-12 w-full"
        buttonType="continue"
        cornerRadius={12}
        onButtonPress={() => void signIn()}
      />
    </Show>
  );
}

function startSession(token: string | null): void {}
```

## Signing in

- **`available()`** - whether the sheet can be shown (iOS 13+). Show the button only when true.
- **`signIn(options)`** - shows the sheet and resolves to the credential: a stable `user` id, an
  `identityToken` for your server to verify, and, the first time only, the user's name and email.
  Store those then; Apple does not send them again. A closed sheet resolves to null; other
  failures reject.
- **`refresh(options)`** and **`signOut(options)`** - the same request for a signed-in user.
- **`credentialState(user)`** - whether a credential is still authorized, for a launch check:
  `AppleAuthenticationCredentialState.AUTHORIZED`, `REVOKED`, `NOT_FOUND` or `TRANSFERRED`.
- **`formatName(fullName, style)`** - formats the credential's name for the user's locale.
- **`revoked`** - an accessor counting revocations of the app's access in Settings while it ran.
  Sign the user out when it changes.

`AppleAuthenticationScope`, `AppleAuthenticationCredentialState`, `AppleAuthenticationButtonType`
and `AppleAuthenticationButtonStyle` are the module's enums, re-exported as the same values so
code using them runs in a test. Requests belong to the component that called
`useService(AppleSignIn)`: one pending when it is disposed resolves to its empty answer (false or
null).

## The button

`AppleSignInButton` is `ASAuthorizationAppleIDButton`, approved by Apple's guidelines as is: its
wording, logo and colors are the system's, localized and accessible.

- **`buttonType`** - `sign-in` (the default), `continue` or `sign-up`.
- **`buttonStyle`** - `black` (the default), `white`, or `white-outline` for a white background.
- **`cornerRadius`** - in points.
- **`onButtonPress`** - the tap. Start `signIn()` here.

It also takes the ordinary view props (`class`, `style`, `accessibilityLabel`, `ref`, ...). It
needs a width and height to show. CSS background and border radius do not apply; use
`buttonStyle` and `cornerRadius`.

## Without the module

On iOS, a missing `expo-apple-authentication` (never installed, or not rebuilt since) throws a
`MissingModuleError` when `AppleSignIn` first reaches for it, naming the module and the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On Android and the web, and in a test with no fake (provide one with
`provideService(AppleSignIn.SOURCE, () => fake)` in a `ServiceScope`), `available()` resolves to
false, `signIn()`, `refresh()`, `signOut()` and `credentialState()` resolve to null, and
`formatName()` returns an empty string.

## Reference

`AppleSignIn` and `AppleSignInButton` are exported from `@solidnative/expo/solid/apple-sign-in`.

<!-- api: AppleSignIn -->
