import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createComputed, createRoot, createSignal } from 'solid-js';
import {
  provideService,
  useService,
  withServiceScope,
  type ServiceToken,
} from '@solid-native/device/solid';
import { Battery, type BatteryState } from '@solid-native/expo/solid/battery';
import { Network, type NetworkStatus } from '@solid-native/expo/solid/network';
import { Clipboard } from '@solid-native/expo/solid/clipboard';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { Brightness } from '@solid-native/expo/solid/brightness';
import { DeviceOrientation, type OrientationLock } from '@solid-native/expo/solid/orientation';
import { KeepAwake } from '@solid-native/expo/solid/keep-awake';
import { Locale } from '@solid-native/expo/solid/locale';
import { Browser } from '@solid-native/expo/solid/browser';
import { Crypto, CryptoDigestAlgorithm } from '@solid-native/expo/solid/crypto';
import { Store, Storage, SecureStorage } from '@solid-native/expo/solid/store';
import { Permission, nativeState, type PermissionResponse } from '@solid-native/expo/solid';

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const stop of disposers.splice(0)) stop();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function owned<T>(create: (dispose: () => void) => T) {
  let stop!: () => void;
  const value = createRoot((dispose) => {
    stop = dispose;
    disposers.push(dispose);
    return create(dispose);
  });
  return { value, stop };
}
function service<T, S>(token: ServiceToken<T> & { SOURCE: ServiceToken<S> }, source: S) {
  return owned(() =>
    withServiceScope([provideService(token.SOURCE, () => source)], () => useService(token)),
  );
}
function observed<T>(initial: T) {
  let listener!: (value: T) => void;
  let removed = 0;
  const read = deferred<T>();
  const order: string[] = [];
  return {
    source: {
      subscribe(callback: (value: T) => void) {
        order.push('subscribe');
        listener = callback;
        return () => {
          removed++;
        };
      },
      current() {
        order.push('read');
        return read.promise;
      },
    },
    emit: (value: T) => listener(value),
    answer: () => read.resolve(initial),
    removed: () => removed,
    order,
  };
}
const granted: PermissionResponse = { status: 'granted', granted: true, canAskAgain: true };
const denied: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };

test('Battery preserves unknown sentinel, charging thresholds and stale subscription protection', async () => {
  const level = observed(-1);
  const state = observed<BatteryState>('unknown');
  const saving = observed(false);
  const { value, stop } = service(Battery, {
    level: level.source,
    state: state.source,
    saving: saving.source,
  });
  assert.deepEqual(level.order, ['subscribe', 'read']);
  level.answer();
  state.answer();
  saving.answer();
  await settle();
  assert.equal(value.known(), false);
  assert.equal(value.level(), 1);
  assert.equal(value.low(), false);
  level.emit(0.1);
  assert.equal(value.low(), true);
  state.emit('full');
  assert.equal(value.charging(), true);
  assert.equal(value.low(), false);
  saving.emit(true);
  assert.equal(value.saving(), true);
  stop();
  level.emit(0.9);
  assert.equal(value.level(), 0.1);
  assert.equal(level.removed(), 1);
  assert.equal(state.removed(), 1);
  assert.equal(saving.removed(), 1);
});
test('Network separates unknown reachability and newer events from initial snapshots', async () => {
  const source = observed<NetworkStatus>({ connected: false, type: 'none', reachable: false });
  const { value, stop } = service(Network, source.source);
  assert.equal(value.reachable(), null);
  source.emit({ connected: true, type: 'wifi', reachable: null });
  source.answer();
  await settle();
  assert.equal(value.connected(), true);
  assert.equal(value.type(), 'wifi');
  assert.equal(value.reachable(), null);
  stop();
  assert.equal(source.removed(), 1);
});
test('Clipboard listens without prompting reads and cancels caller answers', async () => {
  let reads = 0,
    removed = 0;
  let change!: () => void;
  const answer = deferred<string>();
  const { value, stop } = service(Clipboard, {
    addClipboardListener(callback) {
      change = callback;
      return {
        remove() {
          removed++;
        },
      };
    },
    getStringAsync() {
      reads++;
      return answer.promise;
    },
    setStringAsync: async () => true,
  });
  assert.equal(reads, 0);
  change();
  assert.equal(value.changes(), 1);
  const pending = value.read();
  stop();
  assert.equal(await pending, '');
  answer.resolve('secret');
  await settle();
  change();
  assert.equal(value.changes(), 1);
  assert.equal(removed, 1);
});
test('Haptics preserves defaults and isolates synchronous/rejected feedback errors', async () => {
  const calls: string[] = [];
  const { value, stop } = service(Haptics, {
    impactAsync(style) {
      calls.push(style);
      throw Error('unsupported');
    },
    notificationAsync: async (type) => {
      calls.push(type);
      throw Error('failed');
    },
    selectionAsync: async () => {
      calls.push('select');
    },
  });
  assert.equal(value.available, true);
  value.impact();
  value.notify('success');
  value.select();
  await settle();
  stop();
  value.impact();
  assert.deepEqual(calls, ['medium', 'success', 'select']);
});
test('Permission rejects stale check over request, preserves blocked semantics and propagates failure', async () => {
  const check = deferred<PermissionResponse>();
  let requests = 0;
  const { value } = owned(
    () =>
      new Permission({
        get: () => check.promise,
        request: async () => {
          requests++;
          return granted;
        },
      }),
  );
  assert.equal(value.status(), 'unknown');
  const older = value.check();
  assert.equal(await value.request(), true);
  check.resolve(denied);
  assert.equal(await older, false);
  assert.equal(value.granted(), true);
  assert.equal(value.blocked(), false);
  const blocked = owned(() =>
    Permission.of(
      async () => denied,
      async () => {
        requests++;
        return granted;
      },
    ),
  ).value;
  assert.equal(await blocked.ensure(), false);
  assert.equal(blocked.blocked(), true);
  assert.equal(requests, 1);
  const failed = owned(() =>
    Permission.of(
      async () => {
        throw Error('native failure');
      },
      async () => granted,
    ),
  ).value;
  await assert.rejects(failed.check(), /native failure/);
});
test('Permission caller disposal during ensure does not start a prompt', async () => {
  const check = deferred<PermissionResponse>();
  let prompts = 0;
  const { value } = owned(
    () =>
      new Permission({
        get: () => check.promise,
        request: async () => {
          prompts++;
          return granted;
        },
      }),
  );
  const caller = owned(() => value.ensure());
  caller.stop();
  assert.equal(await caller.value, false);
  check.resolve(denied);
  await settle();
  assert.equal(prompts, 0);
});
test('nativeState is source-injectable, releases once and hides released IDs', () => {
  let released = 0,
    value: unknown = 'a';
  const owner = owned(() =>
    nativeState('a', {
      create: () => ({
        __expo_shared_object_id__: 7,
        getValue: () => value,
        setValue: (data) => {
          value = data.value;
        },
        release: () => {
          released++;
        },
      }),
    }),
  );
  assert.equal(owner.value!.id, 7);
  owner.value!.set('b');
  assert.equal(owner.value!.get(), 'b');
  owner.value!.release();
  owner.stop();
  assert.equal(released, 1);
  assert.equal(owner.value!.id, undefined);
  assert.throws(() => owner.value!.set('c'), /released/);
});
test('nativeState compensates reentrant disposal during allocation', () => {
  let released = 0;
  const owner = owned((stop) =>
    nativeState('', {
      create() {
        stop();
        return {
          getValue: () => '',
          setValue() {},
          release() {
            released++;
          },
        };
      },
    }),
  );
  assert.equal(owner.value, null);
  assert.equal(released, 1);
});
test('nativeState default source wraps ExpoUI ObservableState, and is null without expo', () => {
  assert.equal(owned(() => withServiceScope([], () => nativeState('hello'))).value, null);
  let nextId = 1;
  let released = 0;
  class ObservableState {
    readonly __expo_shared_object_id__ = nextId++;
    private init: { value: unknown };
    constructor(init: { value: unknown }) {
      this.init = init;
    }
    getValue = () => this.init.value;
    setValue = (next: { value: unknown }) => void (this.init = next);
    release = () => void released++;
  }
  const host = globalThis as Record<string, unknown>;
  host['require'] = (id: string) => {
    if (id !== 'expo') throw new Error(`Cannot find module '${id}'`);
    return {
      requireNativeModule: (name: string) => (assert.equal(name, 'ExpoUI'), { ObservableState }),
    };
  };
  try {
    const owner = owned(() => withServiceScope([], () => [nativeState('a')!, nativeState('b')!]));
    const [first, second] = owner.value;
    assert.notEqual(first.id, second.id);
    assert.equal(first.get(), 'a');
    first.set('typed');
    assert.equal(first.get(), 'typed');
    owner.stop();
    assert.equal(released, 2);
  } finally {
    delete host['require'];
  }
});
test('Brightness nested claims restore after pending acquisition and ignore stale read', async () => {
  const read = deferred<number>();
  const calls: (number | string)[] = [];
  const owner = service(Brightness, {
    get: () => read.promise,
    set: async (value) => {
      calls.push(value);
    },
    restore: async () => {
      calls.push('restore');
    },
  });
  await Promise.resolve();
  const first = owner.value.set(0.6);
  const second = owner.value.set(2);
  read.resolve(0.2);
  await settle();
  assert.equal(owner.value.level(), 1);
  assert.deepEqual(calls, [1]);
  first();
  assert.equal(owner.value.level(), 1);
  second();
  await settle();
  assert.deepEqual(calls, [1, 'restore']);
  assert.equal(owner.value.level(), 0.2);
  owner.value.set(0.8);
  await settle();
  owner.stop();
  await settle();
  assert.deepEqual(calls.slice(-2), [0.8, 'restore']);
});
test('Brightness restore snapshot cannot overwrite a newer set and failures are observable', async () => {
  const answer = deferred<number>();
  let reads = 0;
  const owner = service(Brightness, {
    get: () => (++reads === 1 ? Promise.resolve(0.2) : answer.promise),
    set: async () => {
      throw Error('brightness denied');
    },
    restore: async () => {},
  });
  await settle();
  owner.value.restore();
  await settle();
  owner.value.set(0.7);
  answer.resolve(0.1);
  await settle();
  assert.equal(owner.value.level(), 0.7);
  assert.match(owner.value.error()!.message, /denied/);
});
test('Orientation serializes native lock ownership and unlocks after late acquisition', async () => {
  const acquisition = deferred<void>();
  const calls: (OrientationLock | string)[] = [];
  const owner = service(DeviceOrientation, {
    reported: null,
    lock: (value) => {
      calls.push(value);
      return acquisition.promise;
    },
    unlock: async () => {
      calls.push('unlock');
    },
  });
  owner.value.lock('landscape');
  await settle();
  owner.stop();
  acquisition.resolve();
  await settle();
  assert.deepEqual(calls, ['landscape', 'unlock']);
});
test('KeepAwake counts same tags, handles caller disposal, and releases after async activation', async () => {
  const activation = deferred<void>();
  const calls: string[] = [];
  const owner = service(KeepAwake, {
    activate: (tag) => {
      calls.push('+' + tag);
      return activation.promise;
    },
    deactivate: async (tag) => {
      calls.push('-' + tag);
    },
  });
  const first = owned(() => owner.value.hold('camera'));
  const second = owner.value.hold('camera');
  await settle();
  first.stop();
  assert.equal(owner.value.active(), true);
  second();
  assert.equal(owner.value.active(), false);
  activation.resolve();
  await settle();
  assert.deepEqual(calls, ['+camera', '-camera']);
  owner.value.hold('screen');
  await settle();
  owner.stop();
  await settle();
  assert.deepEqual(calls.slice(-2), ['+screen', '-screen']);
});
test('KeepAwake synchronous publication disposal cannot leak an acquisition', async () => {
  const calls: string[] = [];
  const owner = service(KeepAwake, {
    activate: async (tag) => {
      calls.push('+' + tag);
    },
    deactivate: async (tag) => {
      calls.push('-' + tag);
    },
  });
  owned(() =>
    createComputed(() => {
      if (owner.value.active()) owner.stop();
    }),
  );
  owner.value.hold('test');
  await settle();
  assert.equal(calls.includes('+test'), false);
});
test('Locale subscribes before reading and reacts to preferred language/calendar changes', () => {
  let notify!: () => void;
  let removed = 0;
  let tag = 'en-US';
  const order: string[] = [];
  const owner = service(Locale, {
    locales: () => {
      order.push('read');
      return [
        {
          languageTag: tag,
          languageCode: 'en',
          regionCode: 'US',
          textDirection: tag === 'ar' ? 'rtl' : 'ltr',
          digitGroupingSeparator: ',',
          decimalSeparator: '.',
          currencyCode: 'USD',
          currencySymbol: '$',
          measurementSystem: 'us',
          temperatureUnit: 'fahrenheit',
        },
      ];
    },
    calendars: () => [],
    onChange: (callback) => {
      order.push('subscribe');
      notify = callback;
      return () => {
        removed++;
      };
    },
  });
  assert.equal(order[0], 'subscribe');
  assert.equal(owner.value.tag(), 'en-US');
  tag = 'ar';
  notify();
  assert.equal(owner.value.rtl(), true);
  owner.stop();
  assert.equal(removed, 1);
});
test('Browser returns auth redirect and cancellation without reviving disposed callers', async () => {
  const result = deferred<{ type: 'success'; url: string }>();
  const owner = service(Browser, {
    openBrowserAsync: async () => ({ type: 'dismiss' }),
    openAuthSessionAsync: () => result.promise,
  });
  await owner.value.open('https://example.test');
  const caller = owned(() => owner.value.signIn('https://auth.test', 'app://return'));
  caller.stop();
  assert.equal(await caller.value, null);
  result.resolve({ type: 'success', url: 'app://return?code=1' });
  await settle();
  const success = service(Browser, {
    openBrowserAsync: async () => ({ type: 'dismiss' }),
    openAuthSessionAsync: async () => ({ type: 'success', url: 'app://return' }),
  });
  assert.equal(await success.value.signIn('https://auth.test', 'app://return'), 'app://return');
});
test('Crypto calls native secure functions and never invents missing/cancelled secure data', async () => {
  const bytes = deferred<Uint8Array>();
  const owner = service(Crypto, {
    randomUUID: () => 'uuid',
    digestStringAsync: async () => 'hash',
    digest: async () => new ArrayBuffer(1),
    getRandomBytes: (size) => new Uint8Array(size),
    getRandomBytesAsync: () => bytes.promise,
    getRandomValues: (array) => array,
  });
  assert.equal(owner.value.randomUUID(), 'uuid');
  assert.equal(await owner.value.digestString(CryptoDigestAlgorithm.SHA256, 'x'), 'hash');
  assert.equal(owner.value.randomBytes(2).length, 2);
  const result = owner.value.randomBytesAsync(2);
  owner.stop();
  await assert.rejects(result, /cancelled/);
  bytes.resolve(new Uint8Array(2));
  await settle();
  const absent = service(Crypto, null);
  assert.throws(() => absent.value.randomUUID(), /expo-crypto/);
});
test('Storage and SecureStorage retain independent scoped source overrides', () => {
  const owner = owned(() =>
    withServiceScope(
      [
        provideService(Storage.SOURCE, () => null),
        provideService(SecureStorage.SOURCE, () => null),
      ],
      () => [useService(Storage), useService(SecureStorage)],
    ),
  );
  assert.notEqual(owner.value[0], owner.value[1]);
  assert.ok(owner.value[0] instanceof Store);
});
test('Store publication reentry persists only latest value and disposal cancels pending writes', async () => {
  const writes: string[] = [];
  const store = owned(
    () =>
      new Store({
        get: async () => null,
        set: async (_key, value) => {
          writes.push(value);
        },
        remove: async () => {},
      }),
  );
  const count = store.value.signal('count', 0);
  await settle();
  owned(() =>
    createComputed(() => {
      if (count() === 1) count.set(2);
    }),
  );
  count.set(1);
  await store.value.flush();
  assert.deepEqual(writes, ['2']);
  owned(() =>
    createComputed(() => {
      if (count() === 3) store.stop();
    }),
  );
  count.set(3);
  await settle();
  assert.deepEqual(writes, ['2']);
});
test('nested service scope delegates unoverridden services to root lifetime', () => {
  let removed = 0;
  const source = {
    getStringAsync: async () => '',
    setStringAsync: async () => true,
    addClipboardListener: () => ({
      remove() {
        removed++;
      },
    }),
  };
  const outer = owned(() =>
    withServiceScope([provideService(Clipboard.SOURCE, () => source)], () => {
      const nested = owned(() => withServiceScope([], () => useService(Clipboard)));
      nested.stop();
      assert.equal(removed, 0);
      return useService(Clipboard);
    }),
  );
  outer.stop();
  assert.equal(removed, 1);
});
test('source construction stays lazy when only creating a scope', () => {
  const [calls, setCalls] = createSignal(0);
  owned(() =>
    withServiceScope(
      [
        provideService(Battery.SOURCE, () => {
          setCalls((n) => n + 1);
          return { level: null, state: null, saving: null };
        }),
      ],
      () => undefined,
    ),
  );
  assert.equal(calls(), 0);
});

test('Brightness mutations never wait behind a hung initial or restore snapshot read', async () => {
  const snapshot = deferred<number>();
  const calls: number[] = [];
  const owner = service(Brightness, {
    get: () => snapshot.promise,
    set: async (value) => {
      calls.push(value);
    },
    restore: async () => {},
  });
  owner.value.set(0.8);
  await settle();
  assert.deepEqual(calls, [0.8]);
  owner.value.restore();
  await settle();
  owner.value.set(0.7);
  await settle();
  assert.deepEqual(calls, [0.8, 0.7]);
  owner.stop();
  snapshot.resolve(0.1);
  await settle();
  assert.equal(owner.value.level(), 0.7);
});

test('Store updates still persist when a key was removed before its first binding', async () => {
  const writes: string[] = [];
  const owner = owned(
    () =>
      new Store({
        get: async () => null,
        set: async (_key, value) => {
          writes.push(value);
        },
        remove: async () => {},
      }),
  );
  await owner.value.remove('count');
  const count = owner.value.signal('count', 0);
  await settle();
  count.update((value) => value + 1);
  await owner.value.flush();
  assert.equal(count(), 1);
  assert.deepEqual(writes, ['1']);
});
