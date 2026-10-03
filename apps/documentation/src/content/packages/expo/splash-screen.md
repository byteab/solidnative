---
title: Splash screen
summary: Holding the native splash until the app has something worth showing, and letting it go.
---

# Splash screen

`splashScreen` holds the native splash screen up, wired to `expo-splash-screen`. Ordering is the
whole feature: the native splash hides on the first frame, so an app that loads fonts before
mounting shows a blank window meanwhile.

## Install

```sh
npx expo install expo-splash-screen
```

```ts
import { splashScreen } from '@solid-native/expo/solid/splash-screen';
```

## The smallest useful example

Hold at module scope, before anything runs; hide after the first real frame:

```ts
import { AppRegistry } from 'react-native';
import { splashScreen } from '@solid-native/expo/solid/splash-screen';
import { loadFonts } from '@solid-native/expo/solid/fonts';
import globalStyles from './global-styles.native.css';

// At module scope, before anything renders.
splashScreen.hold();

AppRegistry.registerRunnable('main', ({ rootTag }) => {
  const fonts = loadFonts(globalStyles);
  mountApp(Number(rootTag)); // the app's own mount, with globalStyles as its global sheet
  void splashScreen.hideWhenReady(fonts).catch(() => {});
});
```

Mounting does not wait for the fonts; the splash does. Text laid out before they arrive stays
behind the splash, so nothing shows in the fallback face or reflows.

## `hold()`

Keeps the splash up; the first thing an entry file does. Failures (races with the splash already
gone) are swallowed so the app still starts. Only the first call does anything.

## `hide()`

Lets it go. Safe to call whether or not it was held.

## `hideWhenReady(work, nextFrame?)`

Hides once `work` settles _and_ one more frame has passed; hiding immediately would uncover the
empty frame drawn while it ran. If `work` fails it still hides, then rejects with that failure. A
`hold()` or `hide()` called while it waits supersedes it.

## Why this is a value, not a service

`hold()` runs before any Solid owner or service scope exists, so `splashScreen` is exported
directly. A `SplashScreen` service token exists too: `useService(SplashScreen)` gives a separate
`Splash` for that scope whose pending waits are cancelled on disposal - disposing never hides the
splash on another instance's behalf. A test provides a fake with
`provideService(SplashScreen.SOURCE, () => fake)`; startup code can call `new Splash(source)`.

## Without the module

On iOS and Android, a missing `expo-splash-screen` (never installed, or not rebuilt since) throws a
`MissingModuleError` when `hold()` first reaches for it, naming the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, `available` is `false` and `hold()`, `hide()` and
`hideWhenReady()` resolve without doing anything - matching reality, since without the module the
native splash hides on the first frame anyway.
