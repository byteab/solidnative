/** @jsxImportSource @solid-native/platform/solid */
import { SafeAreaProvider } from '@solid-native/components/solid';
import { DeepLinks, HardwareBack, ServiceScope, useService } from '@solid-native/device/solid';
import {
  NativeBarDefaults,
  NativeStackOutlet,
  bindNativeNavigation,
  createNativeNavigation,
} from '@solid-native/router/solid';
import { routes } from './app.routes.solid.ts';
import { accent } from './flock.solid.ts';

function Shell() {
  const navigation = createNativeNavigation(routes, { onError: console.error });
  bindNativeNavigation(navigation, {
    links: useService(DeepLinks),
    back: useService(HardwareBack),
  });
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <NativeStackOutlet navigation={navigation} />
    </SafeAreaProvider>
  );
}

/** The accent from Settings tints every bar: change it there and the whole app follows. */
export function FlockApplication() {
  return (
    <ServiceScope services={[]}>
      <NativeBarDefaults
        header={(scheme) => ({
          color: accent(),
          userInterfaceStyle: scheme,
          backgroundColor: scheme === 'dark' ? '#000000' : '#ffffff',
        })}
        tabs={(scheme) => ({
          tintColor: accent(),
          backgroundColor: scheme === 'dark' ? '#000000' : '#ffffff',
        })}
      >
        <Shell />
      </NativeBarDefaults>
    </ServiceScope>
  );
}
