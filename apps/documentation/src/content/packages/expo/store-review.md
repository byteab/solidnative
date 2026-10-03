---
title: Store review
summary: Ask for a rating with the platform's own prompt, or link to the store page.
---

# Store review

`StoreReview` is the platform's "rate this app" prompt, bound to `expo-store-review`: the App
Store's review sheet on iOS, the Play Store's in-app review on Android.

The platform decides whether the prompt appears. iOS shows it at most three times a year and is
silent when it declines, so `request()` resolving does not mean anyone saw it. Ask after a success
(a task finished, not an app launched), never from a "Rate us" button - that is what the store page
is for.

## Install

```sh
npx expo install expo-store-review
```

```ts
import { StoreReview } from '@solidnative/expo/solid/store-review';
```

## The smallest useful example

```tsx
import { useService } from '@solidnative/device/solid';
import { Pressable, Text } from '@solidnative/components/solid';
import { StoreReview } from '@solidnative/expo/solid/store-review';

export function WorkoutDone() {
  const review = useService(StoreReview);
  const finish = async () => {
    if (await review.hasAction()) await review.request();
  };
  return (
    <Pressable onPress={finish}>
      <Text>Done</Text>
    </Pressable>
  );
}
```

## What it does

- **`available()`** - whether the platform has an in-app review prompt.
- **`hasAction()`** - whether `request()` would do anything (prompt, or store page).
- **`request()`** - shows the prompt; where there is none, opens the store page set as
  `ios.appStoreUrl` or `android.playStoreUrl` in the app config.
- **`storeUrl()`** - that store page, for a direct "rate us" link. Null when unset.

A call pending when the scope is disposed resolves to its empty answer (`false`, or nothing).

## Without the module

On iOS and Android, a missing `expo-store-review` (never installed, or not rebuilt since) throws a
`MissingModuleError` the first time `useService(StoreReview)` reaches for it, naming the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `StoreReview.SOURCE`, `available()` and `hasAction()`
resolve to `false`, `storeUrl()` is `null`, and `request()` does nothing.

## Reference

`StoreReview` is exported from `@solidnative/expo/solid/store-review`.

<!-- api: StoreReview -->
