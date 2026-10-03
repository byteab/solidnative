/** @jsxImportSource @solid-native/platform/solid */
import assert from 'node:assert/strict';
import { createNativeRoot } from '@solid-native/platform/solid';
import { registerPlatformComponents } from '@solid-native/fabric';
import {
  Accessibility,
  ColorScheme,
  DeepLinks,
  HardwareBack,
  Keyboard,
  SafeArea,
  Screen,
  Sharing,
  StatusBar,
  provideService,
  type Scheme,
  type ServiceBinding,
  type ShareRequest,
} from '@solid-native/device/solid';
import { FileSystem, type NativeFile } from '@solid-native/expo/solid/file-system';
import { KeepAwake } from '@solid-native/expo/solid/keep-awake';
import { Location } from '@solid-native/expo/solid/location';
import { MapView, registerExpoMap } from '@solid-native/expo/solid/map-view';
import { Storage } from '@solid-native/expo/solid/store';
import type { NativeNavigation } from '@solid-native/router/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { RunsApplication } from '../src/app/app.solid.tsx';
import { SIMULATED_LOCATION_INTERVAL } from '../src/app/tracking/simulated-location-source.solid.ts';

export const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

export interface Natives {
  readonly shares: ShareRequest[];
  readonly written: Map<string, string>;
  readonly keepAwake: string[];
  readonly stored: Map<string, string>;
  readonly locationRequests: number[];
  permission: boolean;
  scheme: Scheme;
}

/** Every native boundary the app touches, faked; a real fast simulated route drives runs. */
function nativeServices(natives: Natives): ServiceBinding[] {
  const quiet = () => () => {};
  return [
    // Same simulated source as the app, only quick: milliseconds rather than minutes per run.
    provideService(SIMULATED_LOCATION_INTERVAL, () => 4),
    provideService(ColorScheme.SOURCE, () => ({
      current: () => natives.scheme,
      subscribe: quiet,
    })),
    provideService(Keyboard.SOURCE, () => ({ subscribe: quiet, dismiss() {} })),
    provideService(Accessibility.SOURCE, () => ({
      current: () => ({ screenReader: false, reduceMotion: false, boldText: false, fontScale: 1 }),
      subscribe: quiet,
      announce() {},
    })),
    provideService(Screen.SOURCE, () => ({
      current: () => ({ window: { width: 402, height: 874 }, screen: { width: 402, height: 874 } }),
      subscribe: quiet,
    })),
    provideService(SafeArea.SOURCE, () => ({ current: () => null, subscribe: quiet })),
    provideService(StatusBar.SOURCE, () => ({
      height: 0,
      setStyle() {},
      setHidden() {},
      setBackgroundColor() {},
      setTranslucent() {},
    })),
    provideService(DeepLinks.SOURCE, () => ({
      launchUrl: () => Promise.resolve(null),
      subscribe: quiet,
      open() {},
    })),
    provideService(HardwareBack.SOURCE, () => ({ subscribe: quiet })),
    provideService(Sharing.SOURCE, () => ({
      share: (request) => {
        natives.shares.push(request);
        return Promise.resolve({ action: 'sharedAction' });
      },
    })),
    provideService(FileSystem.SOURCE, () => ({
      cacheDirectory: { name: 'cache' },
      documentDirectory: { name: 'document' },
      file: (_directory, name): NativeFile => ({
        uri: `file:///cache/${name}`,
        get exists() {
          return natives.written.has(name);
        },
        size: 0,
        create: () => natives.written.set(name, ''),
        write: (content) => natives.written.set(name, String(content)),
        text: () => Promise.resolve(natives.written.get(name) ?? ''),
        textSync: () => natives.written.get(name) ?? '',
        bytes: () => Promise.resolve(new Uint8Array()),
        delete: () => natives.written.delete(name),
      }),
    })),
    provideService(KeepAwake.SOURCE, () => ({
      activate: (tag) => {
        natives.keepAwake.push(`+${tag}`);
        return Promise.resolve();
      },
      deactivate: (tag) => {
        natives.keepAwake.push(`-${tag}`);
        return Promise.resolve();
      },
    })),
    provideService(Storage.SOURCE, () => ({
      get: (key) => Promise.resolve(natives.stored.get(key) ?? null),
      set: (key, value) => {
        natives.stored.set(key, value);
        return Promise.resolve();
      },
      remove: (key) => {
        natives.stored.delete(key);
        return Promise.resolve();
      },
    })),
    provideService(Location.SOURCE, () => {
      const answer = () => ({
        status: natives.permission ? ('granted' as const) : ('denied' as const),
        granted: natives.permission,
        canAskAgain: true,
      });
      return {
        getForegroundPermissionsAsync: () => Promise.resolve(answer()),
        requestForegroundPermissionsAsync: () => {
          natives.locationRequests.push(Date.now());
          natives.permission = true;
          return Promise.resolve(answer());
        },
        getCurrentPositionAsync: () => Promise.reject(new Error('no GPS in tests')),
        watchPositionAsync: () => Promise.resolve({ remove() {} }),
      };
    }),
    provideService(MapView.SOURCE, () => null),
  ];
}

export function bootRuns(
  options: {
    platform?: 'ios' | 'android';
    services?: readonly ServiceBinding[];
    natives?: Partial<Natives>;
  } = {},
) {
  registerPlatformComponents(options.platform ?? 'ios');
  registerExpoMap(options.platform ?? 'ios');
  const natives: Natives = {
    shares: [],
    written: new Map(),
    keepAwake: [],
    stored: new Map(),
    locationRequests: [],
    permission: false,
    scheme: 'light',
    ...options.natives,
  };
  const fabric = createFakeFabric();
  const clock = createClock();
  const errors: unknown[] = [];
  let navigation!: NativeNavigation;
  const root = createNativeRoot({
    fabric,
    clock,
    rootTag: 1,
    engineOptions: { globalStyles: { rules: [] }, onError: (error) => errors.push(error) },
  });
  root.render(() => (
    <RunsApplication
      services={[...nativeServices(natives), ...(options.services ?? [])]}
      onError={(error) => errors.push(error)}
      onNavigation={(created) => {
        navigation = created;
      }}
    />
  ));
  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  const textOf = (node: FakeNode) =>
    flatten([node])
      .filter((child) => child.props['text'] !== undefined)
      .map((child) => String(child.props['text']))
      .join('');
  const renderedText = () =>
    nodes()
      .filter((node) => node.props['text'] !== undefined)
      .map((node) => String(node.props['text']))
      .join('');
  const byTestId = (id: string) => nodes().find((node) => node.props['testID'] === id);
  const button = (label: string) =>
    nodes().find(
      (node) =>
        node.instanceHandle.name === 'pressable' &&
        (node.props['accessibilityLabel'] === label || textOf(node) === label),
    );
  function finish() {
    for (let count = 0; count < 6; count++) {
      clock.flushMicrotasks();
      for (const stack of nodes().filter((node) => node.viewName === 'RNSScreenStack'))
        fabric.emit(stack, 'topFinishTransitioning');
    }
    clock.flushMicrotasks();
  }
  function press(label: string) {
    const node = button(label);
    assert.ok(node, `no button ${label}`);
    for (const type of ['topTouchStart', 'topTouchEnd']) {
      const touch = { identifier: 1, pageX: 1, pageY: 1 };
      fabric.emit(node, type, {
        ...touch,
        changedTouches: [touch],
        touches: type === 'topTouchEnd' ? [] : [touch],
      });
    }
    clock.flushMicrotasks();
  }
  async function waitFor(predicate: () => boolean, message = 'runs operation did not settle') {
    for (let count = 0; count < 500; count++) {
      finish();
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.ok(predicate(), message);
  }
  return {
    fabric,
    clock,
    root,
    natives,
    errors,
    navigation: () => navigation,
    nodes,
    textOf,
    renderedText,
    byTestId,
    button,
    finish,
    press,
    waitFor,
  };
}
