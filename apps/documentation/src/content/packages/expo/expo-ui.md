---
title: Expo UI
summary: Real SwiftUI and Jetpack Compose controls as Solid components, inside a UiHost.
---

# Expo UI

Every `@expo/ui` view is a real platform control - a real `Picker`, `BottomSheet` or `Gauge`.
It reaches them through `requireNativeView('ExpoUI', ...)`, the derivation `registerExpoView`
mirrors, so the whole surface is available here as a table of names.

## Install

```sh
npx expo install @expo/ui
```

```ts
import { registerExpoUiViews, UiHost, UiMenu, UiButton } from '@solid-native/expo/solid';
```

The components are also on their own entry point, `@solid-native/expo/solid/expo-ui-components`.

## The smallest thing that works

```ts
import { Platform } from 'react-native';
import { registerExpoUiViews } from '@solid-native/expo/solid';

registerExpoUiViews(Platform.OS); // once, before the app mounts
```

```tsx
import { createSignal } from 'solid-js';
import { UiHost, UiSlider } from '@solid-native/expo/solid';

export function Volume() {
  const [volume, setVolume] = createSignal(0.5);
  return (
    <UiHost style={{ height: 44 }}>
      <UiSlider value={volume()} onValueChanged={(event) => setVolume(event.nativeEvent.value)} />
    </UiHost>
  );
}
```

## Registering the views

**`registerExpoUiViews(platform)`** registers every `@expo/ui` view the platform has at once
(unlike the other `register*` functions: it is one module, so an app has all of them or none). Call
it once at startup with `Platform.OS`.

Names are platform-neutral where both platforms have the control (`UiVStack` is Compose's `Column`
on Android). A one-platform control - SwiftUI's `Gauge`, Compose's `SearchBar` - exists only there;
the platform argument keeps the other from registering an element that commits as nothing.

## `UiHost` is required

**SwiftUI and Compose lay out their own subtrees.** `UiHost` bridges Yoga's layout to theirs; every
other `Ui*` component must sit inside one, or it has no size and does not appear (which looks like
a failed install). `matchContents` sizes the host to the SwiftUI content; `ignoreSafeArea` and
`useViewportSizeMeasurement` are the other host-level controls.

## Names, and the typed components

`registerExpoUiViews` registers all ninety-odd `@expo/ui` element names, but deliberately only the
most-used views below have a Solid component; the JSX types declare no raw `ui-*` elements, so any
other view (a `ui-gauge` with custom props, a `BottomSheet`, a Compose `SearchBar`) has no typed
Solid form today.

- **`UiHost`** - the bridge above.
- **`UiMenu`** - a SwiftUI `Menu`. Its trigger is the `label` prop (with an optional
  `systemImage`) or a `<UiSlot name="label">`; its items are children.
- **`UiButton`** - a SwiftUI `Button`, as a menu item or on its own. `role` is `'default'`,
  `'cancel'` or `'destructive'`; `onButtonPress` fires when it is tapped.
- **`UiDivider`** - a separator between groups of menu items.
- **`UiSlot`** - content for a named slot of its parent view, such as a menu's `label`.
  `extraProps` is what the slot tells its parent about itself, such as a swipe group's `edge`.
- **`UiList`** - a SwiftUI `List`.
- **`UiSwipeActions`** - the system's swipe actions on a list row, iOS only. The first child is
  the row, and each edge's actions are `UiButton`s in a
  `<UiSlot name="actions" extraProps={{ edge: 'trailing', allowsFullSwipe: true }}>`. A row in
  a scroll view that also scrolls sideways loses its swipes to that scroll view.
- **`UiVStack`** and **`UiHStack`** - SwiftUI's stacks, with `alignment` and `spacing`, and
  **`UiSpacer`** for the room left over in one.
- **`UiSlider`**, **`UiStepper`** and **`UiToggle`** - with `onValueChanged`, `onValueChange` and
  `onIsOnChange` for what the user did.
- **`UiTextField`** - its `text` is a `nativeState('')`, which the field writes to on the UI
  thread; `onTextChange` reports each change.
- **`UiColorPicker`**, **`UiGauge`** and **`UiProgress`**.
- **`UiForm`**, **`UiSection`** and **`UiLabeledContent`** - settings-style grouped rows.
- **`UiImage`** - an SF Symbol by `systemName`, or a picture by `uiImage` URL.
- **`UiText`** - a SwiftUI `Text`.
- **`UiDatePicker`** - a SwiftUI `DatePicker` (Compose's date picker on Android). Either controlled
  with `value` (a `Date`) or left to itself with `defaultValue`; `onValueChange` receives the new
  `Date`, `onTouch` fires on a user change, and `onDateChange` passes the raw native event. The
  raw `selection` ISO string, `displayedComponents`, `range`, `title` and `disabled` are props too.
- **`UiPicker`** - a SwiftUI `Picker`. `options` is a list of `{ value, label }`; `value` or
  `defaultValue`, `onValueChange`, `onTouch`, `onSelectionChange` and `disabled` work as on
  `UiDatePicker`, and `pickerStyle` (`'menu'`, `'segmented'`, `'wheel'`...) becomes the matching
  modifier.

Props pass straight to the node, `modifiers` included; a `UiModifier` is one SwiftUI modifier
shaped as `@expo/ui`'s modifier functions build them (`{ $type: 'frame', ... }`). Callbacks are
native events with the payload on `event.nativeEvent`, except `UiDatePicker`'s and `UiPicker`'s
`onValueChange`, which receive the value.

```tsx
<UiHost matchContents>
  <UiGauge value={0.4} modifiers={[{ $type: 'frame', width: 80, height: 80 }]} />
</UiHost>
```

Still call `registerExpoUiViews` first: the component supplies types, the registration makes the
element commit as the native view.

## Text field state: `nativeState`

`TextFieldView` and `SecureFieldView` take `text` as an `ObservableState`, sent as the shared
object's numeric id. Binding a string fails silently (`FieldInvalidTypeException`, logged not
thrown): the field still manages its own text, but ignores every value set from JavaScript.

**`nativeState(initial)`** builds the shared object and returns a `NativeState<T>`. Call it under a
Solid owner (a component body); it is released when that owner is disposed:

```tsx
import { createSignal } from 'solid-js';
import { nativeState, UiHost, UiTextField } from '@solid-native/expo/solid';

export function NameField() {
  const name = nativeState('');
  const [typed, setTyped] = createSignal('');
  return (
    <UiHost matchContents>
      <UiTextField text={name} onTextChange={(event) => setTyped(event.nativeEvent.value)} />
    </UiHost>
  );
}
```

`UiTextField` sends the `id` for you. The state lives natively with both sides holding a reference,
so writing it updates a field already on screen, caret included, which a signal and re-render
would not. `get()` reads the value (a `set()` is scheduled onto the UI thread, so it reads back only
after that runs, as with `@expo/ui`'s accessors), `set()` writes, and `release()` detaches early;
otherwise the owner's cleanup calls it.

Off a device `nativeState()` returns **null** and the `text` prop is absent, leaving the field
unmanaged rather than crashing. In a test, `provideService(NATIVE_STATE_SOURCE, () => fake)`
supplies one.

## Without the module

An element registered for `@expo/ui` when it is not installed commits as nothing
(`UnimplementedNativeView`). `nativeState()` returns null.

## Reference

<!-- api: UiHost -->
<!-- api: UiMenu -->
<!-- api: UiButton -->
<!-- api: UiDivider -->
<!-- api: UiSlot -->
<!-- api: UiList -->
<!-- api: UiSwipeActions -->
<!-- api: UiVStack -->
<!-- api: UiHStack -->
<!-- api: UiSpacer -->
<!-- api: UiSlider -->
<!-- api: UiStepper -->
<!-- api: UiToggle -->
<!-- api: UiTextField -->
<!-- api: UiColorPicker -->
<!-- api: UiGauge -->
<!-- api: UiProgress -->
<!-- api: UiForm -->
<!-- api: UiSection -->
<!-- api: UiLabeledContent -->
<!-- api: UiImage -->
<!-- api: UiText -->
<!-- api: UiDatePicker -->
<!-- api: UiPicker -->
