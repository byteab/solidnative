/** @jsxImportSource @solidnative/platform/solid */
import { createEffect } from 'solid-js';
import { SafeAreaProvider } from '@solidnative/components/solid';
import { ColorScheme, StatusBar, useService } from '@solidnative/device/solid';
import { NativeStackOutlet, type NativeNavigation } from '@solidnative/router/solid';
import { ToastHost } from './overlays/toast-host.solid.tsx';

/** The actual canary shell. The caller supplies the complete application route navigation. */
export function App(props: { navigation: NativeNavigation }) {
  const scheme = useService(ColorScheme);
  const statusBar = useService(StatusBar);
  createEffect(() => statusBar.set({ style: scheme.current() === 'dark' ? 'light' : 'dark' }));
  return (
    <SafeAreaProvider class="screen">
      <NativeStackOutlet navigation={props.navigation} />
      <ToastHost />
    </SafeAreaProvider>
  );
}
