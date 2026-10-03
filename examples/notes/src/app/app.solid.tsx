/** @jsxImportSource @solid-native/platform/solid */
import { SafeAreaProvider } from '@solid-native/components/solid';
import { NativeStackOutlet, type NativeNavigation } from '@solid-native/router/solid';

/** The shell: a native stack, with the tab bar as its first screen. */
export function App(props: { navigation: NativeNavigation }) {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <NativeStackOutlet navigation={props.navigation} />
    </SafeAreaProvider>
  );
}
