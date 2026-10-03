/** @jsxImportSource @solid-native/platform/solid */
import { Text, View } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './app.native.css';

export function App() {
  return withNativeStyles(sheet, () => (
    <View class="screen">
      <Text>Hello</Text>
    </View>
  ));
}
