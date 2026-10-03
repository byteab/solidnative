# @solid-native/components

The React Native element set as Solid components: `View`, `Text`, `ScrollView`, `TextInput` and the
rest, each committing as a real native view through React Native's Fabric renderer.

Alpha: APIs may change before 1.0.

## Install

Most apps start from `npx create-expo-app@latest my-app --template @solid-native/template`, which
already has this and its peers set up. Otherwise:

```sh
npm install @solid-native/components solid-js react-native
```

`react-native-gesture-handler` and `react-native-reanimated` are optional peers, needed only for
gestures and Reanimated worklets.

## Example

```tsx
import { View, Text } from '@solid-native/components';

export function Greeting(props: { name?: string }) {
  return (
    <View>
      <Text>Hello, {props.name ?? 'there'}</Text>
    </View>
  );
}
```

## What's in the package

- `.` - `View`, `Text`, `ScrollView`, `TextInput`, `Pressable`, `Image`, `Switch`,
  `ActivityIndicator`, `Modal`, `VirtualList`, `SafeAreaProvider`, `SafeAreaView`, and the event
  payload types (`LayoutEvent`, `TouchEvent`, `ScrollEvent`, `TextInputChangeEvent`, and more).
- `./gestures` - React Native Gesture Handler bindings.
- `./animations` - `AnimatedStyle`, `Animated` and `Easing`: React Native's graph on a device,
  a React-free one with the same API in a browser build (the `browser` export condition).
- `./reanimated` - Reanimated worklet bindings.

These three are separate entry points because each reaches into React Native's own uncompiled
source, which Node cannot parse; importing them from the main entry point would break loading this
package under Node (tests, tooling). `./solid` and `./solid/*` remain as aliases of the same
entries.

## Docs

- [Components](https://solid-native.com/packages/components)
- [Layout](https://solid-native.com/packages/components/layout),
  [scroll view](https://solid-native.com/packages/components/scroll-view),
  [keyboard-avoiding view](https://solid-native.com/packages/components/keyboard-avoiding-view),
  [lists](https://solid-native.com/packages/components/lists),
  [text](https://solid-native.com/packages/components/text),
  [image](https://solid-native.com/packages/components/image),
  [activity indicator](https://solid-native.com/packages/components/activity-indicator),
  [text input](https://solid-native.com/packages/components/input),
  [switch](https://solid-native.com/packages/components/switch),
  [pressable](https://solid-native.com/packages/components/pressable),
  [gestures](https://solid-native.com/packages/components/gestures),
  [modal](https://solid-native.com/packages/components/modal) and
  [animation](https://solid-native.com/packages/components/animation)
- [Root README](https://github.com/byteab/solid-native/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solid-native/blob/main/ARCHITECTURE.md)

## License

MIT
