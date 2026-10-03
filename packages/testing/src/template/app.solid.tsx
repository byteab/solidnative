/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, SafeAreaView, Text, View } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './app.native.css';

/**
 * The root component. Elements are the native components imported above, not DOM tags, and
 * `class` names resolve against `app.native.css`, compiled at build time into the sheet the engine
 * reads.
 */
export function App() {
  const [count, setCount] = createSignal(0);
  return withNativeStyles(sheet, () => (
    <SafeAreaView class="screen">
      <View class="body">
        <Text class="title">Solid, natively</Text>
        <Text class="hint">Real native views. React is never in the render path.</Text>

        <Pressable accessibilityRole="button" class="button" onPress={() => setCount(count() + 1)}>
          <Text class="label">Tapped {count()} times</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  ));
}
