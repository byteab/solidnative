import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createComputed, createRoot } from 'solid-js';
import {
  provideService,
  useService,
  withServiceScope,
  type ServiceToken,
} from '@solidnative/device/solid';
import { FileSystem, type NativeFile } from '../src/solid/file-system.ts';
import {
  Sensor,
  Accelerometer,
  type NativeSensor,
  type VectorMeasurement,
} from '../src/solid/sensors.ts';
import {
  AppleSignIn,
  AppleAuthenticationScope,
  type NativeAppleAuthentication,
  type AppleAuthenticationCredential,
} from '../src/solid/apple-sign-in.ts';

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});
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
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function file() {
  let exists = false;
  const calls: unknown[] = [];
  const value: NativeFile = {
    uri: 'cache://test',
    get exists() {
      return exists;
    },
    size: 0,
    create(options) {
      calls.push(options);
      exists = true;
    },
    write(content) {
      calls.push(content);
    },
    text: async () => 'text',
    textSync: () => 'text',
    bytes: async () => new Uint8Array([1]),
    delete() {
      exists = false;
    },
  };
  return { value, calls };
}
test('FileSystem preserves native identity, directory getters and create-then-write', async () => {
  const native = file();
  const cache = {},
    document = {};
  const locations: unknown[] = [];
  const owner = service(FileSystem, {
    cacheDirectory: cache,
    documentDirectory: document,
    file(directory, name) {
      locations.push([directory, name]);
      return native.value;
    },
  });
  assert.equal(owner.value.cache('draft.txt'), native.value);
  assert.equal(owner.value.document('saved.txt'), native.value);
  owner.value.write(native.value, 'one');
  owner.value.write(native.value, new Uint8Array([2]));
  assert.deepEqual(locations, [
    [cache, 'draft.txt'],
    [document, 'saved.txt'],
  ]);
  assert.deepEqual(native.calls, [{ intermediates: true }, 'one', new Uint8Array([2])]);
  assert.equal(await native.value.text(), 'text');
  owner.stop();
  assert.throws(() => owner.value.cache('late'), /disposed/);
});
test('FileSystem reports absent modules and prevents writes after reentrant create disposal', () => {
  const absent = service(FileSystem, null);
  assert.throws(() => absent.value.cache('missing'), /expo-file-system/);
  const native = file();
  const owner = service(FileSystem, {
    cacheDirectory: {},
    documentDirectory: {},
    file: () => native.value,
  });
  native.value.create = () => owner.stop();
  assert.throws(() => owner.value.write(native.value, 'secret'), /disposed/);
  assert.deepEqual(native.calls, []);
});
function sensorSource() {
  const availability = deferred<boolean>();
  const listeners: ((value: number) => void)[] = [];
  const intervals: number[] = [];
  let removed = 0;
  const source: NativeSensor<number> = {
    isAvailableAsync: () => availability.promise,
    setUpdateInterval: (interval) => {
      intervals.push(interval);
    },
    addListener: (listener) => {
      listeners.push(listener);
      return {
        remove() {
          removed++;
        },
      };
    },
  };
  return { source, listeners, intervals, availability, removed: () => removed };
}
test('Sensor shares one subscription, picks fastest interval, and releases only the caller claim', async () => {
  const native = sensorSource();
  const owner = owned(() => new Sensor(native.source, 0));
  assert.equal(owner.value.available(), null);
  assert.equal(native.listeners.length, 0);
  const first = owned(() => owner.value.start(100));
  const second = owner.value.start(25);
  assert.deepEqual(native.intervals, [100, 25]);
  assert.equal(native.listeners.length, 1);
  native.listeners[0]!(5);
  assert.equal(owner.value.reading(), 5);
  second();
  assert.equal(native.intervals.at(-1), 100);
  first.stop();
  assert.equal(native.removed(), 1);
  native.listeners[0]!(6);
  assert.equal(owner.value.reading(), 5);
  native.availability.resolve(true);
  await settle();
  assert.equal(owner.value.available(), true);
  owner.stop();
  second();
  assert.equal(native.removed(), 1);
  assert.throws(() => owned(() => new Sensor(native.source, 0)).value.start(0), /positive/);
});
test('Sensor ignores late availability and events and compensates synchronous subscription disposal', async () => {
  const native = sensorSource();
  let removed = 0;
  const owner = owned(
    (stop) =>
      new Sensor(
        {
          ...native.source,
          addListener(listener) {
            listener(1);
            stop();
            return {
              remove() {
                removed++;
              },
            };
          },
        },
        0,
      ),
  );
  owner.value.start();
  native.availability.resolve(true);
  await settle();
  assert.equal(removed, 1);
  assert.equal(owner.value.available(), null);
  owner.value.start();
  assert.equal(removed, 1);
});
test('Sensor converges when a remover starts a new claim synchronously', () => {
  let sensor!: Sensor<number>;
  let calls = 0;
  let removed = 0;
  let restart = true;
  const owner = owned(
    () =>
      new Sensor<number>(
        {
          isAvailableAsync: async () => true,
          setUpdateInterval() {},
          addListener() {
            calls++;
            return {
              remove() {
                removed++;
                if (restart) {
                  restart = false;
                  sensor.start(25);
                }
              },
            };
          },
        },
        0,
      ),
  );
  sensor = owner.value;
  const release = sensor.start(100);
  release();
  assert.equal(calls, 2);
  assert.equal(removed, 1);
  owner.stop();
  assert.equal(removed, 2);
});
test('Sensor recovers after native acquisition failures and suppresses disposal reentry', () => {
  let sensor!: Sensor<number>;
  let fail = true;
  let subscriptions = 0;
  const owner = owned(
    () =>
      new Sensor<number>(
        {
          isAvailableAsync: async () => true,
          setUpdateInterval() {},
          addListener() {
            if (fail) throw Error('native failed');
            subscriptions++;
            return {
              remove() {
                sensor.start(10);
              },
            };
          },
        },
        0,
      ),
  );
  sensor = owner.value;
  assert.throws(() => sensor.start(), /native failed/);
  fail = false;
  sensor.start();
  owner.stop();
  assert.equal(subscriptions, 1);
});
test('Sensor publication reentry stops the old subscription and source tokens retain caller ownership', () => {
  let emit!: (value: VectorMeasurement) => void;
  let removed = 0;
  const owner = service(Accelerometer, {
    isAvailableAsync: async () => true,
    setUpdateInterval() {},
    addListener(listener) {
      emit = listener;
      return {
        remove() {
          removed++;
        },
      };
    },
  });
  owned(() =>
    createComputed(() => {
      if (owner.value.reading().x === 1) owner.stop();
    }),
  );
  owner.value.start();
  emit({ x: 1, y: 0, z: 0, timestamp: 1 });
  emit({ x: 2, y: 0, z: 0, timestamp: 2 });
  assert.equal(owner.value.reading().x, 1);
  assert.equal(removed, 1);
});
const credential: AppleAuthenticationCredential = {
  user: 'apple-user',
  state: 'nonce-state',
  fullName: null,
  email: null,
  realUserStatus: 1,
  identityToken: 'signed-token',
  authorizationCode: 'one-time-code',
};
function apple(overrides: Partial<NativeAppleAuthentication> = {}): NativeAppleAuthentication {
  return {
    isAvailableAsync: async () => true,
    signInAsync: async () => credential,
    refreshAsync: async () => credential,
    signOutAsync: async () => credential,
    getCredentialStateAsync: async () => 1,
    formatFullName: () => 'User',
    addRevokeListener: () => ({ remove() {} }),
    ...overrides,
  };
}
test('AppleSignIn preserves secure options, credentials, availability, formatting and revocations', async () => {
  let revoke!: () => void;
  let removed = 0;
  let options: unknown;
  const owner = service(
    AppleSignIn,
    apple({
      signInAsync: async (input) => {
        options = input;
        return credential;
      },
      addRevokeListener: (listener) => {
        revoke = listener;
        return {
          remove() {
            removed++;
          },
        };
      },
    }),
  );
  assert.equal(await owner.value.available(), true);
  const request = {
    requestedScopes: [AppleAuthenticationScope.EMAIL],
    state: 'state',
    nonce: 'nonce',
  };
  assert.equal(await owner.value.signIn(request), credential);
  assert.deepEqual(options, request);
  assert.equal(await owner.value.refresh({ user: 'apple-user' }), credential);
  assert.equal(await owner.value.signOut({ user: 'apple-user' }), credential);
  assert.equal(await owner.value.credentialState('apple-user'), 1);
  assert.equal(
    owner.value.formatName({
      namePrefix: null,
      givenName: 'User',
      middleName: null,
      familyName: null,
      nameSuffix: null,
      nickname: null,
    }),
    'User',
  );
  revoke();
  assert.equal(owner.value.revoked(), 1);
  owner.stop();
  revoke();
  assert.equal(owner.value.revoked(), 1);
  assert.equal(removed, 1);
});
test('AppleSignIn returns null for cancellation/absence and retains genuine native failures', async () => {
  const absent = service(AppleSignIn, null);
  assert.equal(await absent.value.available(), false);
  assert.equal(await absent.value.signIn(), null);
  const cancelled = service(
    AppleSignIn,
    apple({
      signInAsync: async () => {
        throw { code: 'ERR_REQUEST_CANCELED' };
      },
    }),
  );
  assert.equal(await cancelled.value.signIn(), null);
  const failed = service(
    AppleSignIn,
    apple({
      signInAsync: async () => {
        throw Error('native failure');
      },
    }),
  );
  await assert.rejects(failed.value.signIn(), /native failure/);
});
test('AppleSignIn cancels caller-owned credential answers without releasing root service', async () => {
  const answer = deferred<AppleAuthenticationCredential>();
  let removed = 0;
  const owner = service(
    AppleSignIn,
    apple({
      signInAsync: () => answer.promise,
      addRevokeListener: () => ({
        remove() {
          removed++;
        },
      }),
    }),
  );
  const caller = owned(() => owner.value.signIn());
  caller.stop();
  assert.equal(await caller.value, null);
  answer.resolve(credential);
  await settle();
  assert.equal(removed, 0);
  const late = deferred<AppleAuthenticationCredential>();
  const second = service(AppleSignIn, apple({ refreshAsync: () => late.promise }));
  const pending = second.value.refresh({ user: 'user' });
  second.stop();
  assert.equal(await pending, null);
  late.reject(Error('late failure'));
  await settle();
  owner.stop();
  assert.equal(removed, 1);
});
test('AppleSignIn releases subscriptions acquired during synchronous root disposal exactly once', () => {
  let removed = 0;
  assert.throws(
    () =>
      owned((stop) =>
        withServiceScope(
          [
            provideService(AppleSignIn.SOURCE, () =>
              apple({
                addRevokeListener() {
                  stop();
                  return {
                    remove() {
                      removed++;
                    },
                  };
                },
              }),
            ),
          ],
          () => useService(AppleSignIn),
        ),
      ),
    /scope was disposed/,
  );
  assert.equal(removed, 1);
});
