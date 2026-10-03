/** @jsxImportSource @solidnative/platform/solid */
import {
  Accessibility,
  ColorScheme,
  SafeArea,
  Screen,
  StatusBar,
  provideService,
  useService,
} from '@solidnative/device/solid';
import { createNativeNavigation, type NativeNavigation } from '@solidnative/router/solid';
import { App } from '../src/app/app.solid.tsx';
import { CanaryProviders } from '../src/app/app.config.solid.tsx';
import { Home } from '../src/app/home/home.solid.tsx';
import { Toasts } from '../src/app/overlays/toasts.solid.ts';

/** Shell boundary regression. Test routes do not replace canary's complete application table. */
export function shellFixture() {
  let navigation!: NativeNavigation;
  let toasts!: Toasts;
  let theme!: (scheme: 'light' | 'dark') => void;
  const announcements: string[] = [];
  const status: string[] = [];
  const cleanups: string[] = [];
  const errors: unknown[] = [];
  function Shell() {
    navigation = createNativeNavigation(
      [
        { path: '/', component: Home },
        { path: '/projects', component: () => <text>Project destination test</text> },
      ],
      { onError: (error) => errors.push(error) },
    );
    toasts = useService(Toasts);
    return <App navigation={navigation} />;
  }
  return {
    navigation: () => navigation,
    toasts: () => toasts,
    theme: (value: 'light' | 'dark') => theme(value),
    announcements,
    status,
    cleanups,
    errors,
    Scene: () => (
      <CanaryProviders
        services={[
          provideService(ColorScheme.SOURCE, () => ({
            current: () => 'light',
            subscribe: (listener) => {
              theme = listener;
              return () => cleanups.push('theme');
            },
          })),
          provideService(Accessibility.SOURCE, () => ({
            current: () => ({
              screenReader: true,
              reduceMotion: false,
              boldText: false,
              fontScale: 1,
            }),
            subscribe: () => () => cleanups.push('accessibility'),
            announce: (text) => announcements.push(text),
          })),
          provideService(Screen.SOURCE, () => ({
            current: () => ({
              window: { width: 402, height: 874 },
              screen: { width: 402, height: 874 },
            }),
            subscribe: () => () => cleanups.push('screen'),
          })),
          provideService(SafeArea.SOURCE, () => ({
            current: () => null,
            subscribe: () => () => cleanups.push('safe-area'),
          })),
          provideService(StatusBar.SOURCE, () => ({
            height: 0,
            setStyle: (style) => status.push(style),
            setHidden() {},
            setBackgroundColor() {},
            setTranslucent() {},
          })),
        ]}
      >
        <Shell />
      </CanaryProviders>
    ),
  };
}
