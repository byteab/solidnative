/** @jsxImportSource @solid-native/platform/solid */
import { provideKeyboardController } from '@solid-native/components/solid';
import { getOwner, runWithOwner } from 'solid-js';
import {
  DeepLinks,
  HardwareBack,
  ServiceScope,
  provideService,
  useService,
  type ServiceBinding,
} from '@solid-native/device/solid';
import {
  NativeBarDefaults,
  bindNativeNavigation,
  createNativeNavigation,
  type NativeNavigation,
  type NativeNavigationBinding,
} from '@solid-native/router/solid';
import type { HostChild } from '@solid-native/platform/solid';
import { palette } from './palette-values.ts';
import { App } from './app.solid.tsx';
import { createCanaryRoutes } from './app.routes.solid.ts';
import { createSession, Session } from './auth/session.solid.ts';
import { projectLinkParent } from './projects/project-links.ts';

/** Create navigation beneath these owners so every retained route inherits app services/chrome. */
export function CanaryProviders(props: {
  services?: readonly ServiceBinding[];
  children?: HostChild;
}) {
  return (
    <ServiceScope services={[provideKeyboardController(), ...(props.services ?? [])]}>
      <NativeBarDefaults
        header={(scheme) => ({
          backgroundColor: palette[scheme].screen,
          titleColor: palette[scheme].textStrong,
          largeTitleColor: palette[scheme].textStrong,
          color: palette[scheme].accent,
        })}
        tabs={(scheme) => ({
          tintColor: palette[scheme].accent,
          backgroundColor: palette[scheme].screen,
        })}
      >
        {props.children}
      </NativeBarDefaults>
    </ServiceScope>
  );
}

export interface CanaryApplicationOptions {
  readonly services?: readonly ServiceBinding[];
  readonly initialPath?: string;
  readonly sessionDelay?: number;
  readonly onError?: (error: unknown) => void;
  readonly onNavigation?: (navigation: NativeNavigation, binding: NativeNavigationBinding) => void;
}

/** One application scope owns session state, retained screens, links and hardware back. */
export function CanaryApplication(props: CanaryApplicationOptions) {
  let navigation!: NativeNavigation;
  function Shell() {
    const owner = getOwner()!;
    navigation = createNativeNavigation(
      createCanaryRoutes(() => runWithOwner(owner, () => useService(Session))!),
      { onError: props.onError },
    );
    const binding = bindNativeNavigation(navigation, {
      links: useService(DeepLinks),
      back: useService(HardwareBack),
      initialPath: props.initialPath,
      parentOf: projectLinkParent,
      onError: props.onError,
    });
    props.onNavigation?.(navigation, binding);
    return <App navigation={navigation} />;
  }
  return (
    <CanaryProviders
      services={[
        provideService(Session, () => createSession(navigation, props.sessionDelay)),
        ...(props.services ?? []),
      ]}
    >
      <Shell />
    </CanaryProviders>
  );
}
