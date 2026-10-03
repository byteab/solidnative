/** @jsxImportSource @solid-native/platform/solid */
import { Text, View } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './app.native.css';

export function App() {
  return withNativeStyles(sheet, () => (
    <View class="screen">
      <Text class="title">Today</Text>
      <Text class="summary">3 left to do</Text>
      <View class="habit">
        <Text>Drink water</Text>
        <Text class="status">To do</Text>
      </View>
    </View>
  ));
}
