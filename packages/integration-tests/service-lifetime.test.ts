/**
 * A root service's native listeners end with the owner that made them.
 *
 * Each of these services subscribes to the platform when it is constructed, and a root service is
 * constructed once per app. That is once for the life of the process only while the app is never
 * torn down - and an app is torn down: by a test's `unmount`, by a reload, by a host that mounts
 * and unmounts one. Every one of those left a listener behind, still firing into a service nobody
 * could reach, so the count here is of listeners still attached after the app is destroyed.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ServiceToken } from '@solid-native/device/solid';
import {
  Accessibility,
  AppState,
  ColorScheme,
  Direction,
  Keyboard,
  Screen,
} from '@solid-native/device/solid';
import type { ObservedSource as Observed } from '@solid-native/device/solid';
import { Battery } from '@solid-native/expo/battery';
import { Clipboard } from '@solid-native/expo/clipboard';
import { LanguageModel } from '@solid-native/expo/language-model';
import { Locale } from '@solid-native/expo/locale';
import { Network } from '@solid-native/expo/network';
import { AppleSignIn } from '@solid-native/expo/apple-sign-in';
import { Notifications } from '@solid-native/expo/notifications';
import { DeviceOrientation } from '@solid-native/expo/orientation';
import { ScreenCapture } from '@solid-native/expo/screen-capture';
import { ownedService } from './expo-service.ts';

/** Listeners attached and not yet removed, across every fake below. */
let live = 0;

/** Attach one listener, and return what removes it. Removing twice counts once. */
function listen(): () => void {
  live++;
  let removed = false;
  return () => {
    if (!removed) live--;
    removed = true;
  };
}

const subscription = () => ({ remove: listen() });

function observedFake<T>(first: T): Observed<T> {
  return { current: async () => first, subscribe: listen };
}

const cases: readonly {
  name: string;
  service: ServiceToken<unknown> & { SOURCE: ServiceToken<unknown> };
  source: unknown;
}[] = [
  {
    name: 'Clipboard',
    service: Clipboard,
    source: {
      getStringAsync: async () => '',
      setStringAsync: async () => true,
      addClipboardListener: subscription,
    },
  },
  {
    name: 'ScreenCapture',
    service: ScreenCapture,
    source: { addScreenshotListener: subscription },
  },
  {
    name: 'Locale',
    service: Locale,
    source: { locales: () => [], calendars: () => [], onChange: listen },
  },
  {
    name: 'LanguageModel',
    service: LanguageModel,
    source: {
      availability: () => 'available',
      onAvailabilityChange: subscription,
      onDownloadProgress: subscription,
      download: async () => {},
      session: () => {
        throw new Error('not in this test');
      },
    },
  },
  {
    name: 'Notifications',
    service: Notifications,
    // expo-notifications' listeners hand back a subscription to remove, not a function.
    source: {
      addNotificationReceivedListener: () => ({ remove: listen() }),
      addNotificationResponseReceivedListener: () => ({ remove: listen() }),
      addNotificationsDroppedListener: () => ({ remove: listen() }),
      addPushTokenListener: () => ({ remove: listen() }),
      getLastNotificationResponseAsync: async () => null,
    },
  },
  {
    name: 'AppleSignIn',
    service: AppleSignIn,
    source: { addRevokeListener: () => ({ remove: listen() }) },
  },
  {
    name: 'Battery',
    service: Battery,
    source: {
      level: observedFake(0.5),
      state: observedFake('charging'),
      saving: observedFake(false),
    },
  },
  {
    name: 'Network',
    service: Network,
    source: observedFake({ connected: true, type: 'wifi', reachable: true }),
  },
  {
    name: 'DeviceOrientation',
    service: DeviceOrientation,
    source: {
      reported: observedFake('portrait'),
      lock: async () => {},
      unlock: async () => {},
    },
  },
  {
    name: 'AppState',
    service: AppState,
    source: { current: () => 'active', subscribe: listen },
  },
  {
    name: 'ColorScheme',
    service: ColorScheme,
    source: { current: () => 'light', subscribe: listen },
  },
  {
    name: 'Accessibility',
    service: Accessibility,
    source: {
      current: async () => ({
        screenReader: false,
        reduceMotion: false,
        boldText: false,
        fontScale: 1,
      }),
      subscribe: listen,
      announce: () => {},
    },
  },
  {
    name: 'Keyboard',
    service: Keyboard,
    source: { subscribe: listen, dismiss: () => {} },
  },
  {
    name: 'Direction',
    service: Direction,
    source: { current: () => 'ltr', subscribe: listen },
  },
  {
    name: 'Screen',
    service: Screen,
    source: {
      current: () => ({ window: { width: 1, height: 1 }, screen: { width: 1, height: 1 } }),
      subscribe: listen,
    },
  },
];

describe('a root service with a native listener', () => {
  for (const { name, service, source } of cases) {
    it(`${name} removes its listeners when its owner is disposed`, () => {
      live = 0;
      for (let round = 0; round < 5; round++) {
        const { stop } = ownedService(service, source);
        assert.ok(live > 0, 'the service did subscribe, so there is something to remove');
        stop();
        assert.equal(live, 0, `round ${round + 1}: every listener removed with the owner`);
      }
    });
  }
});
