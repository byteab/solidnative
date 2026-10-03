---
title: Activity indicator
summary: ActivityIndicator, a native spinner, and why it needs an explicit size.
art: activity-indicator
---

# Activity indicator

`ActivityIndicator` is a spinner: `ActivityIndicatorView` on iOS, `AndroidProgressBar` on
Android.

```tsx
<ActivityIndicator size="large" color="#3a82f6" animating={loading()} />
```

`size` is `'small'` (default, 20 points), `'large'` (36 points) or a number for both dimensions.
`animating` (default `true`) starts and stops it; `hidesWhenStopped` (iOS, default `true`) hides it
while stopped.

## Why it carries an explicit size

The native view has no intrinsic size, so without one it stretches to fill its parent. The spinner
still draws centred, but the stretched box swallows taps meant for its neighbours.
`ActivityIndicator` always sends an explicit width and height.

## Android

`AndroidProgressBar` has no default drawable and crashes the screen if the first commit lacks one,
so `styleAttr` (`'Normal'` for every size, as React Native sends) and `indeterminate` (`true`) are
always sent on Android. iOS has no equivalent props.

<!-- api: ActivityIndicator -->
