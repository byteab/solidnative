---
title: Deployment
summary: Development builds, release builds, signing, EAS Build and local builds, and submitting to a store.
---

# Deployment

[Getting started](/guide/getting-started) uses Expo Go. Your own native code needs a build:

- A **development build** adds Expo's launcher, reload-on-save and dev menu, for native modules or
  dependency patches absent from Expo Go.
- A **preview build** is a release-mode build for device testing.
- A **release build** is minified and store-ready, without dev tools or reload code (see below).

## Configure the app

Native builds need reverse-DNS iOS bundle and Android package identifiers in `app.json`. Both are
permanent once shipped:

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.example.myapp"
    },
    "android": {
      "package": "com.example.myapp"
    }
  }
}
```

`version` is the store's human-readable version; iOS build numbers and Android version codes are
separate, and EAS Build increments them when a profile sets `autoIncrement`. The template has no
`android/` or `ios/` folder: `expo run` and EAS Build generate them from `app.json` with
`expo prebuild`, so config changes apply on the next build.

## Install `expo-dev-client` for a development build

```sh
npx expo install expo-dev-client
```

## Build

### Locally

```sh
npx expo run:ios
npx expo run:android
```

These need Xcode or Android Studio and install a development build on a connected device or
simulator. `--configuration Release` (iOS) or `--variant release` (Android) gives a local release
build, the closest local match to a store submission.

### With EAS Build

```sh
npm install -g eas-cli
eas login
eas build:configure
```

`eas build:configure` writes `eas.json`, with three profiles:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

`distribution: "internal"` allows direct-link installs without a store or a paid Apple developer
account. `developmentClient: true` includes `expo-dev-client` and Metro; release profiles omit it.
`autoIncrement` bumps the build number and version code so submissions never collide.

```sh
eas build --platform ios --profile development
eas build --platform android --profile preview
```

Builds run on Expo's machines; `--local` builds the same artifact with the `expo run` toolchain,
for when Expo's servers are unreachable or source must stay on the machine.

### Signing

The first cloud build per platform creates and stores the Apple certificate and provisioning
profile or the Android upload keystore; manage them with `eas credentials`. Local builds use the
machine's Xcode or Android Studio signing.

## Installing on a device

Install **internal** builds through their link or [Expo Orbit](https://expo.dev/orbit). iOS
devices must be registered to the signing account with `eas device:create`; Android APKs install
on any device that permits them. **Production** builds go through TestFlight or the Play Console's
internal testing track.

## Submit to a store

```sh
eas submit --platform ios
eas submit --platform android
```

This submits the profile's latest build (`--path` picks another). iOS needs an App Store Connect
API key or Apple ID; the build shows in TestFlight in ten to fifteen minutes. Android needs a
Google Play service account key and uploads to the track set in `eas.json` or on the command line.
For first submissions see [Submit to the Apple App Store](https://docs.expo.dev/submit/ios/) and
[Submit to the Google Play Store](https://docs.expo.dev/submit/android/).

## What a release build strips

Metro resolves `solid-js` to its production client build in every mode. The per-module reload
boundary exists only in development bundles, and Solid files carry no React Refresh registrations.
Release and preview builds are minified Hermes bytecode; development builds are unminified and
slower. See [Metro](/packages/metro).
