---
title: End-to-end tests
summary: Driving the real app on a simulator with Maestro, in Expo Go or a development build.
---

# End-to-end tests

Fake Fabric tests can't show layout, a real keyboard, native gestures or native modules. For those,
[Maestro](https://maestro.mobile.dev) drives the real app through the accessibility tree.

## What each kind of test covers

| Question                                                     | Fake Fabric test | Maestro flow |
| ------------------------------------------------------------ | ---------------- | ------------ |
| Does the component render the right tree and props?          | Yes              | Indirectly   |
| Does a press, a change or a scroll reach the right handler?  | Yes              | Yes          |
| Do forms, services, requests and navigation behave?          | Yes              | Yes          |
| Is it laid out where it should be, and visible?              | No               | Yes          |
| Does typing on the real keyboard arrive intact?              | No               | Yes          |
| Do native gestures, transitions and animations run?          | No               | Yes          |
| Does a native module (camera, haptics, storage) do its part? | No               | Yes          |
| How long does it take?                                       | Milliseconds     | Seconds      |

Write most tests on the fake; keep Maestro for journeys that must work on a device.

## Selectors

- **`testID`**, matched with `id:`, is the most stable selector. `id` and `nativeID` commit as
  `nativeID`, which the accessibility tree does not expose.
- **`accessibilityLabel`**, matched with a plain string or `text:`.
- **Text**, matched the same way. On iOS a `<pressable>`'s label joins its text with commas; on
  Android each `<text>` is separate, so match both with `'Signal forms(, .*)?'`. Android lists only
  on-screen elements: `scrollUntilVisible` first.

Strings are regexes against the whole label: `'valid'` misses `'1 validation error(s)'`.

## With Expo Go

A flow launches Expo Go and opens the project's `npx expo start` URL. The canary's flows in
`examples/canary/.maestro` share this subflow:

```yaml
# Opens the canary in Expo Go, served by the Metro that `pnpm start` runs on this machine.
#
# Expo Go is one app hosting many projects, so there is no bundle of ours to launch: the flow
# restarts Expo Go, so the canary opens on its first screen rather than wherever the last flow
# left it, then opens the project's URL in it. Against a development build, replace everything
# below with `- launchApp` and pass `-e APP_ID=dev.solidnative.canary`.
#
# A subflow, kept out of the top level so `maestro test .maestro` does not run it as a test.
#
# `METRO` is the URL the device reaches Metro at, and `APP_ID` is Expo Go's id. The defaults are
# right for the iOS simulator. On the Android emulator Expo Go is `host.exp.exponent`, lowercase,
# and the host is 10.0.2.2: pass `-e APP_ID=host.exp.exponent -e METRO=exp://10.0.2.2:8081`.
appId: ${APP_ID || 'host.exp.Exponent'}
---
- stopApp
- launchApp
# Expo Go on Android drops a link that arrives while it is still starting, and stays on its own
# home screen.
- waitForAnimationToEnd
# Retried as insurance against the same drop on a slow start.
- retry:
    maxRetries: 2
    commands:
      - openLink: ${METRO || 'exp://127.0.0.1:8081'}
      # The first open bundles the app, which takes a while on a cold Metro.
      - extendedWaitUntil:
          visible: 'Solid Native'
          timeout: 60000
```

The forms flow types into a real field on the `createForm` screen:

```yaml
# Types into a real UITextField / EditText and reads back what createForm made of it.
#
# The one thing the fake-Fabric tests cannot show: that characters typed on a keyboard arrive,
# in order, through the native change events and the eventCount echo.
appId: ${APP_ID || 'host.exp.Exponent'}
---
- runFlow: subflows/open-canary.yaml
# On iOS a feature row is one accessibility element whose label joins its title and blurb; on
# Android the title is its own text, and only what is on screen is listed. This matches both.
- scrollUntilVisible:
    element: 'Signal forms(, .*)?'
- tapOn: 'Signal forms(, .*)?'
- assertVisible: '.*validation error.*'
# The field has no label of its own; its placeholder is what the accessibility tree reports.
- tapOn: 'name'
- inputText: 'Ada Lovelace'
- assertVisible: 'valid'
- assertVisible: '.*"name":"Ada Lovelace".*'
```

With a simulator booted and `pnpm start` running in `examples/canary`:

```sh
curl -fsSL "https://get.maestro.mobile.dev" | bash
maestro test examples/canary/.maestro
```

On Android:

```sh
maestro test -e APP_ID=host.exp.exponent -e METRO=exp://10.0.2.2:8081 examples/canary/.maestro
```

These flows are a starting point, not a CI gate; what CI runs is below.

## With a development build

Install with `npx expo run:ios` or `npx expo run:android`, run `npx expo start --dev-client`, and
replace the subflow with `- launchApp`, passing `app.json`'s identifier as `APP_ID`
(`-e APP_ID=dev.solidnative.canary`). A release build (`npx expo run:ios --configuration Release`)
needs no Metro and matches what users run.

## In CI

CI runs `examples/canary/.maestro/release/smoke.yaml` on the canary's release build (iOS simulator
and Android emulator) for ready-for-review PRs that change more than docs. It checks the first
screen, a native stack push/pop, `SafeAreaView` and combined Tailwind utilities, and fails on a
startup crash, the error screen or an `Unimplemented component` placeholder. Locally:

```sh
examples/canary/scripts/smoke-ios.sh path/to/canary.app /tmp/maestro
examples/canary/scripts/smoke-android.sh path/to/app-release.apk /tmp/maestro
```
