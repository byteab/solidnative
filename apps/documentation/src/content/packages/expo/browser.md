---
title: Browser
summary: An in-app browser, and a sign-in session through expo-web-browser.
---

# Browser

`Browser` wraps `expo-web-browser`: an in-app browser, and sign-in through the system's
authentication session.

## Install

```sh
npx expo install expo-web-browser
```

```ts
import { Browser } from '@solid-native/expo/solid/browser';
```

## The smallest thing that works

```tsx
import { Pressable, Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Browser } from '@solid-native/expo/solid/browser';

export function SignIn() {
  const browser = useService(Browser);

  async function signIn() {
    const returned = await browser.signIn(
      'https://id.example.com/authorize?client_id=...&redirect_uri=myapp://signed-in',
      'myapp://signed-in',
    );
    if (returned) {
      const code = new URL(returned).searchParams.get('code');
    }
  }

  return (
    <Pressable onPress={signIn}>
      <Text>Sign in</Text>
    </Pressable>
  );
}
```

## Opening a page and signing in

- **`open(url)`** shows a page in the in-app browser (`SFSafariViewController` on iOS, a Custom Tab
  on Android) and resolves when the person closes it. Use it for anything but sign-in: a privacy
  policy, a receipt, an external link.
- **`signIn(url, redirectUrl)`** opens the system's _authentication_ session
  (`ASWebAuthenticationSession` on iOS, a Custom Tab on Android), which shares the browser's
  cookies and closes itself when the page redirects to `redirectUrl`. It resolves to that URL, with
  its `code` or `token` in the query string, or to **null** if the person closed it first.

Since iOS 11, `SFSafariViewController` no longer shares cookies with Safari, which is why sign-in
uses `ASWebAuthenticationSession`.

If the calling component is disposed while the page is open, `open()` resolves and `signIn()`
resolves to null.

## The full OAuth flow, with PKCE

For PKCE or a provider's discovery document, use `expo-auth-session`'s `AuthRequest`: a plain class
that needs no React, whose `promptAsync` opens the same session:

```ts
import { AuthRequest, makeRedirectUri, exchangeCodeAsync } from 'expo-auth-session';

const discovery = { authorizationEndpoint: '...', tokenEndpoint: '...' };
const request = new AuthRequest({
  clientId: 'my-client',
  scopes: ['openid', 'profile'],
  redirectUri: makeRedirectUri({ scheme: 'myapp' }),
});
const result = await request.promptAsync(discovery);
if (result.type === 'success') {
  const tokens = await exchangeCodeAsync(
    {
      clientId: 'my-client',
      code: result.params['code']!,
      redirectUri: request.redirectUri,
      extraParams: { code_verifier: request.codeVerifier! },
    },
    discovery,
  );
}
```

It is a separate package (`npx expo install expo-auth-session`); `Browser` does not depend on it.

## Without the module

On iOS and Android, a missing `expo-web-browser` (never installed, or not rebuilt since) throws a
`MissingModuleError` naming the fix when the service first reaches for it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, both calls resolve without opening anything; `signIn()`
resolves to null. A test supplies a `NativeBrowser` with
`provideService(Browser.SOURCE, () => fake)`.

## Reference

`Browser` is exported from `@solid-native/expo/solid/browser`.

<!-- api: Browser -->
