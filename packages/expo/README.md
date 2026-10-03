# @solidnative/expo

Expo's native modules as Solid services, and Expo's native views as elements.

Alpha: APIs may change before 1.0.

## Install

```sh
npm install @solidnative/expo
npm install solid-js expo
```

Every Expo module (`expo-haptics`, `expo-clipboard`, `expo-file-system`, and the rest) is an
optional peer dependency: install only the ones the app actually uses.

## Services

One entry point per module, so importing haptics does not bundle the file system. The `exports`
map takes `@solidnative/expo/haptics` to `src/solid/haptics.ts` (the `@solidnative/expo/solid/haptics`
spelling resolves to the same file). Each service is a token carrying its own factory, so there is
nothing to provide and nothing to register: `useService` inside a component is the whole setup, and
a service nobody asks for is never constructed. Whatever a service holds - a listener, a pending
request - is released with the owner that asked for it.

```tsx
import { useService } from '@solidnative/device/solid';
import { Clipboard } from '@solidnative/expo/clipboard';
import { FileSystem } from '@solidnative/expo/file-system';
import { Haptics } from '@solidnative/expo/haptics';

export function Notes() {
  const clipboard = useService(Clipboard);
  const files = useService(FileSystem);
  const haptics = useService(Haptics);

  async function save(text: string) {
    files.write(files.document('notes.txt'), text);
    await clipboard.write(text);
    haptics.notify('success');
  }
  // clipboard.changes() is an accessor: how many times the pasteboard has changed.
}
```

The names say what the thing is rather than who ships it. A few shapes are worth knowing about:

- `Clipboard.changes` counts pasteboard changes; it does not hold the contents. On iOS 16 and
  later, _reading_ the clipboard is what prompts the user for permission, so a signal that held
  the text would prompt on every change, including changes made by other apps.
- `Haptics` returns nothing and swallows failures: nobody awaits a vibration, and a device with no
  Taptic Engine would otherwise produce an unhandled rejection for an optional feature.
- `Fonts` and `SplashScreen` are called before anything mounts, so they are plain functions
  (`loadFonts`, `splashScreen.hold()`), not services.

## What this package costs to install

One package. Every Expo module is an **optional peer dependency**, so `pnpm add @solidnative/expo`
adds exactly itself. Nothing in the package statically imports an Expo module: each is reached by
a `require` inside the service's source factory, which Metro still resolves and bundles, while
Node (and a test) simply sees the module as absent and the service goes inert. On a device, a module
the app should have and does not throws a `MissingModuleError` naming it and the commands that fix
it.

That source factory is also the test seam, and it hangs off the service: `Clipboard.SOURCE`. A
test provides a fake for it and drives the real service:

```ts
withServiceScope([provideService(Clipboard.SOURCE, () => fake)], () => useService(Clipboard));
```

## Fonts and the splash screen

A font has to be registered with the platform before anything is laid out, so a face is declared
in CSS, collected at build time, and registered before the app mounts. The native splash hides
itself on the first frame, so hold it at module scope and hide it once the fonts are in:

```ts
import { splashScreen } from '@solidnative/expo/splash-screen';
import { loadFonts } from '@solidnative/expo/fonts';

splashScreen.hold();

AppRegistry.registerRunnable('main', ({ rootTag }) => {
  const fonts = loadFonts(globalStyles);
  mountNative(() => <App />, { fabric: getFabricUIManager(), rootTag });
  void splashScreen.hideWhenReady(fonts);
});
```

**There is no font matching on a device.** Native looks a family up by name, so a bold cut is a
family of its own: a `font-weight: 700` face is also registered as `Inter-700`.

## Device state, storage and permissions

Every module that reports something changing is a getter plus a listener; here that is one
accessor per value, owned by the component that reads it.

- `Network.reachable()` is `null` until the platform establishes it, which is **not** offline.
- `Battery.low()` is under a fifth _and not charging_.
- `DeviceOrientation` is the device, not the window; a layout wants the `orientation` media
  feature instead.
- `Brightness.set()` and `DeviceOrientation.lock()` return the function that undoes them, ready
  for `onCleanup`.
- Sensors subscribe only on `start(interval)`, which returns the stop function.
- `Storage` and `SecureStorage` hand back a persisted value as a signal that writes through when
  set; the same key always returns the same signal.
- `Permission.of(get, request)` wraps any Expo module's permission pair; `ensure()` checks first and
  does not ask once the platform has stopped asking, and `blocked()` says when to offer Settings.

## The rest

`ImagePicker`, `Location`, `Biometrics`, `Browser`, `AppInfo`, `Camera`, `StoreReview`, `Tracking`,
`DocumentPicker`, `Crypto`, `BackgroundTask`, `ScreenCapture`, `ImageEditor`, `MediaLibrary`,
`Notifications` (`take()` hands over the tap that launched the app, once), `Updates`, `Assets`,
`KeepAwake`, `LanguageModel`, the video/audio `player`, `MapView`, and `database(name, migrations)`
(opened on first use, once, migrations in transactions recorded in `user_version`) each live at
their own entry point under the same rules.

## Views

Most Expo modules need nothing from this package. What does is a module that renders:
`requireNativeViewManager` returns a React class, and the Fabric component underneath it is
registered under a name derived from the module name. `registerExpoView` derives the same name and
hands it to the engine:

```ts
import {
  registerExpoView,
  registerExpoViews,
  registerExpoUiViews,
  registerNativeViews,
} from '@solidnative/expo/views';

registerExpoViews('expo-image', 'expo-blur'); // Expo's own
registerNativeViews('web-view', 'slider'); // the community libraries in Expo's bundled list
registerExpoUiViews(Platform.OS); // every @expo/ui control the platform has
registerExpoView('my-module-view', 'MyModule'); // anything else
```

### @expo/ui

Every `@expo/ui` control is a real platform control. Element names are platform-neutral where both
platforms have the control; where only one does, the element exists only there. **A `<ui-host>`
is required around any of them**: it bridges Yoga's layout to SwiftUI's or Compose's, and without
one the control has no size.

The views apps reach for most (`UiHost`, `UiButton`, `UiSlider`, `UiPicker`, `UiDatePicker`, ...),
`ExpoImage`, `ExpoGlass`, `ExpoSymbol` and `SegmentedControl` have typed Solid components exported
from `@solidnative/expo`; keep registering the names too, since the registration is what makes the
element commit as the native view.
