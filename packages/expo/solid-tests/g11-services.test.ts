import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createComputed, createRoot, getOwner, runWithOwner, type Owner } from 'solid-js';
import {
  provideService,
  useService,
  withServiceScope,
  type ServiceToken,
} from '@solid-native/device/solid';
import { BackgroundTask, BackgroundTaskStatus } from '../src/solid/background-task.ts';
import { Biometrics } from '../src/solid/biometrics.ts';
import { DocumentPicker } from '../src/solid/document-picker.ts';
import {
  ImageEditor,
  SaveFormat,
  type ImageManipulatorContext,
  type ImageRef,
} from '../src/solid/image-editor.ts';
import { ImagePicker, type NativeImagePicker } from '../src/solid/image-picker.ts';
import { Location, type LocationFix, type NativeLocation } from '../src/solid/location.ts';
import {
  MediaLibrary,
  MediaType,
  AssetField,
  type NativeMediaLibrary,
  type Query,
  type Asset,
  type Album,
} from '../src/solid/media-library.ts';
import {
  Notifications,
  TriggerType,
  type NativeNotifications,
  type Notification,
  type NotificationResponse,
  type DevicePushToken,
} from '../src/solid/notifications.ts';
import { ScreenCapture, type NativeScreenCapture } from '../src/solid/screen-capture.ts';
import { StoreReview } from '../src/solid/store-review.ts';
import { Tracking } from '../src/solid/tracking.ts';
import type { PermissionResponse } from '../src/solid/permissions.ts';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const yes: PermissionResponse = { status: 'granted', granted: true, canAskAgain: true };
const no: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function service<T, S>(token: ServiceToken<T> & { SOURCE: ServiceToken<S> }, source: S) {
  let stop!: () => void;
  let owner!: Owner;
  const value = createRoot((dispose) => {
    stop = dispose;
    stops.push(dispose);
    return withServiceScope([provideService(token.SOURCE, () => source)], () => {
      owner = getOwner()!;
      return useService(token);
    });
  });
  return { value, stop, owner };
}
const fix = (latitude: number): LocationFix => ({
  coords: { latitude, longitude: 2, altitude: null, accuracy: 4, heading: null, speed: null },
  timestamp: latitude,
});
function locationSource(overrides: Partial<NativeLocation> = {}): NativeLocation {
  return {
    getForegroundPermissionsAsync: async () => yes,
    requestForegroundPermissionsAsync: async () => yes,
    getCurrentPositionAsync: async () => fix(1),
    watchPositionAsync: async () => ({ remove() {} }),
    ...overrides,
  };
}
function notification(id: string): Notification {
  return {
    date: 1,
    request: {
      identifier: id,
      content: { title: id } as Notification['request']['content'],
      trigger: null,
    },
  };
}
const response = (id: string, action: string): NotificationResponse => ({
  notification: notification(id),
  actionIdentifier: action,
});
function notificationsSource() {
  const calls: [string, ...unknown[]][] = [];
  const initial = deferred<NotificationResponse | null>();
  let received!: (event: Notification) => void;
  let responded!: (event: NotificationResponse) => void;
  let dropped!: () => void;
  let token!: (value: DevicePushToken) => void;
  let removed = 0;
  const sub = () => ({
    remove() {
      removed++;
    },
  });
  const target = {
    addNotificationReceivedListener(callback: typeof received) {
      received = callback;
      return sub();
    },
    addNotificationResponseReceivedListener(callback: typeof responded) {
      responded = callback;
      return sub();
    },
    addNotificationsDroppedListener(callback: typeof dropped) {
      dropped = callback;
      return sub();
    },
    addPushTokenListener(callback: typeof token) {
      token = callback;
      return sub();
    },
    getLastNotificationResponseAsync: () => initial.promise,
    getPermissionsAsync: async () => yes,
    requestPermissionsAsync: async (...args: unknown[]) => {
      calls.push(['requestPermissionsAsync', ...args]);
      return yes;
    },
    getExpoPushTokenAsync: async (...args: unknown[]) => {
      calls.push(['getExpoPushTokenAsync', ...args]);
      return { type: 'expo', data: 'expo-token' };
    },
    getDevicePushTokenAsync: async () => ({ type: 'ios', data: 'native-token' }),
  };
  const native = new Proxy(target, {
    get(object, property) {
      if (property in object) return Reflect.get(object, property);
      return (...args: unknown[]) => {
        calls.push([String(property), ...args]);
        return Promise.resolve(undefined);
      };
    },
  }) as unknown as NativeNotifications;
  return {
    native,
    calls,
    initial,
    received: (value: Notification) => received(value),
    responded: (value: NotificationResponse) => responded(value),
    dropped: () => dropped(),
    token: (value: DevicePushToken) => token(value),
    removed: () => removed,
  };
}

test('all eleven absent optional services retain empty/denied defaults and remain inert after disposal', async () => {
  const background = service(BackgroundTask, null);
  assert.equal(await background.value.status(), BackgroundTaskStatus.Restricted);
  assert.equal(await background.value.triggerForTesting(), false);
  await background.value.register('task');
  await background.value.unregister('task');
  const biometrics = service(Biometrics, null);
  assert.equal(await biometrics.value.available(), false);
  assert.deepEqual(await biometrics.value.kinds(), []);
  assert.deepEqual(await biometrics.value.authenticate('Unlock'), {
    success: false,
    error: 'not_available',
  });
  assert.deepEqual(await service(DocumentPicker, null).value.pick(), []);
  const editor = service(ImageEditor, null);
  assert.equal(editor.value.manipulate('uri'), null);
  assert.equal(await editor.value.edit('uri'), null);
  const picker = service(ImagePicker, null);
  assert.deepEqual(await picker.value.capture(), []);
  assert.deepEqual(await picker.value.pick(), []);
  assert.equal(await picker.value.libraryPermission.ensure(), false);
  const location = service(Location, null);
  assert.equal(await location.value.current(), null);
  (await location.value.start())();
  assert.equal(location.value.position(), null);
  const media = service(MediaLibrary, null);
  assert.equal(await media.value.save('uri'), null);
  assert.deepEqual(await media.value.assets(), []);
  assert.deepEqual(await media.value.metadata(), []);
  assert.equal(media.value.asset('id'), null);
  assert.deepEqual(await media.value.albums(), []);
  assert.equal(await media.value.album('title'), null);
  assert.equal(await media.value.createAlbum('title', []), null);
  assert.equal(media.value.watch()(), null);
  const notifications = service(Notifications, null);
  assert.equal(await notifications.value.getExpoPushToken(), null);
  assert.equal(await notifications.value.getDevicePushToken(), null);
  assert.equal(await notifications.value.badge(), 0);
  assert.deepEqual(await notifications.value.scheduled(), []);
  assert.equal(await notifications.value.schedule({ content: {}, trigger: null }), null);
  assert.equal(
    await notifications.value.nextTriggerDate({ type: TriggerType.DAILY, hour: 3, minute: 4 }),
    null,
  );
  const capture = service(ScreenCapture, null);
  assert.equal(await capture.value.available(), false);
  await capture.value.prevent('a');
  await capture.value.allow('a');
  assert.equal(capture.value.screenshots(), 0);
  const review = service(StoreReview, null);
  assert.equal(await review.value.available(), false);
  assert.equal(await review.value.hasAction(), false);
  assert.equal(review.value.storeUrl(), null);
  await review.value.request();
  const tracking = service(Tracking, null);
  assert.equal(tracking.value.available(), false);
  assert.equal(tracking.value.advertisingId(), null);
  assert.equal(await tracking.value.permission.ensure(), false);
});

test('background registration is persistent; review/tracking and biometric methods forward exact native arguments', async () => {
  const calls: unknown[] = [];
  const background = service(BackgroundTask, {
    getStatusAsync: async () => 2 as const,
    registerTaskAsync: async (...args) => {
      calls.push(args);
    },
    unregisterTaskAsync: async (...args) => {
      calls.push(args);
    },
    triggerTaskWorkerForTestingAsync: async () => true,
  });
  assert.equal(await background.value.status(), 2);
  await background.value.register('sync', { minimumInterval: 60 });
  await background.value.unregister('sync');
  assert.equal(await background.value.triggerForTesting(), true);
  const bio = service(Biometrics, {
    hasHardwareAsync: async () => true,
    isEnrolledAsync: async () => true,
    supportedAuthenticationTypesAsync: async () => [1, 2, 3, 99],
    authenticateAsync: async (options) => {
      calls.push(options);
      return { success: true };
    },
  });
  assert.equal(await bio.value.available(), true);
  assert.deepEqual(await bio.value.kinds(), ['fingerprint', 'face', 'iris']);
  assert.deepEqual(await bio.value.authenticate('Unlock', { disableDeviceFallback: true }), {
    success: true,
  });
  const review = service(StoreReview, {
    isAvailableAsync: async () => true,
    hasAction: async () => true,
    requestReview: async () => {
      calls.push('review');
    },
    storeUrl: () => 'store',
  });
  await review.value.request();
  assert.equal(review.value.storeUrl(), 'store');
  const tracking = service(Tracking, {
    getTrackingPermissionsAsync: async () => yes,
    requestTrackingPermissionsAsync: async () => yes,
    isAvailable: () => true,
    getAdvertisingId: () => 'id',
  });
  assert.equal(await tracking.value.permission.ensure(), true);
  assert.equal(tracking.value.advertisingId(), 'id');
  tracking.stop();
  assert.equal(tracking.value.advertisingId(), null);
  assert.deepEqual(calls, [
    ['sync', { minimumInterval: 60 }],
    ['sync'],
    { promptMessage: 'Unlock', disableDeviceFallback: true },
    'review',
  ]);
});

test('picker library never requests permission; camera checks permission and rejects late answers', async () => {
  const calls: string[] = [];
  const pending = deferred<{
    canceled: false;
    assets: { uri: string; width: number; height: number }[];
  }>();
  const native: NativeImagePicker = {
    getMediaLibraryPermissionsAsync: async () => {
      calls.push('library');
      return yes;
    },
    requestMediaLibraryPermissionsAsync: async () => yes,
    getCameraPermissionsAsync: async () => {
      calls.push('camera-check');
      return no;
    },
    requestCameraPermissionsAsync: async () => {
      calls.push('camera-ask');
      return yes;
    },
    launchImageLibraryAsync: () => {
      calls.push('library-picker');
      return pending.promise;
    },
    launchCameraAsync: async () => {
      calls.push('camera-picker');
      return { canceled: true, assets: null };
    },
  };
  const owned = service(ImagePicker, native);
  const picking = owned.value.pick({ mediaTypes: ['images'] });
  assert.deepEqual(await owned.value.capture(), []);
  assert.deepEqual(calls, ['library-picker', 'camera-check']);
  owned.stop();
  assert.deepEqual(await picking, []);
  pending.resolve({ canceled: false, assets: [{ uri: 'late', width: 2, height: 3 }] });
  assert.deepEqual(await owned.value.pick(), []);
});

test('camera permission publication disposal prevents camera acquisition and preserves this binding', async () => {
  const permission = deferred<PermissionResponse>();
  let captures = 0;
  const native: NativeImagePicker = {
    getCameraPermissionsAsync() {
      assert.equal(this, native);
      return permission.promise;
    },
    requestCameraPermissionsAsync: async () => yes,
    getMediaLibraryPermissionsAsync: async () => yes,
    requestMediaLibraryPermissionsAsync: async () => yes,
    launchCameraAsync: async () => {
      captures++;
      return { canceled: true, assets: null };
    },
    launchImageLibraryAsync: async () => ({ canceled: true, assets: null }),
  };
  const owned = service(ImagePicker, native);
  runWithOwner(owned.owner, () =>
    createComputed(() => {
      if (owned.value.cameraPermission.granted()) owned.stop();
    }),
  );
  const result = owned.value.capture();
  permission.resolve(yes);
  assert.deepEqual(await result, []);
  assert.equal(captures, 0);
});

test('document and biometric late answers cancel per caller without ending their app service', async () => {
  const document = deferred<{
    canceled: false;
    assets: { uri: string; name: string; lastModified: number }[];
  }>();
  const owned = service(DocumentPicker, { getDocumentAsync: () => document.promise });
  let endCaller!: () => void;
  const result = runWithOwner(owned.owner, () =>
    createRoot((dispose) => {
      endCaller = dispose;
      return owned.value.pick({ type: 'application/pdf', multiple: true });
    }),
  );
  endCaller();
  assert.deepEqual(await result, []);
  document.resolve({ canceled: false, assets: [{ uri: 'late', name: 'late', lastModified: 1 }] });
  assert.equal((await owned.value.pick()).length, 1);
  const auth = deferred<{ success: true }>();
  const bio = service(Biometrics, {
    hasHardwareAsync: async () => true,
    isEnrolledAsync: async () => true,
    supportedAuthenticationTypesAsync: async () => [],
    authenticateAsync: () => auth.promise,
  });
  const unlocking = bio.value.authenticate('Unlock');
  bio.stop();
  assert.deepEqual(await unlocking, { success: false, error: 'app_cancel' });
  auth.resolve({ success: true });
});

function editorSource(
  overrides: Partial<ImageManipulatorContext> = {},
  imageOverrides: Partial<ImageRef> = {},
) {
  const actions: unknown[] = [];
  let releasedContext = 0;
  let releasedImage = 0;
  const image: ImageRef = {
    width: 2,
    height: 3,
    saveAsync: async (options) => {
      actions.push(options);
      return { uri: 'saved', width: 2, height: 3 };
    },
    release() {
      releasedImage++;
    },
    ...imageOverrides,
  };
  const context: ImageManipulatorContext = {
    resize(value) {
      actions.push(value);
      return this;
    },
    rotate(value) {
      actions.push(value);
      return this;
    },
    flip(value) {
      actions.push(value);
      return this;
    },
    crop(value) {
      actions.push(value);
      return this;
    },
    extent(value) {
      actions.push(value);
      return this;
    },
    reset() {
      return this;
    },
    renderAsync: async () => image,
    release() {
      releasedContext++;
    },
    ...overrides,
  };
  return {
    native: { ImageManipulator: { manipulate: () => context } },
    context,
    image,
    actions,
    released: () => [releasedContext, releasedImage],
  };
}
test('image editor applies every action in order and releases both handles after saving', async () => {
  const source = editorSource();
  const owned = service(ImageEditor, source.native);
  const crop = { originX: 1, originY: 2, width: 3, height: 4 };
  const extent = { width: 4, height: 5 };
  assert.equal(
    (
      await owned.value.edit(
        'input',
        [{ resize: { width: 2 } }, { rotate: 90 }, { flip: 'vertical' }, { crop }, { extent }],
        { format: SaveFormat.WEBP, compress: 0.7 },
      )
    )?.uri,
    'saved',
  );
  assert.deepEqual(source.actions, [
    { width: 2 },
    90,
    'vertical',
    crop,
    extent,
    { format: 'webp', compress: 0.7 },
  ]);
  assert.deepEqual(source.released(), [1, 1]);
  assert.equal(owned.value.manipulate('raw'), source.context);
  assert.deepEqual(source.released(), [1, 1]);
});
test('image editor preserves primary save errors and releases image even when context release throws', async () => {
  const problem = Error('save');
  let released = 0;
  const source = editorSource(
    {
      release() {
        throw Error('cleanup');
      },
    },
    {
      saveAsync: async () => {
        throw problem;
      },
      release() {
        released++;
      },
    },
  );
  await assert.rejects(
    service(ImageEditor, source.native).value.edit('input'),
    (error) => error === problem,
  );
  assert.equal(released, 1);
});
test('image editor releases late rendered handles without issuing a stale save', async () => {
  const pending = deferred<ImageRef>();
  const source = editorSource({ renderAsync: () => pending.promise });
  const owned = service(ImageEditor, source.native);
  const result = owned.value.edit('input');
  owned.stop();
  assert.equal(await result, null);
  pending.resolve(source.image);
  await settle();
  assert.deepEqual(source.released(), [1, 1]);
  assert.deepEqual(source.actions, []);
});

test('location watches outrank old one-shot reads and remove once on explicit/caller/service cleanup', async () => {
  const pending = deferred<LocationFix>();
  let emit!: (fix: LocationFix) => void;
  let removed = 0;
  const options: unknown[] = [];
  const owned = service(
    Location,
    locationSource({
      getCurrentPositionAsync: () => pending.promise,
      watchPositionAsync: async (option, callback) => {
        options.push(option);
        emit = callback;
        return {
          remove() {
            removed++;
          },
        };
      },
    }),
  );
  const old = owned.value.current();
  const stop = await owned.value.start({ accuracy: 'navigation', distance: 10, interval: 300 });
  emit(fix(4));
  pending.resolve(fix(1));
  assert.equal((await old)?.latitude, 1);
  assert.equal(owned.value.position()?.latitude, 4);
  assert.deepEqual(options, [{ accuracy: 6, distanceInterval: 10, timeInterval: 300 }]);
  stop();
  stop();
  emit(fix(5));
  assert.equal(owned.value.position()?.latitude, 4);
  owned.stop();
  assert.equal(removed, 1);
});
test('location delayed acquisition is removed after caller disposal and never publishes afterward', async () => {
  const pending = deferred<{ remove(): void }>();
  let emit!: (fix: LocationFix) => void;
  let removed = 0;
  let end!: () => void;
  const owned = service(
    Location,
    locationSource({
      watchPositionAsync: (_, callback) => {
        emit = callback;
        return pending.promise;
      },
    }),
  );
  const result = runWithOwner(owned.owner, () =>
    createRoot((stop) => {
      end = stop;
      return owned.value.start();
    }),
  );
  await settle();
  end();
  const release = await result;
  pending.resolve({
    remove() {
      removed++;
    },
  });
  await settle();
  emit(fix(8));
  release!();
  assert.equal(owned.value.position(), null);
  assert.equal(removed, 1);
});

test('notifications live events, tuple consumption and clear outrank initial snapshot; all listeners release', async () => {
  const source = notificationsSource();
  const owned = service(Notifications, source.native);
  source.responded(response('ab', 'c'));
  assert.equal(owned.value.take()?.notification.request.identifier, 'ab');
  assert.equal(owned.value.take(), null);
  source.responded(response('a', 'bc'));
  assert.equal(owned.value.take()?.notification.request.identifier, 'a');
  source.received(notification('new'));
  source.dropped();
  source.token({ type: 'ios', data: 'rolled' });
  assert.equal(owned.value.latest()?.request.identifier, 'new');
  assert.equal(owned.value.dropped(), 1);
  assert.deepEqual(owned.value.devicePushToken(), { type: 'ios', data: 'rolled' });
  await owned.value.clearResponse();
  source.initial.resolve(response('old', 'default'));
  await settle();
  assert.equal(owned.value.response(), null);
  owned.stop();
  source.received(notification('late'));
  source.dropped();
  assert.equal(owned.value.latest()?.request.identifier, 'new');
  assert.equal(owned.value.dropped(), 1);
  assert.equal(source.removed(), 4);
});
test('notification listener construction rolls back every acquired subscription on failure', () => {
  const source = notificationsSource();
  const error = Error('subscription');
  source.native.addPushTokenListener = () => {
    throw error;
  };
  assert.throws(
    () => service(Notifications, source.native),
    (value) => value === error,
  );
  assert.equal(source.removed(), 3);
});
test('notification caller cancellation blocks token work after permission and errors are preserved', async () => {
  const source = notificationsSource();
  const gate = deferred<PermissionResponse>();
  source.native.getPermissionsAsync = () => gate.promise;
  const owned = service(Notifications, source.native);
  const token = owned.value.getExpoPushToken('project');
  owned.stop();
  assert.equal(await token, null);
  gate.resolve(yes);
  await settle();
  assert.equal(
    source.calls.some(([name]) => name === 'getExpoPushTokenAsync'),
    false,
  );
  const error = Error('schedule');
  const source2 = notificationsSource();
  source2.native.scheduleNotificationAsync = async () => {
    throw error;
  };
  await assert.rejects(
    service(Notifications, source2.native).value.schedule({
      content: { title: 'x' },
      trigger: null,
    }),
    (value) => value === error,
  );
});
test('all notification commands forward their legacy native methods and arguments', async () => {
  const source = notificationsSource();
  const owned = service(Notifications, source.native);
  const api = owned.value;
  const request = {
    content: { title: 'Title' },
    trigger: { type: TriggerType.DAILY, hour: 9, minute: 0 },
  };
  await api.requestPermission({ ios: { allowProvisional: true } });
  await api.schedule(request);
  await api.cancel('id');
  await api.cancelAll();
  await api.scheduled();
  await api.nextTriggerDate(request.trigger);
  await api.presented();
  await api.dismiss('id');
  api.dismissAll();
  await api.badge();
  api.setBadge(4);
  await api.channels();
  await api.channel('id');
  await api.setChannel('id', { name: 'N', importance: 5 });
  await api.deleteChannel('id');
  await api.channelGroups();
  await api.channelGroup('id');
  await api.setChannelGroup('id', { name: 'G' });
  await api.deleteChannelGroup('id');
  await api.categories();
  await api.setCategory('id', []);
  await api.deleteCategory('id');
  api.setHandler(null);
  assert.equal(await api.getExpoPushToken('project'), 'expo-token');
  assert.deepEqual(await api.getDevicePushToken(), { type: 'ios', data: 'native-token' });
  await api.unregister();
  await api.setAutoServerRegistration(true);
  await api.subscribeToTopic('t');
  await api.unsubscribeFromTopic('t');
  await api.registerTask('t');
  await api.unregisterTask('t');
  assert.deepEqual(
    source.calls.map(([name]) => name),
    [
      'requestPermissionsAsync',
      'scheduleNotificationAsync',
      'cancelScheduledNotificationAsync',
      'cancelAllScheduledNotificationsAsync',
      'getAllScheduledNotificationsAsync',
      'getNextTriggerDateAsync',
      'getPresentedNotificationsAsync',
      'dismissNotificationAsync',
      'dismissAllNotificationsAsync',
      'getBadgeCountAsync',
      'setBadgeCountAsync',
      'getNotificationChannelsAsync',
      'getNotificationChannelAsync',
      'setNotificationChannelAsync',
      'deleteNotificationChannelAsync',
      'getNotificationChannelGroupsAsync',
      'getNotificationChannelGroupAsync',
      'setNotificationChannelGroupAsync',
      'deleteNotificationChannelGroupAsync',
      'getNotificationCategoriesAsync',
      'setNotificationCategoryAsync',
      'deleteNotificationCategoryAsync',
      'setNotificationHandler',
      'getExpoPushTokenAsync',
      'unregisterForNotificationsAsync',
      'setAutoServerRegistrationEnabledAsync',
      'subscribeToTopicAsync',
      'unsubscribeFromTopicAsync',
      'registerTaskAsync',
      'unregisterTaskAsync',
    ],
  );
  assert.deepEqual(
    source.calls.find(([name]) => name === 'getExpoPushTokenAsync'),
    ['getExpoPushTokenAsync', { projectId: 'project' }],
  );
  assert.deepEqual(
    source.calls.find(([name]) => name === 'scheduleNotificationAsync'),
    ['scheduleNotificationAsync', request],
  );
});

function captureSource() {
  const calls: unknown[] = [];
  let callback!: () => void;
  let removed = 0;
  const native: NativeScreenCapture = {
    isAvailableAsync: async () => true,
    preventScreenCaptureAsync: async (key) => {
      calls.push(['prevent', key]);
    },
    allowScreenCaptureAsync: async (key) => {
      calls.push(['allow', key]);
    },
    enableAppSwitcherProtectionAsync: async (value) => {
      calls.push(['protect', value]);
    },
    disableAppSwitcherProtectionAsync: async () => {
      calls.push(['unprotect']);
    },
    addScreenshotListener(fn) {
      callback = fn;
      return {
        remove() {
          removed++;
        },
      };
    },
    getPermissionsAsync: async () => yes,
    requestPermissionsAsync: async () => yes,
  };
  return { native, calls, emit: () => callback(), removed: () => removed };
}
test('screen capture retains keys and switcher options and releases service-owned protection', async () => {
  const source = captureSource();
  const owned = service(ScreenCapture, source.native);
  source.emit();
  assert.equal(owned.value.screenshots(), 1);
  assert.equal(await owned.value.permission.ensure(), true);
  await owned.value.prevent('card');
  await owned.value.prevent('pin');
  await owned.value.allow('card');
  await owned.value.protectAppSwitcher(0.8);
  owned.stop();
  await settle();
  source.emit();
  assert.equal(owned.value.screenshots(), 1);
  assert.equal(source.removed(), 1);
  assert.deepEqual(source.calls, [
    ['prevent', 'card'],
    ['prevent', 'pin'],
    ['allow', 'card'],
    ['protect', 0.8],
    ['allow', 'pin'],
    ['unprotect'],
  ]);
});
test('screen capture disposal during a pending prevent schedules compensating release', async () => {
  const source = captureSource();
  const gate = deferred<void>();
  source.native.preventScreenCaptureAsync = async (key) => {
    source.calls.push(['prevent', key]);
    await gate.promise;
  };
  const owned = service(ScreenCapture, source.native);
  const pending = owned.value.prevent('key');
  await settle();
  owned.stop();
  assert.equal(await pending, undefined);
  gate.resolve();
  await settle();
  assert.deepEqual(source.calls, [
    ['prevent', 'key'],
    ['allow', 'key'],
  ]);
});

function mediaSource() {
  const calls: unknown[] = [];
  let listener!: (event: { hasIncrementalChanges: boolean }) => void;
  let removed = 0;
  const asset = { id: 'asset' } as Asset;
  const album = { id: 'album' } as Album;
  class Assets {
    constructor(id: string) {
      calls.push(['asset', id]);
      return asset;
    }
    static async create(...args: unknown[]) {
      calls.push(['save', ...args]);
      return asset;
    }
    static async delete(...args: unknown[]) {
      calls.push(['deleteAssets', ...args]);
    }
  }
  class Albums {
    constructor() {
      return album;
    }
    static async getAll() {
      calls.push(['albums']);
      return [album];
    }
    static async get(...args: unknown[]) {
      calls.push(['album', ...args]);
      return album;
    }
    static async create(...args: unknown[]) {
      calls.push(['createAlbum', ...args]);
      return album;
    }
    static async delete(...args: unknown[]) {
      calls.push(['deleteAlbums', ...args]);
    }
  }
  class Queries {
    eq(...args: unknown[]) {
      calls.push(['eq', ...args]);
      return this;
    }
    orderBy(...args: unknown[]) {
      calls.push(['orderBy', ...args]);
      return this;
    }
    limit(...args: unknown[]) {
      calls.push(['limit', ...args]);
      return this;
    }
    async exe() {
      calls.push(['exe']);
      return [asset];
    }
    async exeForMetadata() {
      calls.push(['metadata']);
      return [];
    }
  }
  const native = {
    getPermissionsAsync: async (write: boolean) => {
      calls.push(['permission', write]);
      return yes;
    },
    requestPermissionsAsync: async (...args: unknown[]) => {
      calls.push(['request', ...args]);
      return yes;
    },
    presentPermissionsPicker: async (...args: unknown[]) => {
      calls.push(['picker', ...args]);
    },
    addListener(callback: typeof listener) {
      calls.push(['listen']);
      listener = callback;
      return {
        remove() {
          removed++;
        },
      };
    },
    Asset: Assets,
    Album: Albums,
    Query: Queries,
  } as unknown as NativeMediaLibrary;
  return {
    native,
    calls,
    asset,
    album,
    emit: () => listener({ hasIncrementalChanges: true }),
    removed: () => removed,
  };
}
test('media library preserves contextual queries, handles, write-only saves and lazy single listener', async () => {
  const source = mediaSource();
  const owned = service(MediaLibrary, source.native);
  const api = owned.value;
  assert.deepEqual(source.calls, []);
  assert.equal(await api.save('uri', source.album), source.asset);
  assert.deepEqual(
    await api.assets((query) =>
      query.eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).orderBy(AssetField.CREATION_TIME).limit(30),
    ),
    [source.asset],
  );
  assert.deepEqual(await api.metadata(), []);
  assert.equal(api.asset('id'), source.asset);
  assert.deepEqual(await api.albums(), [source.album]);
  assert.equal(await api.album('title'), source.album);
  assert.equal(await api.createAlbum('title', [source.asset], true), source.album);
  await api.deleteAlbums([source.album], true);
  await api.deleteAssets([source.asset]);
  await api.requestPermission(false, ['photo']);
  await api.presentPermissionsPicker(['photo']);
  const changes = api.watch();
  assert.equal(api.watch(), changes);
  source.emit();
  assert.equal(changes()?.hasIncrementalChanges, true);
  owned.stop();
  assert.equal(source.removed(), 1);
  assert.deepEqual(source.calls.slice(0, 6), [
    ['permission', true],
    ['save', 'uri', source.album],
    ['eq', 'mediaType', 'image'],
    ['orderBy', 'creationTime'],
    ['limit', 30],
    ['exe'],
  ]);
  assert.equal(source.calls.filter((call) => (call as string[])[0] === 'listen').length, 1);
});
test('media query builder disposal prevents native execution and watch acquisition releases on reentry', async () => {
  const source = mediaSource();
  const owned = service(MediaLibrary, source.native);
  assert.deepEqual(
    await owned.value.assets((query: Query) => {
      owned.stop();
      return query;
    }),
    [],
  );
  assert.equal(
    source.calls.some((call) => (call as string[])[0] === 'exe'),
    false,
  );
  const source2 = mediaSource();
  const owned2 = service(MediaLibrary, source2.native);
  const add = source2.native.addListener;
  source2.native.addListener = (listener) => {
    const sub = add(listener);
    owned2.stop();
    return sub;
  };
  owned2.value.watch();
  assert.equal(source2.removed(), 1);
});

test('one service scope cannot release another scope screen protection with the same native key', async () => {
  const source = captureSource();
  const first = service(ScreenCapture, source.native);
  const second = service(ScreenCapture, source.native);
  await first.value.prevent('shared');
  await second.value.prevent('shared');
  first.stop();
  await settle();
  assert.equal(source.calls.filter((call) => (call as string[])[0] === 'allow').length, 0);
  second.stop();
  await settle();
  assert.equal(source.calls.filter((call) => (call as string[])[0] === 'allow').length, 1);
});
test('notification handler claims restore previous live scope and clear on final disposal', () => {
  const source = notificationsSource();
  const first = service(Notifications, source.native);
  const second = service(Notifications, source.native);
  const a = {
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  };
  const b = {
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  };
  first.value.setHandler(a);
  second.value.setHandler(b);
  second.stop();
  assert.equal(source.calls.at(-1)?.[1], a);
  first.stop();
  assert.equal(source.calls.at(-1)?.[1], null);
});

test('native listener removal reentry cannot publish into disposed screenshot/media/notification services', async () => {
  const capture = captureSource();
  const addCapture = capture.native.addScreenshotListener;
  capture.native.addScreenshotListener = (callback) => {
    const subscription = addCapture(callback);
    return {
      remove() {
        callback();
        subscription.remove();
      },
    };
  };
  const c = service(ScreenCapture, capture.native);
  c.stop();
  assert.equal(c.value.screenshots(), 0);
  const media = mediaSource();
  const addMedia = media.native.addListener;
  media.native.addListener = (callback) => {
    const subscription = addMedia(callback);
    return {
      remove() {
        callback({ hasIncrementalChanges: true });
        subscription.remove();
      },
    };
  };
  const m = service(MediaLibrary, media.native);
  const changes = m.value.watch();
  m.stop();
  assert.equal(changes(), null);
  const notifications = notificationsSource();
  const addNotification = notifications.native.addNotificationReceivedListener;
  notifications.native.addNotificationReceivedListener = (callback) => {
    const subscription = addNotification(callback);
    return {
      remove() {
        callback(notification('released'));
        subscription.remove();
      },
    };
  };
  const n = service(Notifications, notifications.native);
  n.stop();
  assert.equal(n.value.latest(), null);
});
test('raw image-context acquisition disposed synchronously releases the unclaimed handle', () => {
  const source = editorSource();
  let stop = () => {};
  source.native.ImageManipulator.manipulate = () => {
    stop();
    return source.context;
  };
  const owned = service(ImageEditor, source.native);
  stop = owned.stop;
  assert.equal(owned.value.manipulate('input'), null);
  assert.deepEqual(source.released(), [1, 0]);
});
test('screen switcher protection restores the previous live scope after the newest scope ends', async () => {
  const source = captureSource();
  const first = service(ScreenCapture, source.native);
  const second = service(ScreenCapture, source.native);
  await first.value.protectAppSwitcher(0.2);
  await second.value.protectAppSwitcher(0.8);
  second.stop();
  await settle();
  assert.deepEqual(source.calls.at(-1), ['protect', 0.2]);
  first.stop();
  await settle();
  assert.deepEqual(source.calls.at(-1), ['unprotect']);
});
test('notification native handler setter reentry cannot reinstall a disposed policy', () => {
  const source = notificationsSource();
  const owned = service(Notifications, source.native);
  const setter = source.native.setNotificationHandler;
  const handler = {
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  };
  source.native.setNotificationHandler = (value) => {
    setter(value);
    if (value === handler) owned.stop();
  };
  owned.value.setHandler(handler);
  assert.equal(source.calls.at(-1)?.[1], null);
});

test('native handler removal cannot resurrect the disposing service policy', () => {
  const source = notificationsSource();
  const owned = service(Notifications, source.native);
  const setter = source.native.setNotificationHandler;
  const handler = {
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  };
  owned.value.setHandler(handler);
  let reentered = false;
  source.native.setNotificationHandler = (value) => {
    setter(value);
    if (value === null && !reentered) {
      reentered = true;
      owned.value.setHandler(handler);
    }
  };
  owned.stop();
  assert.equal(source.calls.at(-1)?.[1], null);
});
