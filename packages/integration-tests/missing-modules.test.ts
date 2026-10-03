/**
 * What a service does when its Expo module is not in the app.
 *
 * On a platform the module exists for, a missing module is a mistake the developer can fix - the
 * package was never installed, or the app was not rebuilt after it was - so the service throws a
 * `MissingModuleError` that names the module and says what to run. Anywhere the module cannot
 * exist - an iOS-only module on Android, the web, and Node, where there is no platform at all - the
 * service goes inert, as code shared across platforms needs it to.
 *
 * The platform is `react-native`'s, reached through the same bare `require` the modules are, which
 * a test defines on the global; see `expo-sources.test.ts`.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { type ServiceToken } from '@solidnative/device/solid';
import { disposeServices, servicesWith } from './expo-service.ts';
import { MissingModuleError } from '@solidnative/expo';
import { AppInfo } from '@solidnative/expo/app-info';
import { AppleSignIn } from '@solidnative/expo/apple-sign-in';
import { assets } from '@solidnative/expo/assets';
import { BackgroundTask } from '@solidnative/expo/background-task';
import { Battery } from '@solidnative/expo/battery';
import { Biometrics } from '@solidnative/expo/biometrics';
import { Brightness } from '@solidnative/expo/brightness';
import { Browser } from '@solidnative/expo/browser';
import { Camera } from '@solidnative/expo/camera';
import { Clipboard } from '@solidnative/expo/clipboard';
import { Crypto } from '@solidnative/expo/crypto';
import { database } from '@solidnative/expo/database';
import { DocumentPicker } from '@solidnative/expo/document-picker';
import { FileSystem } from '@solidnative/expo/file-system';
import { Fonts } from '@solidnative/expo/fonts';
import { Haptics } from '@solidnative/expo/haptics';
import { ImageEditor } from '@solidnative/expo/image-editor';
import { ImagePicker } from '@solidnative/expo/image-picker';
import { KeepAwake } from '@solidnative/expo/keep-awake';
import { LanguageModel } from '@solidnative/expo/language-model';
import { Locale } from '@solidnative/expo/locale';
import { Location } from '@solidnative/expo/location';
import { MapView } from '@solidnative/expo/map-view';
import { MediaLibrary } from '@solidnative/expo/media-library';
import { Network } from '@solidnative/expo/network';
import { Notifications } from '@solidnative/expo/notifications';
import { DeviceOrientation } from '@solidnative/expo/orientation';
import { audioPlayer, videoPlayer } from '@solidnative/expo/player';
import { ScreenCapture } from '@solidnative/expo/screen-capture';
import { Accelerometer } from '@solidnative/expo/sensors';
import { SplashScreen } from '@solidnative/expo/splash-screen';
import { SecureStorage, Storage } from '@solidnative/expo/store';
import { StoreReview } from '@solidnative/expo/store-review';
import { Tracking } from '@solidnative/expo/tracking';
import { Updates } from '@solidnative/expo/updates';

type Platform = 'ios' | 'android' | 'web';

/** A device on `platform` whose app has none of the Expo modules in it. */
function on<T>(platform: Platform, run: () => T): T {
  const host = globalThis as Record<string, unknown>;
  host['require'] = (id: string) => {
    if (id === 'react-native') return { Platform: { OS: platform } };
    throw new Error(`Cannot find module '${id}'`);
  };
  try {
    return run();
  } finally {
    delete host['require'];
  }
}

afterEach(() => {
  disposeServices();
  delete (globalThis as Record<string, unknown>)['require'];
});

/**
 * A token's own default factory, run directly, as `expo-sources.test.ts` explains, under a fresh
 * owner and service scope: a service token's factory resolves its own source there.
 */
const factoryOf =
  <T>(token: ServiceToken<T>) =>
  (): T =>
    servicesWith([], () => token.create());

/** A screen's owner and service scope, which a resource or a player needs. */
const inContext = (run: () => unknown) => () => servicesWith([], run);

/**
 * Each service, how it reaches its module, the module, and where a missing one throws. A service
 * is inert on the web, which not every module supports; a database or a player cannot be inert,
 * so a missing module throws there too.
 */
const SERVICES: readonly [string, () => unknown, string, (readonly Platform[])?][] = [
  ['AppInfo', factoryOf(AppInfo.SOURCE), 'expo-application'],
  ['AppleSignIn', factoryOf(AppleSignIn.SOURCE), 'expo-apple-authentication', ['ios']],
  ['assets', inContext(() => assets(() => [])), 'expo-asset'],
  ['BackgroundTask', factoryOf(BackgroundTask.SOURCE), 'expo-background-task'],
  ['Battery', factoryOf(Battery.SOURCE), 'expo-battery'],
  ['Biometrics', factoryOf(Biometrics.SOURCE), 'expo-local-authentication'],
  ['Brightness', factoryOf(Brightness.SOURCE), 'expo-brightness'],
  ['Browser', factoryOf(Browser.SOURCE), 'expo-web-browser'],
  ['Camera', factoryOf(Camera.SOURCE), 'expo-camera'],
  ['Clipboard', factoryOf(Clipboard.SOURCE), 'expo-clipboard'],
  ['Crypto', factoryOf(Crypto.SOURCE), 'expo-crypto'],
  ['database', () => database('app.db').ready(), 'expo-sqlite', ['ios', 'android', 'web']],
  ['DocumentPicker', factoryOf(DocumentPicker.SOURCE), 'expo-document-picker'],
  ['FileSystem', factoryOf(FileSystem.SOURCE), 'expo-file-system'],
  ['Fonts', factoryOf(Fonts), 'expo-font'],
  ['Haptics', factoryOf(Haptics.SOURCE), 'expo-haptics'],
  ['ImageEditor', factoryOf(ImageEditor.SOURCE), 'expo-image-manipulator'],
  ['ImagePicker', factoryOf(ImagePicker.SOURCE), 'expo-image-picker'],
  ['KeepAwake', factoryOf(KeepAwake.SOURCE), 'expo-keep-awake'],
  ['LanguageModel', factoryOf(LanguageModel.SOURCE), 'expo-local-llm', ['ios']],
  ['Locale', factoryOf(Locale.SOURCE), 'expo-localization'],
  ['Location', factoryOf(Location.SOURCE), 'expo-location'],
  ['MapView', factoryOf(MapView.SOURCE), 'expo-maps'],
  ['MediaLibrary', factoryOf(MediaLibrary.SOURCE), 'expo-media-library'],
  ['Network', factoryOf(Network.SOURCE), 'expo-network'],
  ['Notifications', factoryOf(Notifications.SOURCE), 'expo-notifications'],
  ['DeviceOrientation', factoryOf(DeviceOrientation.SOURCE), 'expo-screen-orientation'],
  [
    'videoPlayer',
    inContext(() => videoPlayer('https://example.com/a.mp4')),
    'expo-video',
    ['ios', 'android', 'web'],
  ],
  [
    'audioPlayer',
    inContext(() => audioPlayer('https://example.com/a.mp3')),
    'expo-audio',
    ['ios', 'android', 'web'],
  ],
  ['ScreenCapture', factoryOf(ScreenCapture.SOURCE), 'expo-screen-capture'],
  ['Accelerometer', factoryOf(Accelerometer), 'expo-sensors'],
  ['SplashScreen', () => factoryOf(SplashScreen)().hold(), 'expo-splash-screen'],
  ['Storage', factoryOf(Storage), '@react-native-async-storage/async-storage'],
  ['SecureStorage', factoryOf(SecureStorage), 'expo-secure-store'],
  ['StoreReview', factoryOf(StoreReview.SOURCE), 'expo-store-review'],
  ['Tracking', factoryOf(Tracking.SOURCE), 'expo-tracking-transparency'],
  ['Updates', factoryOf(Updates.SOURCE), 'expo-updates'],
];

/** What a throw says: the module, and the two commands that fix it. */
function fixes(module: string, platform: Platform) {
  return (error: unknown) => {
    assert.ok(error instanceof MissingModuleError, `a MissingModuleError, not ${String(error)}`);
    assert.equal(error.module, module);
    assert.match(error.message, new RegExp(`npx expo install ${module.replace(/[/@]/g, '\\$&')}`));
    if (platform === 'web') {
      assert.match(error.message, /restart the dev server/);
      assert.doesNotMatch(
        error.message,
        /npx expo run:/,
        'there is no native build to redo on the web',
      );
    } else assert.match(error.message, new RegExp(`npx expo run:${platform}`));
    return true;
  };
}

describe('a service whose module is missing', () => {
  for (const [name, reach, module, platforms = ['ios', 'android']] of SERVICES) {
    it(`${name}: throws with what to run where ${module} exists, and is inert elsewhere`, async () => {
      for (const platform of ['ios', 'android', 'web'] as const) {
        const attempt = async () => {
          const reached = on(platform, reach);
          // A player or a database reaches its module on creation; the rest do so in the factory.
          if (reached instanceof Promise) await reached;
        };
        if (platforms.includes(platform)) await assert.rejects(attempt, fixes(module, platform));
        else await assert.doesNotReject(attempt, `${name} is inert on ${platform}`);
      }
    });
  }

  it('is inert in Node, where there is no platform to ask', () => {
    for (const [name, reach] of SERVICES) {
      if (name === 'database' || name === 'videoPlayer' || name === 'audioPlayer') continue;
      assert.doesNotThrow(reach, name);
    }
  });
});
