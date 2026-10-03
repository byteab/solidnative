/**
 * The Expo modules an app reaches for when it needs the person holding the phone: their photos,
 * where they are, their face or fingerprint, a sign-in page, and the camera in front of them.
 *
 * Each service takes its module through a source token, so a fake stands in for Expo here. What is
 * pinned is what the service adds over the module: a cancelled picker is an empty list rather
 * than a result to unwrap, the camera is asked for before it is used, a position is a signal that
 * stops when told to, and a picture is taken from the view on screen without a React ref.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createNativeRoot } from '@solidnative/platform/solid';
import { createFakeFabric } from '@solidnative/testing';
import { registerExpoViews } from '@solidnative/expo';
import { AppInfo } from '@solidnative/expo/app-info';
import { Biometrics, type NativeBiometrics } from '@solidnative/expo/biometrics';
import { Browser, type NativeBrowser } from '@solidnative/expo/browser';
import type { CameraPicture } from '@solidnative/expo/camera';
import { ImagePicker, type NativeImagePicker } from '@solidnative/expo/image-picker';
import { Location, type NativeLocation, type Position } from '@solidnative/expo/location';
import type { PermissionResponse } from '@solidnative/expo';
import { expoCameraFixture } from './expo-camera-fixture.tsx';
import { disposeServices, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

const GRANTED: PermissionResponse = { status: 'granted', granted: true, canAskAgain: true };
const DENIED: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
const UNDETERMINED: PermissionResponse = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
};

const photo = { uri: 'file:///photo.jpg', width: 4032, height: 3024, type: 'image' as const };

describe('the image picker', () => {
  function picker(camera: PermissionResponse = GRANTED, answer = camera) {
    const calls: string[] = [];
    const native: NativeImagePicker = {
      launchImageLibraryAsync: async (options) => {
        calls.push(`library ${JSON.stringify(options ?? {})}`);
        return { canceled: false, assets: [photo] };
      },
      launchCameraAsync: async () => {
        calls.push('camera');
        return { canceled: false, assets: [photo] };
      },
      getMediaLibraryPermissionsAsync: async () => GRANTED,
      requestMediaLibraryPermissionsAsync: async () => GRANTED,
      getCameraPermissionsAsync: async () => camera,
      requestCameraPermissionsAsync: async () => {
        calls.push('ask for the camera');
        return answer;
      },
    };
    return {
      calls,
      native,
      picker: serviceWith(ImagePicker, native),
    };
  }

  it("answers with the picked assets, passing the options through as Expo's", async () => {
    const { picker: service, calls } = picker();
    assert.deepEqual(await service.pick({ allowsMultipleSelection: true }), [photo]);
    assert.deepEqual(calls, ['library {"allowsMultipleSelection":true}']);
  });

  it('answers a cancelled picker with no assets, not a result to unwrap', async () => {
    const { picker: service, native } = picker();
    native.launchImageLibraryAsync = async () => ({ canceled: true, assets: null });
    native.launchCameraAsync = async () => ({ canceled: true, assets: null });
    assert.deepEqual(await service.pick(), []);
    assert.deepEqual(await service.capture(), []);
  });

  it('asks for the camera before opening it, and only if asking would do something', async () => {
    const { picker: service, calls } = picker(UNDETERMINED, GRANTED);
    assert.deepEqual(await service.capture(), [photo]);
    assert.deepEqual(calls, ['ask for the camera', 'camera']);
  });

  it('does not open the camera without the permission', async () => {
    const { picker: service, calls } = picker(DENIED);
    assert.deepEqual(await service.capture(), []);
    assert.deepEqual(calls, [], 'no dialog the platform will not show, and no camera');
    assert.equal(service.cameraPermission.blocked(), true, 'blocked, so the app can say so');
  });

  it('is inert without the module', async () => {
    const service = serviceWith(ImagePicker, null);
    assert.deepEqual(await service.pick(), []);
    assert.deepEqual(await service.capture(), []);
  });
});

describe('the location', () => {
  const fix = (
    latitude: number,
  ): Parameters<Parameters<NativeLocation['watchPositionAsync']>[1]>[0] => ({
    coords: {
      latitude,
      longitude: -0.12,
      altitude: null,
      accuracy: 5,
      heading: null,
      speed: null,
    },
    timestamp: 1000,
  });

  function location(permission: PermissionResponse = GRANTED) {
    const log: unknown[] = [];
    let emit: ((reading: ReturnType<typeof fix>) => void) | null = null;
    const native: NativeLocation = {
      getForegroundPermissionsAsync: async () => permission,
      requestForegroundPermissionsAsync: async () => permission,
      getCurrentPositionAsync: async (options) => {
        log.push(['current', options]);
        return fix(51.5);
      },
      watchPositionAsync: async (options, callback) => {
        log.push(['watch', options]);
        emit = callback;
        return { remove: () => log.push('removed') };
      },
    };
    const service = serviceWith(Location, native);
    return { service, log, emit: (latitude: number) => emit?.(fix(latitude)) };
  }

  const expected = (latitude: number): Position => ({
    latitude,
    longitude: -0.12,
    altitude: null,
    accuracy: 5,
    heading: null,
    speed: null,
    timestamp: 1000,
  });

  it('is null until something has been read', () => {
    assert.equal(location().service.position(), null);
  });

  it('reads the position once, at the accuracy asked for, into the signal', async () => {
    const { service, log } = location();
    assert.deepEqual(await service.current('high'), expected(51.5));
    assert.deepEqual(service.position(), expected(51.5));
    assert.deepEqual(log, [['current', { accuracy: 4 }]], "Expo's own number for high");
  });

  it('follows the position while started, and stops when told to', async () => {
    const { service, log, emit } = location();
    const stop = await service.start({ accuracy: 'navigation', distance: 10 });
    emit(51.6);
    assert.deepEqual(service.position(), expected(51.6));
    stop();
    assert.deepEqual(log, [['watch', { accuracy: 6, distanceInterval: 10 }], 'removed']);
  });

  it('asks for the permission first, and does nothing without it', async () => {
    const { service, log } = location(DENIED);
    assert.equal(await service.current(), null);
    const stop = await service.start();
    stop();
    assert.deepEqual(log, [], 'no read the platform would refuse');
    assert.equal(service.permission.blocked(), true);
  });

  it('is inert without the module', async () => {
    const service = serviceWith(Location, null);
    assert.equal(await service.current(), null);
    (await service.start())();
    assert.equal(service.position(), null);
  });
});

describe('biometrics', () => {
  function biometrics(overrides: Partial<NativeBiometrics> = {}) {
    const prompts: unknown[] = [];
    const native: NativeBiometrics = {
      hasHardwareAsync: async () => true,
      isEnrolledAsync: async () => true,
      supportedAuthenticationTypesAsync: async () => [1, 2],
      authenticateAsync: async (options) => {
        prompts.push(options);
        return { success: true };
      },
      ...overrides,
    };
    return { prompts, service: serviceWith(Biometrics, native) };
  }

  it('is available only with the hardware and something enrolled on it', async () => {
    assert.equal(await biometrics().service.available(), true);
    assert.equal(
      await biometrics({ isEnrolledAsync: async () => false }).service.available(),
      false,
    );
    assert.equal(
      await biometrics({ hasHardwareAsync: async () => false }).service.available(),
      false,
    );
  });

  it('names the kinds the device has, rather than numbering them', async () => {
    assert.deepEqual(await biometrics().service.kinds(), ['fingerprint', 'face']);
  });

  it('shows the prompt with its message, and says whether it passed', async () => {
    const { service, prompts } = biometrics();
    assert.deepEqual(await service.authenticate('Unlock your wallet'), { success: true });
    assert.deepEqual(prompts, [{ promptMessage: 'Unlock your wallet' }]);
  });

  it("passes the platform's reason through when it fails", async () => {
    const { service } = biometrics({
      authenticateAsync: async () => ({ success: false, error: 'user_cancel' }),
    });
    assert.deepEqual(await service.authenticate('Unlock'), {
      success: false,
      error: 'user_cancel',
    });
  });

  it('is unavailable, and fails rather than passes, without the module', async () => {
    const service = serviceWith(Biometrics, null);
    assert.equal(await service.available(), false);
    assert.deepEqual(await service.authenticate('Unlock'), {
      success: false,
      error: 'not_available',
    });
  });
});

describe('the browser', () => {
  function browser(result: Awaited<ReturnType<NativeBrowser['openAuthSessionAsync']>>) {
    const calls: unknown[] = [];
    const native: NativeBrowser = {
      openBrowserAsync: async (url) => {
        calls.push(['open', url]);
        return { type: 'opened' };
      },
      openAuthSessionAsync: async (url, redirect) => {
        calls.push(['auth', url, redirect]);
        return result;
      },
    };
    return { calls, service: serviceWith(Browser, native) };
  }

  it('opens a page in the in-app browser', async () => {
    const { service, calls } = browser({ type: 'cancel' });
    await service.open('https://example.com');
    assert.deepEqual(calls, [['open', 'https://example.com']]);
  });

  it('answers a sign-in with the URL it redirected back to', async () => {
    const { service, calls } = browser({ type: 'success', url: 'myapp://done?code=abc' });
    assert.equal(
      await service.signIn('https://id.example.com/authorize', 'myapp://done'),
      'myapp://done?code=abc',
    );
    assert.deepEqual(calls, [['auth', 'https://id.example.com/authorize', 'myapp://done']]);
  });

  it('answers a cancelled or dismissed sign-in with null', async () => {
    assert.equal(await browser({ type: 'cancel' }).service.signIn('https://a', 'x://'), null);
    assert.equal(await browser({ type: 'dismiss' }).service.signIn('https://a', 'x://'), null);
  });
});

describe('the app and device info', () => {
  it('reads the version, build, identifier and device', () => {
    const info = serviceWith(AppInfo, {
      application: {
        nativeApplicationVersion: '1.4.0',
        nativeBuildVersion: '212',
        applicationId: 'com.example.wallet',
        applicationName: 'Wallet',
      },
      device: {
        modelName: 'iPhone 17 Pro',
        brand: 'Apple',
        osName: 'iOS',
        osVersion: '26.0',
        isDevice: true,
        deviceType: 1,
      },
    });
    assert.equal(info.version, '1.4.0');
    assert.equal(info.build, '212');
    assert.equal(info.id, 'com.example.wallet');
    assert.equal(info.name, 'Wallet');
    assert.deepEqual(info.device, {
      model: 'iPhone 17 Pro',
      brand: 'Apple',
      os: 'iOS',
      osVersion: '26.0',
      physical: true,
      type: 'phone',
    });
  });

  it('reports what it does not know as null, rather than as a guess', () => {
    const info = serviceWith(AppInfo, { application: null, device: null });
    assert.equal(info.version, null);
    assert.equal(info.device.model, null);
    assert.equal(info.device.physical, null);
    assert.equal(info.device.type, null);
  });
});

describe('the camera view', () => {
  function render(source: Parameters<typeof expoCameraFixture>[0]) {
    registerExpoViews('expo-camera');
    const fixture = expoCameraFixture(source);
    const fabric = createFakeFabric();
    const root = createNativeRoot({ fabric, rootTag: 1 });
    root.render(fixture.View);
    disposers.push(() => root.dispose());
    return { fabric, camera: fixture.camera, view: () => fabric.committed[0]! };
  }
  const disposers: (() => void)[] = [];
  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
  });

  it("commits as the module's default view, which is the name expo-camera asks for", () => {
    // `requireNativeViewManager('ExpoCamera')`, no view name: the camera is the module's first
    // view, so it is its default. `ExpoCamera_CameraView` exists on iOS only, where the Swift
    // class happens to be called that; on Android it is `ExpoCameraView`, and would not commit.
    const { view } = render(null);
    assert.equal(view().viewName, 'ViewManagerAdapter_ExpoCamera');
  });

  it('takes a picture from the view on screen, the way a React ref would', async () => {
    const calls: { tag: unknown; options: unknown }[] = [];
    const { camera, view } = render({
      async takePicture(this: { nativeTag: number }, options: unknown) {
        calls.push({ tag: this.nativeTag, options });
        return { uri: 'file:///shot.jpg', width: 10, height: 20, format: 'jpg' };
      },
    } as never);

    const picture: CameraPicture | null = await camera().takePicture({ quality: 0.5 });

    assert.equal(picture?.uri, 'file:///shot.jpg');
    assert.deepEqual(calls, [{ tag: view().reactTag, options: { quality: 0.5 } }]);
  });

  it('answers null without the module, rather than a picture it never took', async () => {
    const { camera } = render(null);
    assert.equal(await camera().takePicture(), null);
  });
});
