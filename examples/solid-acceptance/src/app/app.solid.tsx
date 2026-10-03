/** @jsxImportSource @solidnative/platform/solid */
import { createEffect } from 'solid-js';
import { SafeAreaProvider } from '@solidnative/components';
import { ColorScheme, DeepLinks, HardwareBack, StatusBar, useService } from '@solidnative/device';
import { nativePlatform } from '@solidnative/fabric';
import {
  NativeStackOutlet,
  bindNativeNavigation,
  createNativeNavigation,
  type NativeNavigation,
} from '@solidnative/router';
import { routes } from './app.routes.solid.ts';

/**
 * The root component: a native stack whose first screen is the tab bar. Links
 * (`solidacceptance://detail/7`) and Android's back button drive the same navigation.
 */
export function App(props: { onNavigation?: (navigation: NativeNavigation) => void }) {
  const navigation = createNativeNavigation(routes);
  bindNativeNavigation(navigation, {
    links: useService(DeepLinks),
    back: useService(HardwareBack),
  });
  props.onNavigation?.(navigation);
  // Dark icons on a light screen and light on a dark one; Android draws them light otherwise.
  const scheme = useService(ColorScheme);
  const statusBar = useService(StatusBar);
  createEffect(() => statusBar.set({ style: scheme.current() === 'dark' ? 'light' : 'dark' }));
  // The class the Tailwind preset's ios: and android: variants match against.
  return (
    <SafeAreaProvider class={`platform-${nativePlatform()}`} style={{ flex: 1 }}>
      <NativeStackOutlet navigation={navigation} />
    </SafeAreaProvider>
  );
}
