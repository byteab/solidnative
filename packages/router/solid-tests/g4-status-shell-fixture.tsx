/** @jsxImportSource @solid-native/platform/solid */
import { onCleanup } from 'solid-js';
import {
  ColorScheme,
  StatusBar,
  ServiceScope,
  provideService,
  useService,
  useStatusBar,
} from '@solid-native/device/solid';
import {
  createNativeNavigation,
  NativeStackOutlet,
  NativeHeader,
  type NativeNavigation,
} from '@solid-native/router/solid';
import { SafeAreaProvider } from '../../components/src/solid/safe-area-provider.ts';

export function createStatusShellFixture(applied: (style: string) => void) {
  let navigation!: NativeNavigation;
  let theme!: (value: 'light' | 'dark') => void;
  const cleanups: string[] = [];
  const errors: unknown[] = [];
  function Home() {
    const color = useService(ColorScheme);
    useStatusBar(() => ({ style: color.current() === 'light' ? 'dark' : 'light' }));
    onCleanup(() => cleanups.push('home'));
    return (
      <view testID="home">
        <NativeHeader title="home" />
        <text>{color.current()}</text>
      </view>
    );
  }
  function Detail() {
    useStatusBar(() => ({ style: 'default' }));
    onCleanup(() => cleanups.push('detail'));
    return (
      <view testID="detail">
        <NativeHeader title="detail" />
      </view>
    );
  }
  function Shell() {
    navigation = createNativeNavigation(
      [
        { path: '/', component: Home },
        { path: '/detail', component: Detail },
      ],
      {
        onError: (error) => {
          errors.push(error);
        },
      },
    );
    return (
      <SafeAreaProvider>
        <NativeStackOutlet navigation={navigation} testID="stack" />
      </SafeAreaProvider>
    );
  }
  return {
    navigation: () => navigation,
    theme: (value: 'light' | 'dark') => theme(value),
    cleanups,
    errors,
    View: () => (
      <ServiceScope
        services={[
          provideService(ColorScheme.SOURCE, () => ({
            current: () => 'light',
            subscribe: (listener) => {
              theme = listener;
              return () => cleanups.push('color');
            },
          })),
          provideService(StatusBar.SOURCE, () => ({
            height: 0,
            setStyle: applied,
            setHidden() {},
            setBackgroundColor() {},
            setTranslucent() {},
          })),
        ]}
      >
        <Shell />
      </ServiceScope>
    ),
  };
}
