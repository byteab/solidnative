/** @jsxImportSource @solidnative/platform/solid */
import {
  Accessibility,
  ColorScheme,
  Keyboard,
  SafeArea,
  Screen,
  StatusBar,
  provideService,
  useService,
  type KeyboardMetrics,
  type ServiceBinding,
} from '@solidnative/device/solid';
import {
  createNativeNavigation,
  type NativeNavigation,
  type NativeRoute,
} from '@solidnative/router/solid';
import { App } from '../src/app/app.solid.tsx';
import { CanaryProviders } from '../src/app/app.config.solid.tsx';
import { createSession, Session } from '../src/app/auth/session.solid.ts';

/** Actual consumer screens under the real App/providers. Routes here are test boundaries only. */
export function parityFixture(
  routes: (session: () => Session) => readonly NativeRoute[],
  services: readonly ServiceBinding[] = [],
) {
  let navigation!: NativeNavigation;
  let session!: Session;
  let keyboard!: (metrics: KeyboardMetrics) => void;
  const errors: unknown[] = [];
  const cleanups: string[] = [];
  function Shell() {
    navigation = createNativeNavigation(
      routes(() => session),
      { onError: (error) => errors.push(error) },
    );
    session = useService(Session);
    return <App navigation={navigation} />;
  }
  return {
    navigation: () => navigation,
    session: () => session,
    keyboard: (height: number) => keyboard({ height }),
    errors,
    cleanups,
    Scene: () => (
      <CanaryProviders
        services={[
          provideService(Session, () => createSession(navigation, 0)),
          provideService(ColorScheme.SOURCE, () => ({
            current: () => 'light',
            subscribe: () => () => cleanups.push('theme'),
          })),
          provideService(Keyboard.SOURCE, () => ({
            subscribe: (listener) => {
              keyboard = listener;
              return () => cleanups.push('keyboard');
            },
            dismiss() {},
          })),
          provideService(Accessibility.SOURCE, () => ({
            current: () => ({
              screenReader: false,
              reduceMotion: false,
              boldText: false,
              fontScale: 1,
            }),
            subscribe: () => () => cleanups.push('accessibility'),
            announce() {},
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
            setStyle() {},
            setHidden() {},
            setBackgroundColor() {},
            setTranslucent() {},
          })),
          ...services,
        ].filter(
          (binding, index, all) =>
            !all.slice(index + 1).some((other) => other.token === binding.token),
        )}
      >
        <Shell />
      </CanaryProviders>
    ),
  };
}
