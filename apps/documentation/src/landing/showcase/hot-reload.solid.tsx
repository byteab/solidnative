/** @jsxImportSource @solid-native/platform/solid */
/*
 * The dev-loop showcase: one screen, photographed on the Android emulator before and after the
 * heading is edited while it runs. The landing page plays the edit beside the two captures; its
 * code sheet is this component.
 */
import { createSignal } from 'solid-js';
import { Pressable, Text, View } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './hot-reload.native.css';

export function App() {
  const [taps, setTaps] = createSignal(0);
  return withNativeStyles(sheet, () => (
    <View class="screen">
      <Text class="title">Hello, native</Text>
      <Text class="lede">One component, both platforms.</Text>
      <Pressable accessibilityRole="button" class="button" onPress={() => setTaps(taps() + 1)}>
        <Text class="label">Tapped {taps()} times</Text>
      </Pressable>
    </View>
  ));
}
