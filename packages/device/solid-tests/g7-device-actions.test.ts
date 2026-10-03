import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Sharing,
  sharingSource,
  type ShareRequest,
  Vibration,
  DevMenu,
  LayoutAnimation,
  androidPermission,
  androidPermissionOf,
} from '@solidnative/device/solid';
import { deferred, scope, service } from './g7-device-utils.ts';

test('sharing reports actual completion, contains source failures, and never opens empty content', async () => {
  let calls = 0;
  let behavior = 'sharedAction';
  const root = service(Sharing, {
    share: () => {
      calls++;
      if (behavior === 'throw') throw new Error('unavailable');
      if (behavior === 'reject') return Promise.reject(new Error('unavailable'));
      return Promise.resolve({ action: behavior });
    },
  });
  assert.equal(await root.value.share({ title: 'Empty' }), false);
  assert.equal(calls, 0);
  for (const action of ['sharedAction', 'dismissedAction', 'throw', 'reject']) {
    behavior = action;
    assert.equal(await root.value.share({ message: 'Hello' }), action === 'sharedAction');
  }
  root.dispose();
  assert.equal(await root.value.share({ message: 'Late' }), false);
  assert.equal(calls, 4);
  const inert = service(Sharing, null);
  assert.equal(await inert.value.share({ url: 'https://example.test' }), false);
  inert.dispose();
});

test('sharing snapshots caller content and cancels pending answers at both lifetime boundaries', async () => {
  const first = deferred<{ action: string }>();
  let content!: ShareRequest;
  const root = service(Sharing, {
    share(request) {
      content = request;
      return first.promise;
    },
  });
  const request = { message: 'original' };
  const screen = scope(() => root.value.share(request));
  request.message = 'changed';
  assert.equal(content.message, 'original');
  screen.dispose();
  assert.equal(await screen.value, false);
  const second = root.value.share({ url: 'https://example.test' });
  root.dispose();
  assert.equal(await second, false);
  first.resolve({ action: 'sharedAction' });
  await first.promise;
  assert.equal(await screen.value, false);
});

test('sharing native source puts URLs into Android messages while retaining iOS content', async () => {
  for (const platform of ['ios', 'android']) {
    const captured: ShareRequest[] = [];
    const source = sharingSource({
      Platform: { OS: platform },
      Share: {
        share: async (request) => {
          captured.push(request);
          return { action: 'sharedAction' };
        },
      },
    })!;
    const request = Object.freeze({
      title: 'Title',
      message: 'Read this',
      url: 'https://example.test',
    });
    await source.share(request);
    await source.share({ url: 'https://example.test' });
    assert.deepEqual(
      captured[0],
      platform === 'android'
        ? { title: 'Title', message: 'Read this\nhttps://example.test' }
        : request,
    );
    assert.deepEqual(
      captured[1],
      platform === 'android'
        ? { title: undefined, message: 'https://example.test' }
        : { url: 'https://example.test' },
    );
  }
  assert.equal(sharingSource(null), null);
});

test('vibration copies patterns, stops started work once and blocks calls after disposal', () => {
  const calls: [number | number[] | undefined, boolean | undefined][] = [];
  let cancels = 0;
  const root = service(Vibration, {
    vibrate: (pattern, repeat) => void calls.push([pattern, repeat]),
    cancel: () => void cancels++,
  });
  root.value.buzz();
  const pattern = [0, 20, 50];
  root.value.pattern(pattern, { repeat: true });
  pattern[1] = 999;
  assert.deepEqual(calls, [
    [400, false],
    [[0, 20, 50], true],
  ]);
  root.value.stop();
  assert.equal(cancels, 1);
  root.value.buzz(150);
  root.dispose();
  root.dispose();
  root.value.buzz();
  root.value.pattern([1]);
  root.value.stop();
  assert.equal(cancels, 2);
  assert.equal(calls.length, 3);
});

test('vibration acquisition handles synchronous disposal once and dormant sources need no cancel', () => {
  let cancels = 0;
  const root = service(Vibration, { vibrate: () => root.dispose(), cancel: () => void cancels++ });
  root.value.pattern([0, 30], { repeat: true });
  assert.equal(cancels, 1);
  const dormant = service(Vibration, { vibrate() {}, cancel: () => void cancels++ });
  dormant.dispose();
  assert.equal(cancels, 1);
  const inert = service(Vibration, null);
  inert.value.buzz();
  inert.value.pattern([0, 20]);
  inert.value.stop();
  inert.dispose();
});

test('developer menu replaces callbacks by title and releases screen handlers without affecting replacements', () => {
  const handlers: (() => unknown)[] = [];
  const labels: string[] = [];
  const calls: string[] = [];
  const root = service(DevMenu, {
    development: true,
    menu: {
      addMenuItem(title, handler) {
        labels.push(title);
        handlers.push(handler);
      },
      reload: (reason) => void calls.push(reason ?? ''),
    },
  });
  assert.equal(root.value.available, true);
  const first = scope(() => root.value.add('Clear', () => calls.push('old')));
  root.value.add('Clear', () => calls.push('new'));
  first.dispose();
  handlers[0]();
  handlers[1]();
  assert.deepEqual(calls, ['new']);
  assert.deepEqual(labels, ['Clear', 'Clear']);
  const second = scope(() => root.value.add('Second', () => calls.push('screen')));
  second.dispose();
  handlers[2]();
  root.value.reload();
  root.value.reload('manual');
  assert.deepEqual(calls, ['new', 'requested by the app', 'manual']);
  root.dispose();
  assert.equal(root.value.available, false);
  handlers[1]();
  root.value.add('No', () => calls.push('bad'));
  root.value.reload('bad');
  assert.equal(labels.length, 3);
  assert.equal(calls.length, 3);
});

test('developer menu release builds stay unregistered and source failures are retryable', () => {
  let registrations = 0;
  let fail = true;
  const native = {
    addMenuItem() {
      registrations++;
      if (fail) throw new Error('menu unavailable');
    },
    reload() {},
  };
  const release = service(DevMenu, { development: false, menu: native });
  release.value.add('No', () => {});
  assert.equal(release.value.available, false);
  assert.equal(registrations, 0);
  release.dispose();
  const root = service(DevMenu, { development: true, menu: native });
  assert.throws(() => root.value.add('Retry', () => {}), /unavailable/);
  fail = false;
  root.value.add('Retry', () => {});
  assert.equal(registrations, 2);
  root.dispose();
  const missing = service(DevMenu, { development: true, menu: null });
  assert.equal(missing.value.available, false);
  missing.value.add('No', () => {});
  missing.value.reload();
  missing.dispose();
});

test('layout animation preserves native configuration and always configures before changing state', async () => {
  const configs: object[] = [];
  const order: string[] = [];
  const root = service(LayoutAnimation, {
    configureNext(config, done) {
      order.push('configure');
      configs.push(config);
      done?.();
    },
  });
  await root.value.animate(() => order.push('change'));
  await root.value.animate(() => {}, {
    duration: 200,
    easing: 'spring',
    appear: 'scaleXY',
    leave: 'none',
  });
  await root.value.animate(() => {}, {
    duration: 0,
    easing: 'keyboard',
    appear: 'none',
    leave: 'none',
  });
  assert.deepEqual(order.slice(0, 2), ['configure', 'change']);
  assert.deepEqual(configs, [
    {
      duration: 300,
      update: { type: 'easeInEaseOut' },
      create: { type: 'easeInEaseOut', property: 'opacity' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    },
    {
      duration: 200,
      update: { type: 'spring', springDamping: 0.7 },
      create: { type: 'spring', property: 'scaleXY' },
    },
    { duration: 0, update: { type: 'keyboard' } },
  ]);
  root.dispose();
});

test('layout fallback waits are bounded and cancellation clears timers at caller and service boundaries', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const callbacks: (() => void)[] = [];
  let changes = 0;
  const root = service(LayoutAnimation, {
    configureNext(_config, done) {
      callbacks.push(done!);
    },
  });
  let complete = false;
  const wait = root.value
    .animate(() => changes++, { duration: 100 })
    .then(() => {
      complete = true;
    });
  t.mock.timers.tick(149);
  await Promise.resolve();
  assert.equal(complete, false);
  t.mock.timers.tick(1);
  await wait;
  const screen = scope(() => root.value.animate(() => changes++, { duration: 9000 }));
  screen.dispose();
  await screen.value;
  const pending = root.value.animate(() => changes++, { duration: 9000 });
  root.dispose();
  await pending;
  callbacks.forEach((callback) => {
    callback();
    callback();
  });
  t.mock.timers.tick(10000);
  await root.value.animate(() => changes++);
  assert.equal(changes, 3);
  assert.equal(clear.mock.callCount(), 3, 'each timeout is cleared exactly once');
});

test('layout source errors do not discard application changes, while change errors reject and acquire no timers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timers = t.mock.method(globalThis, 'setTimeout');
  for (const failure of ['throw', 'callback']) {
    let changed = 0;
    const root = service(LayoutAnimation, {
      configureNext(_config, _done, fail) {
        if (failure === 'throw') throw new Error('configure failed');
        fail?.();
      },
    });
    await assert.rejects(
      root.value.animate(() => changed++),
      /failed/,
    );
    assert.equal(changed, 1);
    root.dispose();
  }
  const root = service(LayoutAnimation, {
    configureNext(_config, done) {
      done?.();
    },
  });
  await assert.rejects(
    root.value.animate(() => {
      throw new Error('change failed');
    }),
    /change failed/,
  );
  assert.equal(timers.mock.callCount(), 0);
  root.dispose();
});

test('layout reentrant disposal suppresses abandoned changes and inert native support still applies live changes', async () => {
  let changed = 0;
  const root = service(LayoutAnimation, {
    configureNext() {
      root.dispose();
    },
  });
  await root.value.animate(() => changed++);
  assert.equal(changed, 0);
  const inert = service(LayoutAnimation, null);
  await inert.value.animate(() => changed++);
  assert.equal(changed, 1);
  inert.dispose();
  await inert.value.animate(() => changed++);
  assert.equal(changed, 1);
});

test('Android permission adapter preserves unknown, grant, denial and blocked answers with source failures', async () => {
  const calls: string[] = [];
  let granted = false;
  let status = 'denied';
  const [get, request] = androidPermissionOf(
    {
      check: async (permission) => {
        calls.push(permission);
        return granted;
      },
      request: async (permission) => {
        calls.push(permission);
        return status;
      },
    },
    'android.permission.CAMERA',
  );
  assert.deepEqual(await get(), { status: 'undetermined', granted: false, canAskAgain: true });
  assert.deepEqual(await request(), { status: 'denied', granted: false, canAskAgain: true });
  status = 'never_ask_again';
  assert.deepEqual(await request(), { status: 'denied', granted: false, canAskAgain: false });
  status = 'granted';
  granted = true;
  for (const read of [get, request])
    assert.deepEqual(await read(), { status: 'granted', granted: true, canAskAgain: false });
  assert.deepEqual(calls, Array(5).fill('android.permission.CAMERA'));
  const broken = androidPermissionOf(
    {
      check: async () => {
        throw new Error('check');
      },
      request: async () => {
        throw new Error('request');
      },
    },
    'CAMERA',
  );
  await assert.rejects(broken[0], /check/);
  await assert.rejects(broken[1], /request/);
  for (const read of [...androidPermissionOf(null, 'CAMERA'), ...androidPermission('CAMERA')])
    assert.deepEqual(await read(), { status: 'granted', granted: true, canAskAgain: false });
});
