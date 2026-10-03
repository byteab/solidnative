/** @jsxImportSource @solidnative/platform/solid */
import { Text, View } from '@solidnative/components/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import sheet from './app.native.css';

export function App() {
  return withNativeStyles(sheet, () => (
    <View class="screen">
      <Text class="title">Today</Text>
      <Text>3 left to do</Text>
    </View>
  ));
}
