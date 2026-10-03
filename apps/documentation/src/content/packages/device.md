---
title: Device
summary: Reactive Solid services for screen size, color scheme, safe areas and the rest of the host.
---

# Device

`@solid-native/device/solid` holds services describing the device and OS. Every value is a Solid
accessor, tracked like any signal.

Each service is a token that `useService()` resolves inside a `ServiceScope` near the app root;
unresolved tokens are never constructed:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Text } from '@solid-native/components/solid';
import { ColorScheme, ServiceScope, useService } from '@solid-native/device/solid';

function Header() {
  const scheme = useService(ColorScheme);
  return <Text>{scheme.current()}</Text>;
}

export function App() {
  return (
    <ServiceScope>
      <Header />
    </ServiceScope>
  );
}
```

Instances and their listeners are cleaned up with their scope. `useService()` outside a scope
throws. Prefer these over React Native's `Dimensions`, `Appearance`, `AppState` and the rest: no
subscriptions to tear down, and they work without a device (tests, the web host).

`conditionSources()`, `currentConditions()`, `deviceTokens()` and `watchConditions()` make `@media`
and `dark:` follow the device, as in the starter template's `src/main.solid.ts`.

## Off a device

React Native loads only when a service's default source is first resolved. Without it, sources
return a neutral value (`ColorScheme` reports `light`) and never throw.

A test or host drives most services by overriding their `SOURCE` token with `provideService()`
(`SafeArea`'s source is fed by `SafeAreaProvider`'s `report()` instead):

```tsx
<ServiceScope
  services={[
    provideService(ColorScheme.SOURCE, () => ({
      current: () => 'dark',
      subscribe: () => () => {},
    })),
  ]}
>
  <Header />
</ServiceScope>
```

Overriding the service token itself gives that subtree its own instance.

## The services

**Screen**

- [Screen](/packages/device/screen) - the window, the physical display, orientation, and the
  `compact` breakpoint.
- [Safe area](/packages/device/safe-area) - the insets `SafeArea` reports, fed by
  `SafeAreaProvider`.

**Appearance**

- [Color scheme](/packages/device/color-scheme) - light or dark, as the user set it.
- [Accessibility](/packages/device/accessibility) - screen reader, reduced motion, bold text and
  font scale.
- [Direction](/packages/device/direction) - left-to-right or right-to-left.

**System**

- [Status bar](/packages/device/status-bar) - a stack of claims on style, visibility and color.
- [Keyboard](/packages/device/keyboard) - height, position and animation timing.
- [Hardware back](/packages/device/hardware-back) - claiming Android's hardware back button.
- [App state](/packages/device/app-state) - whether the app is in front of the user.
- [Deep links](/packages/device/deep-links) - the launch url and every link that arrives after.
- [Android permissions](/packages/device/android-permissions) - runtime permissions, granted
  outright on iOS.
- [Layout animation](/packages/device/layout-animation) - animating a layout change CSS cannot
  express.

**Feedback**

- [Dialogs](/packages/device/dialogs) - the platform's own alert, confirmation, prompt, action
  sheet and toast.
- [Sharing](/packages/device/sharing) - the system share sheet.
- [Vibration](/packages/device/vibration) - the phone's motor.

**Development**

- [Dev menu](/packages/device/dev-menu) - switches in the shake menu, gone in a release build.
