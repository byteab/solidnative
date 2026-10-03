/** @jsxImportSource @solidnative/platform/solid */
import { SafeAreaProvider } from '@solidnative/components/solid';
import { NativeStackOutlet, type NativeNavigation } from '@solidnative/router/solid';

/** The shell: a native stack, with the tab bar as its first screen. */
export function App(props: { navigation: NativeNavigation }) {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <NativeStackOutlet navigation={props.navigation} />
    </SafeAreaProvider>
  );
}
