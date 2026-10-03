# @solid-native/device

The host: the device, the operating system, and the user's settings, as Solid services.

Alpha: APIs may change before 1.0.

## Install

```sh
npm install @solid-native/device solid-js react-native
```

## Example

```tsx
import { createMemo } from 'solid-js';
import { Accessibility, Keyboard, Screen, useService } from '@solid-native/device';

export function useComposer() {
  const keyboard = useService(Keyboard);
  const screen = useService(Screen);
  const accessibility = useService(Accessibility);
  return {
    wide: createMemo(() => screen.window().width > 600),
    clearance: createMemo(() => keyboard.height() + 16),
    saved: () => accessibility.announce('Draft saved'),
  };
}
```

Each service is created on first use under the nearest `ServiceScope` (or the root), so one nobody
uses is never constructed.

| Service         | What                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `Keyboard`      | `height`, `visible` and the full `metrics`, plus `dismiss()`.          |
| `Screen`        | `window`, `display` and `orientation`, following a rotation.           |
| `ColorScheme`   | `current`: light or dark, as the user set it.                          |
| `AppState`      | `current` and `active`: whether the app is in front of the user.       |
| `Accessibility` | `screenReader`, `reduceMotion`, `boldText`, and `announce()`.          |
| `HardwareBack`  | `handle()`: Android's back button, answering whether it was consumed.  |
| `DeepLinks`     | `initialUrl()`, `subscribe()` and `open()`, as paths rather than urls. |

## Styling reads most of this without injecting anything

The engine answers `@media (prefers-color-scheme: dark)`, `(orientation: landscape)`,
`(min-width: …)` and `(prefers-reduced-motion: reduce)` from the same values, so styling should use
a media query and leave these services for the decisions CSS cannot make - which asset to load,
which native component to render, whether to announce something. `watchConditions` is what keeps the
engine in step; an app calls it once, next to mounting its root.

## Testing

Every service reads its platform through a source a test can replace with `provideService` inside
a `ServiceScope`, so the code under test stays real.

## Off a device

`react-native` is required lazily, inside each source, because React Native ships its JavaScript as
Flow and a static import would make this package - and `@solid-native/components`, which imports
it - unloadable in Node. Off a device the require finds nothing and every capability is inert: the
keyboard is never visible, the screen is zero by zero, a back handler is never called. That is the
same behavior as not providing the token that used to stand here, and it is what lets the test
suite import any of this without a simulator.
