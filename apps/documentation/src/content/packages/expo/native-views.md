---
title: Native views
summary: Register an Expo module's view, or a community library's, as an element by name.
---

# Native views

Most Expo modules need nothing from this package: `requireNativeModule`, `EventEmitter`,
`SharedObject` and `SharedRef` have no React in them, so a module that only calls native is used as
its own docs say. A module that _renders_ reaches its Fabric component through
`requireNativeViewManager`, whose React parts are unreachable here and unneeded: the engine writes
props onto the shadow node, and Expo's Fabric views take an untyped prop map. What is left is the
name, which this page covers.

All of these are on `@solid-native/expo/solid`, not tied to one optional module.

```ts
import {
  registerExpoView,
  registerExpoViews,
  registerNativeViews,
  expoViewName,
} from '@solid-native/expo/solid';
```

## The smallest thing that works

The most common views have a typed Solid component that registers its element on first render:

```tsx
import { ExpoImage } from '@solid-native/expo/solid';

export function Cover(props: { uri: string }) {
  return (
    <ExpoImage source={{ uri: props.uri }} contentFit="cover" transition={{ duration: 400 }} />
  );
}
```

Its props are those the native view declares, as the React component would pass them after its
JavaScript resolving. For any other view, register the element by name once, before the app mounts:

```ts
import { registerExpoViews, registerNativeViews } from '@solid-native/expo/solid';

registerExpoViews('expo-blur');
registerNativeViews('web-view', 'slider');
```

The Solid JSX types declare only `view` and `text` as raw elements, so a registered element without
a component has no typed JSX form; [Typed components](#typed-components) are the supported way to
render from Solid.

## Expo's own views

**`registerExpoView(elementName, moduleName, options?)`** names one Expo module's view:
`registerExpoView('expo-image', 'ExpoImage')` makes `<expo-image>` commit as one. Call it at startup,
before the first commit using it. This is only the JavaScript half; the module must be installed.

`options.viewName` picks one of a module's several views (the default, first view takes none);
`options.defaultProps` are props the React component would have applied first, e.g. `expo-image`
resolving a `contentFit` string.

**`registerExpoViews(...elements)`** registers several known views at once, by element name:

```ts
registerExpoViews('expo-image', 'expo-blur', 'expo-camera');
```

It reads from the `EXPO_VIEWS` table:

| Element                                | Module view                             | Notes                                                                  |
| -------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `expo-image`                           | `ExpoImage`                             | Takes `source` as a list; a single `{ uri }` is wrapped by the caller. |
| `expo-blur`                            | `ExpoBlurView`                          | A blur of what is _behind_ a view - the one thing CSS cannot express.  |
| `expo-video`                           | `ExpoVideo` (`VideoView`)               | The player is a shared object the module hands out; this is its view.  |
| `expo-camera`                          | `ExpoCamera`                            | The module's default view. See [Camera](/packages/expo/camera).        |
| `apple-sign-in-button`                 | `ExpoAppleAuthentication`               | See [Sign in with Apple](/packages/expo/apple-sign-in). iOS only.      |
| `expo-symbol`                          | `SymbolModule`                          | SF Symbols, iOS only.                                                  |
| `expo-gl`                              | `ExpoGL`                                | Its context is reached through an event rather than a prop.            |
| `expo-glass`                           | `ExpoGlassEffect` (`GlassView`)         | The iOS 26 material. Renders as a plain view where unavailable.        |
| `expo-glass-container`                 | `ExpoGlassEffect` (`GlassContainer`)    | Glass views inside merge when they come within `spacing` points.       |
| `expo-mesh-gradient`                   | `ExpoMeshGradient` (`MeshGradientView`) | The one gradient with no CSS spelling.                                 |
| `expo-live-photo`                      | `ExpoLivePhoto` (`LivePhotoView`)       | iOS only.                                                              |
| `expo-maps-google` / `expo-maps-apple` | `ExpoGoogleMaps` / `ExpoAppleMaps`      | Two modules, one view each. Typed as one: [Maps](/packages/expo/maps). |

Registering an uninstalled one does not error; the element commits as nothing
(`UnimplementedNativeView`). Elements are named one at a time because JavaScript cannot tell which
modules are present without importing them all.

## Typed components

A registered element takes any props. These components type them against what native reads, do
what the module's React component does first, and register their own element:

| Component            | Element                | What it adds                                                                                              |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `ExpoImage`          | `expo-image`           | `source`, `placeholder`, `contentFit`, `onLoad`/`onError` typed; a single source is wrapped in a list.    |
| `ExpoGlass`          | `expo-glass`           | `glassEffectStyle` (`regular`, `clear`, `none`), `tintColor`, `isInteractive`, `colorScheme`.             |
| `ExpoGlassContainer` | `expo-glass-container` | `spacing`.                                                                                                |
| `ExpoSymbol`         | `expo-symbol`          | `name`, `type` (`monochrome` unless set), `weight`, `scale`, `colors`, a `size` in points, 24 unless set. |
| `AppleSignInButton`  | `apple-sign-in-button` | `buttonType` and `buttonStyle` by name. See [Sign in with Apple](/packages/expo/apple-sign-in).           |
| `SegmentedControl`   | `segmented-control`    | `values`, `selectedIndex`, `onChange`. See below.                                                         |

`AppleSignInButton` comes from `@solid-native/expo/solid/apple-sign-in`; the rest from
`@solid-native/expo/solid`.

```tsx
import { ExpoGlass, ExpoSymbol } from '@solid-native/expo/solid';

export function Like() {
  return (
    <ExpoGlass class="size-14 items-center justify-center rounded-full" isInteractive>
      <ExpoSymbol name="heart.fill" size={24} tintColor="#ff2d55" />
    </ExpoGlass>
  );
}
```

A glass view's corners are its `border-radius`. Before iOS 26 and on Android, `ExpoGlass` renders as
a plain view; `liquidGlassAvailable()` tells you, so you can set a fallback background.

## Community views

`NATIVE_VIEWS` and **`registerNativeViews(...elements)`** cover non-Expo libraries in Expo's bundled
module list, whose Fabric names come from each library's codegen spec rather than the
`ViewManagerAdapter_` names `registerExpoView` derives:

| Element                  | Library                                             | Notes                                                                        |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `web-view`               | `react-native-webview`                              |                                                                              |
| `slider`                 | `@react-native-community/slider`                    |                                                                              |
| `date-time-picker`       | `@react-native-community/datetimepicker`            | Android renders a dialog, iOS an inline view.                                |
| `picker` / `picker-item` | `@react-native-picker/picker`                       | Items are `<picker-item>` children.                                          |
| `segmented-control`      | `@react-native-segmented-control/segmented-control` | iOS only. See below.                                                         |
| `masked-view`            | `@react-native-masked-view/masked-view`             | `maskElement` is a prop, not a child.                                        |
| `pager-view`             | `react-native-pager-view`                           | The swipeable pager a tab layout is built on.                                |
| `lottie-view`            | `lottie-react-native`                               |                                                                              |
| `skia-view`              | `@shopify/react-native-skia`                        | Takes an imperative `picture`; declarative Skia elements do not come across. |
| `view-shot`              | `react-native-view-shot`                            | Captures whatever it wraps.                                                  |

`segmented-control` is a pre-Fabric view manager run through the interop layer, which installs its
`onChange` block only when the prop is set. `SegmentedControl`, the typed component over it,
registers the element itself; pass `onChange` or nothing fires:

```tsx
import { createSignal } from 'solid-js';
import { SegmentedControl } from '@solid-native/expo/solid';

export function Units() {
  const [index, setIndex] = createSignal(0);
  return (
    <SegmentedControl
      values={['km', 'mi']}
      selectedIndex={index()}
      onChange={(event) => setIndex(event.nativeEvent.selectedSegmentIndex)}
    />
  );
}
```

`skia-view` takes only a `picture` built with Skia's imperative `PictureRecorder` API. Skia's
declarative elements need its own React reconciler, unreachable here; they render nothing.

## Deriving the name yourself

**`expoViewName(moduleName, viewName?)`** computes the Fabric name `requireNativeViewManager` would:
`ViewManagerAdapter_<moduleName>` (or `ViewManagerAdapter_<moduleName>_<viewName>`), plus a per-app
suffix. The suffix cannot be hardcoded: Expo Go namespaces view names per project; a standalone
build has none. A wrong name commits as `UnimplementedNativeView` with no error.
`registerExpoView` calls this for you; use it directly only when registering a name another way.

## Without the module

An element for an uninstalled module or library commits as nothing (`UnimplementedNativeView`)
instead of throwing, just like a misspelled name, so check both first.

## Reference

<!-- api: SegmentedControl -->
