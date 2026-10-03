/** @jsxImportSource @solidnative/platform/solid */
import { SafeAreaProvider } from '@solidnative/components/solid';
import {
  DeepLinks,
  HardwareBack,
  ServiceScope,
  useService,
  type ServiceBinding,
} from '@solidnative/device/solid';
import {
  NativeStackOutlet,
  bindNativeNavigation,
  createNativeNavigation,
  type NativeNavigation,
} from '@solidnative/router/solid';
import { routes } from './app.routes.solid.ts';

/** The shell: a native stack, with the tab bar as its first screen. */
export function App(props: { navigation: NativeNavigation }) {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <NativeStackOutlet navigation={props.navigation} />
    </SafeAreaProvider>
  );
}

export interface RunsApplicationOptions {
  readonly services?: readonly ServiceBinding[];
  readonly initialPath?: string;
  readonly onError?: (error: unknown) => void;
  readonly onNavigation?: (navigation: NativeNavigation) => void;
}

/** One application scope owns the services, the retained screens, deep links and hardware back. */
export function RunsApplication(props: RunsApplicationOptions) {
  function Shell() {
    const navigation = createNativeNavigation(routes, { onError: props.onError });
    bindNativeNavigation(navigation, {
      links: useService(DeepLinks),
      back: useService(HardwareBack),
      initialPath: props.initialPath,
      onError: props.onError,
    });
    props.onNavigation?.(navigation);
    return <App navigation={navigation} />;
  }
  return (
    <ServiceScope services={props.services ?? []}>
      <Shell />
    </ServiceScope>
  );
}
