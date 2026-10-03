# @solidnative/components

The React Native element set as Solid components: `View`, `Text`, `ScrollView`, `TextInput` and the
rest, each committing as a real native view through React Native's Fabric renderer.

Alpha: APIs may change before 1.0.

## Install

Most apps start from `npx create-expo-app@latest my-app --template @solidnative/template`, which
already has this and its peers set up. Otherwise:

```sh
npm install @solidnative/components solid-js react-native
```

`react-native-gesture-handler` and `react-native-reanimated` are optional peers, needed only for
gestures and Reanimated worklets.

## Example

```tsx
import { View, Text } from '@solidnative/components';

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

- [Components](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components.md)
- [Layout](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/layout.md),
  [scroll view](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/scroll-view.md),
  [keyboard-avoiding view](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/keyboard-avoiding-view.md),
  [lists](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/lists.md),
  [text](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/text.md),
  [image](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/image.md),
  [activity indicator](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/activity-indicator.md),
  [text input](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/input.md),
  [switch](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/switch.md),
  [pressable](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/pressable.md),
  [gestures](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/gestures.md),
  [modal](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/modal.md) and
  [animation](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/components/animation.md)
- [Root README](https://github.com/byteab/solidnative/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solidnative/blob/main/ARCHITECTURE.md)

## License

MIT
