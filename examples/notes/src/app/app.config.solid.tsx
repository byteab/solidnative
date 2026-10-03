/** @jsxImportSource @solid-native/platform/solid */
import {
  DeepLinks,
  HardwareBack,
  ServiceScope,
  useService,
  type ServiceBinding,
} from '@solid-native/device/solid';
import {
  bindNativeNavigation,
  createNativeNavigation,
  type NativeNavigation,
} from '@solid-native/router/solid';
import { App } from './app.solid.tsx';
import { routes } from './app.routes.solid.ts';

export interface NotesApplicationOptions {
  readonly services?: readonly ServiceBinding[];
  readonly initialPath?: string;
  readonly onError?: (error: unknown) => void;
  readonly onNavigation?: (navigation: NativeNavigation) => void;
}

/** One application scope owns the sync engine, retained screens, links and hardware back. */
export function NotesApplication(props: NotesApplicationOptions) {
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
