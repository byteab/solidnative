/** @jsxImportSource @solid-native/platform/solid */
import {
  ChevronDown,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-static';
import { SafeAreaProvider } from '@solid-native/components/solid';
import {
  DeepLinks,
  HardwareBack,
  ServiceScope,
  useService,
  type ServiceBinding,
} from '@solid-native/device/solid';
import { IconProvider } from '@solid-native/icons/solid';
import {
  NativeStackOutlet,
  bindNativeNavigation,
  createNativeNavigation,
  type NativeNavigation,
} from '@solid-native/router/solid';
import { routes } from './app.routes.solid.ts';

/**
 * Provided once, at the root, rather than repeated on every component that shows a transport
 * control: the mini player, Now Playing and the album screen's "Play all" all draw from it.
 */
const icons = {
  ChevronDown,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
};

/** The shell: a native stack, with the tab bar as its first screen. */
export function App(props: { navigation: NativeNavigation }) {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <NativeStackOutlet navigation={props.navigation} />
    </SafeAreaProvider>
  );
}

export interface MusicApplicationOptions {
  readonly services?: readonly ServiceBinding[];
  readonly initialPath?: string;
  readonly onError?: (error: unknown) => void;
  readonly onNavigation?: (navigation: NativeNavigation) => void;
}

/** One application scope owns playback, the retained screens, links and hardware back. */
export function MusicApplication(props: MusicApplicationOptions) {
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
      <IconProvider icons={icons}>
        <Shell />
      </IconProvider>
    </ServiceScope>
  );
}
