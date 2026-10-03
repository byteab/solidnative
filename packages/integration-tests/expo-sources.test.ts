/**
 * The default factories behind `@solidnative/expo`'s `SOURCE` tokens.
 *
 * Same argument as `device-sources.test.ts`: every test of these services provides a fake source,
 * so the services are covered and the translation between Expo's API and this one is not. That
 * translation is where the silent failures live. Expo reports orientation and battery state as
 * *numbers*, and this maps them onto names through a table built from the module's own enum - one
 * wrong key there and a charging phone reports `unknown` forever, with nothing to say so.
 *
 * `optional()` reaches its module through a bare `require`, which in an ES module resolves to a
 * global if there is one. Defining that global is the same seam Metro gives it on a device, and
 * needs no hook in the production code.
 *
 * What is here is the services whose translation is worth pinning, plus the ones whose factory a
 * class-level fake can never reach at all: a service that takes its source through `useService()` never
 * runs its own default, only whatever a test provides in its place. The rest follow the same shape,
 * and a test per Expo module would be a test of Expo.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Battery } from '@solidnative/expo/battery';
import { Clipboard } from '@solidnative/expo/clipboard';
import { FileSystem } from '@solidnative/expo/file-system';
import { LanguageModel } from '@solidnative/expo/language-model';
import { Network } from '@solidnative/expo/network';
import { AppleSignIn } from '@solidnative/expo/apple-sign-in';
import { Notifications } from '@solidnative/expo/notifications';
import { MediaLibrary } from '@solidnative/expo/media-library';
import { ImageEditor } from '@solidnative/expo/image-editor';
import { ScreenCapture } from '@solidnative/expo/screen-capture';
import { BackgroundTask } from '@solidnative/expo/background-task';
import { Crypto } from '@solidnative/expo/crypto';
import { DocumentPicker } from '@solidnative/expo/document-picker';
import { Tracking } from '@solidnative/expo/tracking';
import { StoreReview } from '@solidnative/expo/store-review';
import { DeviceOrientation } from '@solidnative/expo/orientation';
import { Locale } from '@solidnative/expo/locale';
import { SecureStorage, Storage } from '@solidnative/expo/store';
import { Updates } from '@solidnative/expo/updates';
import { useService, type ServiceToken } from '@solidnative/device/solid';
import { disposeServices, servicesWith } from './expo-service.ts';

/** Modules by specifier, for one call. Anything not listed throws, which reads as "not installed". */
function withModules<T>(modules: Record<string, unknown>, run: () => T): T {
  const host = globalThis as Record<string, unknown>;
  host['require'] = (id: string) => {
    if (id in modules) return modules[id];
    throw new Error(`Cannot find module '${id}'`);
  };
  try {
    return run();
  } finally {
    delete host['require'];
  }
}

/**
 * The token's own default factory, run directly: every other route to it goes around it, since
 * every existing test of these services provides a fake source in its place.
 */
function defaultSource<T>(token: ServiceToken<T>): T {
  assert.equal(typeof token.create, 'function', 'the token still carries its default factory');
  return token.create();
}

/** A storage service built in its own scope, so it resolves its source's default factory. */
const storeService = (token: typeof Storage) => servicesWith([], () => useService(token));

afterEach(() => {
  disposeServices();
  delete (globalThis as Record<string, unknown>)['require'];
});

describe('an Expo service with the module missing', () => {
  /*
   * The ordinary case for this package: the modules are optional peer dependencies, so an app that
   * never installed `expo-battery` still imports `Battery` through the barrel. Going inert is the
   * contract - throwing here would break an import rather than a feature.
   */
  it('goes inert rather than throwing', () => {
    assert.deepEqual(
      withModules({}, () => defaultSource(Battery.SOURCE)),
      {
        level: null,
        state: null,
        saving: null,
      },
    );
  });
});

describe('the battery source', () => {
  const expoBattery = () => ({
    BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3, NOT_CHARGING: 4 },
    getBatteryLevelAsync: () => Promise.resolve(0.42),
    getBatteryStateAsync: () => Promise.resolve(state),
    isLowPowerModeEnabledAsync: () => Promise.resolve(true),
    addBatteryLevelListener: (handler: (e: { batteryLevel: number }) => void) => {
      listeners.level = handler;
      return { remove: () => (removed += 1) };
    },
    addBatteryStateListener: (handler: (e: { batteryState: number }) => void) => {
      listeners.state = handler;
      return { remove: () => (removed += 1) };
    },
    addLowPowerModeListener: (handler: (e: { lowPowerMode: boolean }) => void) => {
      listeners.saving = handler;
      return { remove: () => (removed += 1) };
    },
  });
  let state = 2;
  let removed = 0;
  let listeners: Record<string, ((event: never) => void) | undefined> = {};

  afterEach(() => {
    state = 2;
    removed = 0;
    listeners = {};
  });

  const build = () =>
    withModules({ 'expo-battery': expoBattery() }, () =>
      defaultSource(Battery.SOURCE),
    ) as unknown as {
      level: { current(): Promise<number>; subscribe(fn: (v: number) => void): () => void };
      state: { current(): Promise<string>; subscribe(fn: (v: string) => void): () => void };
      saving: { current(): Promise<boolean> };
    };

  it('reads the level, the state and low power mode', async () => {
    const source = build();
    assert.equal(await source.level.current(), 0.42);
    assert.equal(await source.state.current(), 'charging');
    assert.equal(await source.saving.current(), true);
  });

  it("calls Android's NOT_CHARGING full, because the battery is not going down", async () => {
    /*
     * `NOT_CHARGING` is plugged in and holding, and it exists only on Android. Left out of the
     * table it would fall through to `unknown`, so the same phone would report a different state
     * on each platform for the same physical situation.
     */
    state = 4;
    assert.equal(await build().state.current(), 'full');
  });

  it('reports a state Expo does not have as unknown rather than undefined', async () => {
    // The table is keyed by Expo's own enum, so an unlisted number is a version of Expo this was
    // not written against. `unknown` is a value the rest of the app already handles.
    state = 99;
    assert.equal(await build().state.current(), 'unknown');
  });

  it('unwraps each listener payload to the value the service wants', () => {
    const source = build();
    const levels: number[] = [];
    const states: string[] = [];
    const stopLevel = source.level.subscribe((v) => levels.push(v));
    const stopState = source.state.subscribe((v) => states.push(v));

    (listeners['level'] as (e: { batteryLevel: number }) => void)({ batteryLevel: 0.1 });
    (listeners['state'] as (e: { batteryState: number }) => void)({ batteryState: 1 });
    (listeners['state'] as (e: { batteryState: number }) => void)({ batteryState: 99 });

    assert.deepEqual(levels, [0.1]);
    assert.deepEqual(states, ['unplugged', 'unknown']);

    stopLevel();
    stopState();
    assert.equal(removed, 2, 'each subscription is given back');
  });
});

describe('the orientation source', () => {
  const expoOrientation = () => ({
    Orientation: {
      UNKNOWN: 0,
      PORTRAIT_UP: 1,
      PORTRAIT_DOWN: 2,
      LANDSCAPE_LEFT: 3,
      LANDSCAPE_RIGHT: 4,
    },
    OrientationLock: { DEFAULT: 0, ALL: 1, PORTRAIT: 2, LANDSCAPE: 3 },
    getOrientationAsync: () => Promise.resolve(reported),
    addOrientationChangeListener: (
      handler: (e: { orientationInfo: { orientation: number } }) => void,
    ) => {
      listener = handler;
      return { remove: () => (removed = true) };
    },
    lockAsync: (lock: number) => {
      locks.push(lock);
      return Promise.resolve();
    },
    unlockAsync: () => {
      locks.push('unlock');
      return Promise.resolve();
    },
  });
  let reported = 1;
  let removed = false;
  let locks: unknown[] = [];
  let listener: ((event: { orientationInfo: { orientation: number } }) => void) | null = null;

  afterEach(() => {
    reported = 1;
    removed = false;
    locks = [];
    listener = null;
  });

  const build = () =>
    withModules({ 'expo-screen-orientation': expoOrientation() }, () =>
      defaultSource(DeviceOrientation.SOURCE),
    ) as unknown as {
      reported: { current(): Promise<string>; subscribe(fn: (v: string) => void): () => void };
      lock(lock: string): Promise<void>;
      unlock(): Promise<void>;
    };

  it('names each of Expo numbered orientations', async () => {
    for (const [number, name] of [
      [0, 'unknown'],
      [1, 'portrait'],
      [2, 'portrait-upside-down'],
      [3, 'landscape-left'],
      [4, 'landscape-right'],
      [99, 'unknown'],
    ] as const) {
      reported = number;
      assert.equal(await build().reported.current(), name, `orientation ${number}`);
    }
  });

  it('translates a lock name into the enum member Expo expects', async () => {
    const source = build();
    await source.lock('portrait');
    await source.lock('landscape');
    await source.unlock();
    // Names rather than numbers at the call site, because a number here is meaningless and a wrong
    // one locks the app to the wrong axis without complaining.
    assert.deepEqual(locks, [2, 3, 'unlock']);
  });

  it('unwraps the change event, which nests the orientation two deep', () => {
    const source = build();
    const seen: string[] = [];
    const stop = source.reported.subscribe((v) => seen.push(v));
    listener!({ orientationInfo: { orientation: 4 } });
    assert.deepEqual(seen, ['landscape-right']);
    stop();
    assert.equal(removed, true);
  });
});

describe('the locale source', () => {
  it('re-reads when the app comes back to the front, and only then', () => {
    let emit: (state: string) => void = () => {};
    let removed = false;
    const modules = {
      'expo-localization': {
        getLocales: () => [{ languageTag: 'en-GB' }],
        getCalendars: () => [{ calendar: 'gregory' }],
      },
      'react-native': {
        AppState: {
          addEventListener: (_event: string, handler: typeof emit) => {
            emit = handler;
            return { remove: () => (removed = true) };
          },
        },
      },
    };

    const source = withModules(modules, () => defaultSource(Locale.SOURCE)) as unknown as {
      locales(): unknown;
      calendars(): unknown;
      onChange(fn: () => void): () => void;
    };

    assert.deepEqual(source.locales(), [{ languageTag: 'en-GB' }]);
    assert.deepEqual(source.calendars(), [{ calendar: 'gregory' }]);

    let changes = 0;
    const stop = source.onChange(() => (changes += 1));
    /*
     * Changing a language means going to Settings and coming back, so `active` is the only state
     * worth re-reading on. Firing on every transition would re-read on the way out as well, which
     * is a read of the old answer.
     */
    emit('background');
    emit('inactive');
    assert.equal(changes, 0);
    emit('active');
    assert.equal(changes, 1);

    stop();
    assert.equal(removed, true);
  });

  it('survives having localization but no react-native to listen through', () => {
    // The web build imports this package; `expo-localization` may resolve there while React Native
    // does not. A source that threw would take the import down.
    const source = withModules(
      { 'expo-localization': { getLocales: () => [], getCalendars: () => [] } },
      () => defaultSource(Locale.SOURCE),
    ) as unknown as { onChange(fn: () => void): () => void };
    assert.doesNotThrow(() => source.onChange(() => {})());
  });

  it('is null with no localization module at all', () => {
    assert.equal(
      withModules({}, () => defaultSource(Locale.SOURCE)),
      null,
    );
  });
});

describe('the storage sources', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('binds to @react-native-async-storage/async-storage, translating get, set and remove', async () => {
    const calls: string[] = [];
    const data: Record<string, string> = { theme: '"dark"' };
    const asyncStorage = {
      default: {
        getItem: async (key: string) => (calls.push(`get:${key}`), data[key] ?? null),
        setItem: async (key: string, value: string) => (
          calls.push(`set:${key}`),
          void (data[key] = value)
        ),
        removeItem: async (key: string) => (calls.push(`remove:${key}`), void delete data[key]),
      },
    };

    const store = withModules({ '@react-native-async-storage/async-storage': asyncStorage }, () =>
      storeService(Storage),
    );

    const theme = store.signal('theme', 'light');
    await settle();
    assert.equal(theme(), 'dark', 'read in through the module getItem faked above');

    theme.set('system');
    await settle();
    assert.equal(data['theme'], '"system"');
    assert.deepEqual(calls, ['get:theme', 'set:theme']);
  });

  it('is inert with no AsyncStorage installed, rather than throwing at startup', async () => {
    const store = withModules({}, () => storeService(Storage));
    const theme = store.signal('theme', 'light');
    await settle();
    assert.equal(theme(), 'light');
  });

  it('binds to expo-secure-store, and reads synchronously where the keychain can answer at once', () => {
    // SecureStore can answer without waiting; AsyncStorage cannot. A token bound through this
    // source should never flash its default while a real read is still in flight elsewhere.
    const data: Record<string, string> = { token: '"abc"' };
    const secureStore = {
      getItemAsync: async (key: string) => data[key] ?? null,
      setItemAsync: async (key: string, value: string) => void (data[key] = value),
      deleteItemAsync: async (key: string) => void delete data[key],
      getItem: (key: string) => data[key] ?? null,
    };

    const store = withModules({ 'expo-secure-store': secureStore }, () =>
      storeService(SecureStorage),
    );
    assert.equal(store.signal('token', '')(), 'abc');
  });

  it('is inert with no expo-secure-store installed', () => {
    const store = withModules({}, () => storeService(SecureStorage));
    assert.equal(store.signal('token', '')(), '');
  });
});

describe('the Sign in with Apple source', () => {
  it('is expo-apple-authentication itself', () => {
    const expoAppleAuthentication = { isAvailableAsync: async () => true };
    assert.equal(
      withModules({ 'expo-apple-authentication': expoAppleAuthentication }, () =>
        defaultSource(AppleSignIn.SOURCE),
      ),
      expoAppleAuthentication,
    );
  });

  it('is inert with no expo-apple-authentication installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(AppleSignIn.SOURCE)),
      null,
    );
  });
});

describe('the notifications source', () => {
  it('is expo-notifications itself, whose functions the service calls by their own names', () => {
    const expoNotifications = { scheduleNotificationAsync: async () => 'id' };
    assert.equal(
      withModules({ 'expo-notifications': expoNotifications }, () =>
        defaultSource(Notifications.SOURCE),
      ),
      expoNotifications,
    );
  });

  it('is inert with no expo-notifications installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(Notifications.SOURCE)),
      null,
    );
  });
});

describe('the store review source', () => {
  it('is expo-store-review itself, whose functions the service calls by their own names', () => {
    const expoStoreReview = { requestReview: async () => {} };
    assert.equal(
      withModules({ 'expo-store-review': expoStoreReview }, () =>
        defaultSource(StoreReview.SOURCE),
      ),
      expoStoreReview,
    );
  });

  it('is inert with no expo-store-review installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(StoreReview.SOURCE)),
      null,
    );
  });
});

describe('the tracking source', () => {
  it('is expo-tracking-transparency itself, whose functions the service calls by their own names', () => {
    const expoTracking = { getAdvertisingId: () => null };
    assert.equal(
      withModules({ 'expo-tracking-transparency': expoTracking }, () =>
        defaultSource(Tracking.SOURCE),
      ),
      expoTracking,
    );
  });

  it('is inert with no expo-tracking-transparency installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(Tracking.SOURCE)),
      null,
    );
  });
});

describe('the document picker source', () => {
  it('is expo-document-picker itself, whose functions the service calls by their own names', () => {
    const expoDocumentPicker = { getDocumentAsync: async () => ({ canceled: true }) };
    assert.equal(
      withModules({ 'expo-document-picker': expoDocumentPicker }, () =>
        defaultSource(DocumentPicker.SOURCE),
      ),
      expoDocumentPicker,
    );
  });

  it('is inert with no expo-document-picker installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(DocumentPicker.SOURCE)),
      null,
    );
  });
});

describe('the crypto source', () => {
  it('is expo-crypto itself, whose functions the service calls by their own names', () => {
    const expoCrypto = { randomUUID: () => 'id' };
    assert.equal(
      withModules({ 'expo-crypto': expoCrypto }, () => defaultSource(Crypto.SOURCE)),
      expoCrypto,
    );
  });

  it('is null with no expo-crypto installed, which the service refuses to answer without', () => {
    assert.equal(
      withModules({}, () => defaultSource(Crypto.SOURCE)),
      null,
    );
  });
});

describe('the background task source', () => {
  it('is expo-background-task itself, whose functions the service calls by their own names', () => {
    const expoBackgroundTask = { registerTaskAsync: async () => {} };
    assert.equal(
      withModules({ 'expo-background-task': expoBackgroundTask }, () =>
        defaultSource(BackgroundTask.SOURCE),
      ),
      expoBackgroundTask,
    );
  });

  it('is inert with no expo-background-task installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(BackgroundTask.SOURCE)),
      null,
    );
  });
});

describe('the screen capture source', () => {
  it('is expo-screen-capture itself, whose functions the service calls by their own names', () => {
    const expoScreenCapture = { addScreenshotListener: () => ({ remove() {} }) };
    assert.equal(
      withModules({ 'expo-screen-capture': expoScreenCapture }, () =>
        defaultSource(ScreenCapture.SOURCE),
      ),
      expoScreenCapture,
    );
  });

  it('is inert with no expo-screen-capture installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(ScreenCapture.SOURCE)),
      null,
    );
  });
});

describe('the image editor source', () => {
  it('is expo-image-manipulator itself, whose functions the service calls by their own names', () => {
    const expoImageManipulator = { ImageManipulator: { manipulate: () => ({}) } };
    assert.equal(
      withModules({ 'expo-image-manipulator': expoImageManipulator }, () =>
        defaultSource(ImageEditor.SOURCE),
      ),
      expoImageManipulator,
    );
  });

  it('is inert with no expo-image-manipulator installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(ImageEditor.SOURCE)),
      null,
    );
  });
});

describe('the media library source', () => {
  it('is expo-media-library itself, whose functions the service calls by their own names', () => {
    const expoMediaLibrary = { getPermissionsAsync: async () => ({ granted: true }) };
    assert.equal(
      withModules({ 'expo-media-library': expoMediaLibrary }, () =>
        defaultSource(MediaLibrary.SOURCE),
      ),
      expoMediaLibrary,
    );
  });

  it('is inert with no expo-media-library installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(MediaLibrary.SOURCE)),
      null,
    );
  });
});

describe('the file system source', () => {
  it('names a file through Paths and File, the classes expo-file-system actually publishes', () => {
    const created: { directory: unknown; name: string }[] = [];
    class FakeFile {
      readonly directory: unknown;
      readonly name: string;
      constructor(directory: unknown, name: string) {
        this.directory = directory;
        this.name = name;
        created.push({ directory, name });
      }
    }
    const cache = { kind: 'cache' };
    const document = { kind: 'documents' };
    const expoFileSystem = {
      Paths: {
        get cache() {
          return cache;
        },
        get document() {
          return document;
        },
      },
      File: FakeFile,
    };

    const files = withModules({ 'expo-file-system': expoFileSystem }, () =>
      defaultSource(FileSystem.SOURCE),
    )!;

    assert.equal(files.cacheDirectory, cache);
    assert.equal(files.documentDirectory, document);

    const file = files.file(cache, 'a.txt');
    assert.deepEqual(created, [{ directory: cache, name: 'a.txt' }]);
    assert.ok(file instanceof FakeFile);
  });

  it('is inert with no expo-file-system installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(FileSystem.SOURCE)),
      null,
    );
  });
});

describe('the network source', () => {
  it('translates the state and the connection-type table from expo-network', async () => {
    let listener: ((event: unknown) => void) | null = null;
    let removed = false;
    const expoNetwork = {
      getNetworkStateAsync: async () => ({
        isConnected: true,
        type: 'WIFI',
        isInternetReachable: false,
      }),
      addNetworkStateListener: (fn: (e: unknown) => void) => (
        (listener = fn),
        { remove: () => (removed = true) }
      ),
    };

    const source = withModules({ 'expo-network': expoNetwork }, () =>
      defaultSource(Network.SOURCE),
    )!;

    assert.deepEqual(await source.current(), { connected: true, type: 'wifi', reachable: false });

    const seen: unknown[] = [];
    const stop = source.subscribe((status) => seen.push(status));
    listener!({ isConnected: false, type: 'NONE' });
    assert.deepEqual(seen, [{ connected: false, type: 'none', reachable: null }]);

    stop();
    assert.equal(removed, true);
  });

  it('reports a connection type Expo does not have as unknown rather than undefined', async () => {
    const source = withModules(
      {
        'expo-network': {
          getNetworkStateAsync: async () => ({ isConnected: true, type: 'SOMETHING_NEW' }),
          addNetworkStateListener: () => ({ remove: () => {} }),
        },
      },
      () => defaultSource(Network.SOURCE),
    )!;
    assert.equal((await source.current()).type, 'unknown');
  });

  it('is inert with no expo-network installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(Network.SOURCE)),
      null,
    );
  });
});

describe('the clipboard source', () => {
  it("binds to expo-clipboard's own JavaScript, which is why haptics does not need this shape", async () => {
    const written: string[] = [];
    let listener: (() => void) | null = null;
    const expoClipboard = {
      getStringAsync: async () => 'hello',
      setStringAsync: async (text: string) => (written.push(text), true),
      addClipboardListener: (fn: () => void) => ((listener = fn), { remove: () => {} }),
    };

    const native = withModules({ 'expo-clipboard': expoClipboard }, () =>
      defaultSource(Clipboard.SOURCE),
    )!;

    assert.equal(await native.getStringAsync(), 'hello');
    await native.setStringAsync('copied');
    assert.deepEqual(written, ['copied']);

    let notified = false;
    native.addClipboardListener(() => (notified = true));
    listener!();
    assert.equal(notified, true);
  });

  it('is inert with no expo-clipboard installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(Clipboard.SOURCE)),
      null,
    );
  });
});

describe('the updates source', () => {
  it('translates checking, fetching and reloading through expo-updates', async () => {
    const reloads: number[] = [];
    const expoUpdates = {
      isEnabled: true,
      checkForUpdateAsync: async () => ({ isAvailable: true }),
      fetchUpdateAsync: async () => ({ isNew: true }),
      reloadAsync: async () => void reloads.push(1),
    };

    const native = withModules({ 'expo-updates': expoUpdates }, () =>
      defaultSource(Updates.SOURCE),
    )!;

    assert.equal(native.enabled, true);
    assert.deepEqual(await native.check(), { isAvailable: true });
    assert.deepEqual(await native.fetch(), { isNew: true });
    await native.reload();
    assert.deepEqual(reloads, [1]);
  });

  it('is inert with no expo-updates installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(Updates.SOURCE)),
      null,
    );
  });
});

describe('the language model source', () => {
  function expoLocalLlm() {
    const calls: unknown[] = [];
    const moduleListeners: Record<string, (event: never) => void> = {};
    const sessionListeners: Record<string, (event: never) => void> = {};
    let removed = 0;
    const session = {
      respond: async (prompt: string) => (calls.push(['respond', prompt]), 'An answer'),
      streamResponse: async (prompt: string) => {
        calls.push(['streamResponse', prompt]);
        sessionListeners['token']!({ token: 'The', accumulated: 'The' } as never);
        sessionListeners['token']!({ token: ' sea', accumulated: 'The sea' } as never);
        return 'The sea.';
      },
      cancelStream: async () => void calls.push('cancelStream'),
      release: () => void calls.push('release'),
      addListener: (event: string, listener: (event: never) => void) => {
        sessionListeners[event] = listener;
        return { remove: () => void (removed += 1) };
      },
    };
    const module = {
      getAvailability: () => 'notEnabled',
      downloadModel: async () => void calls.push('downloadModel'),
      addListener: (event: string, listener: (event: never) => void) => {
        moduleListeners[event] = listener;
        return { remove: () => {} };
      },
    };
    return {
      calls,
      moduleListeners,
      removed: () => removed,
      llm: {
        ExpoLocalLlmModule: module,
        createLLMSession: (config: unknown) => (calls.push(['createLLMSession', config]), session),
      },
    };
  }

  it("reads the availability, and unwraps the module's two events", async () => {
    const fake = expoLocalLlm();
    const source = withModules({ 'expo-local-llm': fake.llm }, () =>
      defaultSource(LanguageModel.SOURCE),
    )!;
    assert.equal(source.availability(), 'notEnabled');

    const seen: unknown[] = [];
    source.onAvailabilityChange((availability) => seen.push(availability));
    source.onDownloadProgress((progress) => seen.push(progress));
    fake.moduleListeners['availabilityChange']!({ availability: 'available' } as never);
    fake.moduleListeners['downloadProgress']!({ progress: 0.5 } as never);
    assert.deepEqual(seen, ['available', 0.5]);

    await source.download();
    assert.deepEqual(fake.calls, ['downloadModel']);
  });

  it('streams through the session, reading the accumulated text, and unsubscribes after', async () => {
    const fake = expoLocalLlm();
    const source = withModules({ 'expo-local-llm': fake.llm }, () =>
      defaultSource(LanguageModel.SOURCE),
    )!;
    const session = source.session({ instructions: 'Be brief.' });
    const seen: string[] = [];
    assert.equal(await session.stream('the sea', (text) => seen.push(text)), 'The sea.');
    assert.deepEqual(seen, ['The', 'The sea']);
    assert.equal(fake.removed(), 1, 'the token listener is removed once the stream ends');

    assert.equal(await session.respond('again'), 'An answer');
    await session.cancel();
    session.release();
    assert.deepEqual(fake.calls, [
      ['createLLMSession', { instructions: 'Be brief.' }],
      ['streamResponse', 'the sea'],
      ['respond', 'again'],
      'cancelStream',
      'release',
    ]);
  });

  it('is inert with expo-local-llm installed but its native module not linked', () => {
    // The package catches `requireNativeModule` itself and exports null: Expo Go, or an app that
    // installed it without rebuilding.
    const fake = expoLocalLlm();
    assert.equal(
      withModules({ 'expo-local-llm': { ...fake.llm, ExpoLocalLlmModule: null } }, () =>
        defaultSource(LanguageModel.SOURCE),
      ),
      null,
    );
  });

  it('is inert with no expo-local-llm installed', () => {
    assert.equal(
      withModules({}, () => defaultSource(LanguageModel.SOURCE)),
      null,
    );
  });
});
