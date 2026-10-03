import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createComputed, createRoot, createSignal, untrack } from 'solid-js';
import {
  provideService,
  useService,
  withServiceScope,
  type ServiceToken,
} from '@solidnative/device/solid';
import { AppInfo } from '../src/solid/app-info.ts';
import { Assets, assetResource, type AssetLike } from '../src/solid/assets.ts';
import { FontRegistry, Fonts, registrationsFor } from '../src/solid/fonts.ts';
import { Splash, SplashScreen, type NativeSplashScreen } from '../src/solid/splash-screen.ts';
import { Updates, type NativeUpdates } from '../src/solid/updates.ts';

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});
function owned<T>(create: (stop: () => void) => T) {
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
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const image = (uri: string): readonly AssetLike[] => [{ uri, width: 10, height: 20 }];

test('AppInfo captures optional app/device constants and all device kind mappings per scope', () => {
  const absent = service(AppInfo, { application: null, device: null });
  assert.deepEqual(absent.value, {
    version: null,
    build: null,
    id: null,
    name: null,
    device: { model: null, brand: null, os: null, osVersion: null, physical: null, type: null },
  });
  for (const [deviceType, type] of [
    [0, 'unknown'],
    [1, 'phone'],
    [2, 'tablet'],
    [3, 'desktop'],
    [4, 'tv'],
    [99, 'unknown'],
    [null, null],
  ] as const) {
    const value = service(AppInfo, {
      application: {
        nativeApplicationVersion: '1',
        nativeBuildVersion: '2',
        applicationId: 'app.id',
        applicationName: 'Canary',
      },
      device: {
        modelName: 'Pixel',
        brand: 'Google',
        osName: 'Android',
        osVersion: '17',
        isDevice: false,
        deviceType,
      },
    }).value;
    assert.equal(value.version, '1');
    assert.equal(value.build, '2');
    assert.equal(value.id, 'app.id');
    assert.equal(value.name, 'Canary');
    assert.deepEqual(value.device, {
      model: 'Pixel',
      brand: 'Google',
      os: 'Android',
      osVersion: '17',
      physical: false,
      type,
    });
  }
});

test('assets isolate call sites, reload retained values, and reject late replaced/disposed answers', async () => {
  const loads: ReturnType<typeof deferred<readonly AssetLike[]>>[] = [];
  const params: unknown[] = [];
  const [modules, setModules] = createSignal<readonly (number | string)[]>([1]);
  const owner = owned(() =>
    assetResource(
      {
        load: (next) => {
          params.push(next);
          const load = deferred<readonly AssetLike[]>();
          loads.push(load);
          return load.promise;
        },
      },
      modules,
    ),
  );
  const resource = owner.value;
  assert.equal(resource.status(), 'loading');
  assert.equal(resource.value(), undefined);
  assert.equal(resource.reload(), false);
  setModules(['second']);
  loads[1]!.resolve(image('second'));
  await settle();
  loads[0]!.resolve(image('stale'));
  await settle();
  assert.deepEqual(params, [[1], ['second']]);
  assert.deepEqual(resource.value(), image('second'));
  assert.equal(resource.hasValue(), true);
  assert.equal(resource.reload(), true);
  assert.equal(resource.status(), 'reloading');
  assert.deepEqual(resource.value(), image('second'));
  const failure = Error('download');
  loads[2]!.reject(failure);
  await settle();
  assert.equal(resource.error(), failure);
  assert.equal(resource.status(), 'error');
  assert.equal(resource.isLoading(), false);
  assert.equal(resource.reload(), true);
  resource.set(image('local'));
  loads[3]!.resolve(image('stale'));
  await settle();
  assert.equal(resource.status(), 'local');
  assert.deepEqual(resource.value(), image('local'));
  resource.update((value) => [...value!, ...image('more')]);
  assert.equal(resource.value()!.length, 2);
  assert.equal(resource.reload(), true);
  owner.stop();
  loads[4]!.reject(Error('late'));
  await settle();
  assert.equal(resource.status(), 'idle');
  assert.equal(resource.value(), undefined);
  assert.equal(resource.reload(), false);
});

test('assets preserve newer reentrant local writes and suppress acquisition after publication disposal', async () => {
  const resource = owned(() => assetResource(null, () => [])).value;
  await settle();
  resource.set(image('old'));
  resource.update(() => {
    resource.set(image('new'));
    return image('stale');
  });
  assert.deepEqual(resource.value(), image('new'));
  let calls = 0;
  const owner = owned((stop) => {
    const current = assetResource(
      {
        load: async () => {
          calls++;
          return [];
        },
      },
      () => [],
    );
    createComputed(() => {
      if (current.status() === 'reloading') stop();
    });
    return current;
  });
  await settle();
  assert.equal(owner.value.reload(), false);
  assert.equal(calls, 1);
  assert.throws(() => assetResource(null, () => []), /owner/);
});

test('Assets service disposal also destroys resources owned by another caller', async () => {
  const pending = deferred<readonly AssetLike[]>();
  const owner = service(Assets, { load: () => pending.promise });
  const caller = owned(() => owner.value.resource(() => [1]));
  owner.stop();
  pending.resolve(image('late'));
  await settle();
  assert.equal(caller.value.value(), undefined);
  assert.equal(caller.value.status(), 'idle');
  assert.throws(() => owned(() => owner.value.resource(() => [])), /disposed/);
  const fallback = owned(() => assetResource(null, () => [1]));
  await settle();
  assert.deepEqual(fallback.value.value(), []);
});

test('font registration preserves first family and weighted/styled aliases and pre-owner loading', async () => {
  const faces = [
    { family: 'Inter', source: 1, weight: 400 },
    { family: 'Inter', source: 2, weight: 700, style: 'italic' },
  ];
  assert.deepEqual(registrationsFor(faces), {
    Inter: 1,
    'Inter-400': 1,
    'Inter-700': 2,
    'Inter-italic': 2,
  });
  const loaded = new Map<string, unknown>();
  const registry = new FontRegistry({
    loadAsync: async (map) => {
      for (const [key, value] of Object.entries(map)) loaded.set(key, value);
    },
    isLoaded: (name) => loaded.has(name),
    getLoadedFonts: () => [...loaded.keys()],
  });
  assert.equal(registry.available, true);
  assert.equal(registry.has('Inter'), false);
  await registry.loadSheet(null, {}, { fonts: faces });
  assert.equal(registry.has('Inter'), true);
  assert.deepEqual(registry.families(), Object.keys(registrationsFor(faces)));
  const absent = new FontRegistry(null);
  await absent.load({ missing: 1 });
  assert.equal(absent.available, false);
  assert.deepEqual(absent.families(), []);
});

test('fonts react on successful registration, propagate load errors and cancel disposed caller answers', async () => {
  const native = deferred<void>();
  let reads = 0;
  let calls = 0;
  const owner = service(Fonts, {
    loadAsync: () => {
      calls++;
      return native.promise;
    },
    getLoadedFonts: () => {
      reads++;
      return ['Inter'];
    },
    isLoaded: () => true,
  });
  const watcher = owned(() => createComputed(() => owner.value.families()));
  const load = owner.value.load({ Inter: 1 });
  native.resolve();
  await load;
  assert.equal(reads, 2);
  watcher.stop();
  owner.stop();
  await owner.value.load({ Later: 2 });
  assert.equal(calls, 1);
  const failure = Error('bad font');
  const bad = new FontRegistry({
    loadAsync: async () => {
      throw failure;
    },
    getLoadedFonts: () => [],
    isLoaded: () => false,
  });
  await assert.rejects(bad.load({ broken: 1 }), (error) => error === failure);
  const late = deferred<void>();
  const live = service(Fonts, {
    loadAsync: () => late.promise,
    getLoadedFonts: () => [],
    isLoaded: () => false,
  });
  const caller = owned(() => live.value.load({ canceled: 1 }));
  caller.stop();
  await caller.value;
  late.reject(Error('ignored'));
  await settle();
});

function splashSource() {
  const calls: string[] = [];
  const native: NativeSplashScreen = {
    preventAutoHideAsync: async () => {
      calls.push('hold');
      return true;
    },
    hideAsync: async () => {
      calls.push('hide');
    },
  };
  return { native, calls };
}
test('splash preserves legacy startup hold/frame/hide ordering and work error identity', async () => {
  const { native, calls } = splashSource();
  let acquired = 0;
  const splash = new Splash(() => {
    acquired++;
    return native;
  });
  assert.equal(acquired, 0);
  splash.hold();
  splash.hold();
  assert.deepEqual(calls, ['hold']);
  assert.equal(acquired, 1);
  await splash.hideWhenReady(
    Promise.resolve().then(() => {
      calls.push('work');
    }),
    async () => {
      calls.push('frame');
    },
  );
  assert.deepEqual(calls, ['hold', 'work', 'frame', 'hide']);
  const failure = Error('fonts');
  await assert.rejects(
    splash.hideWhenReady(Promise.reject(failure), async () => {
      throw Error('frame');
    }),
    (error) => error === failure,
  );
  assert.equal(calls.at(-1), 'hide');
  const empty = new Splash(null);
  assert.equal(empty.available, false);
  empty.hold();
  await empty.hide();
});

test('splash contains sync/async native races but keeps source acquisition errors visible', async () => {
  for (const method of [
    () => {
      throw Error('native');
    },
    () => Promise.reject(Error('native')),
  ]) {
    const splash = new Splash({ preventAutoHideAsync: method, hideAsync: method });
    splash.hold();
    await splash.hide();
  }
  const failure = Error('missing module');
  const splash = new Splash(() => {
    throw failure;
  });
  assert.throws(
    () => splash.hold(),
    (error) => error === failure,
  );
  await assert.rejects(splash.hide(), (error) => error === failure);
});

test('new holds supersede splash readiness work and old hide completion cannot release newer hold', async () => {
  const { native, calls } = splashSource();
  const splash = new Splash(native);
  const frame = deferred<void>();
  splash.hold();
  const first = splash.hideWhenReady(Promise.resolve(), () => frame.promise);
  await settle();
  splash.hold();
  frame.resolve();
  await first;
  assert.deepEqual(calls, ['hold']);
  const hiding = deferred<void>();
  native.hideAsync = () => {
    calls.push('hide');
    return hiding.promise;
  };
  const previous = splash.hide();
  splash.hold();
  hiding.resolve();
  await previous;
  splash.hold();
  assert.deepEqual(calls, ['hold', 'hide', 'hold']);
});

test('splash source acquisition handles hold, hide and disposal reentry', async () => {
  const { native, calls } = splashSource();
  let splash!: Splash;
  splash = new Splash(() => {
    splash.hold();
    return native;
  });
  splash.hold();
  assert.deepEqual(calls, ['hold']);
  const disposed = new Splash(() => {
    disposed.dispose();
    return native;
  });
  disposed.hold();
  assert.deepEqual(calls, ['hold']);
  const owner = service(SplashScreen, native);
  const pending = deferred<void>();
  const wait = owner.value.hideWhenReady(pending.promise, async () => {
    calls.push('frame');
  });
  owner.stop();
  pending.resolve();
  await wait;
  assert.deepEqual(calls, ['hold']);
});

test('splash acquisition converges on reentrant intents even when started by availability', async () => {
  const { native, calls } = splashSource();
  let hold!: Splash;
  hold = new Splash(() => {
    hold.hold();
    return native;
  });
  assert.equal(hold.available, true);
  assert.deepEqual(calls, ['hold']);
  let hide!: Splash;
  hide = new Splash(() => {
    void hide.hide();
    return native;
  });
  hide.hold();
  await settle();
  assert.deepEqual(calls, ['hold', 'hide']);
});

function updateSource(): NativeUpdates {
  return {
    enabled: true,
    check: async () => ({ isAvailable: true }),
    fetch: async () => ({ isNew: true }),
    reload: async () => {},
  };
}
test('Updates preserve check/download/explicit apply/error/disabled semantics and deduplicate concurrent reload', async () => {
  const source = updateSource();
  let reloads = 0;
  const reloaded = deferred<void>();
  source.reload = () => {
    reloads++;
    return reloaded.promise;
  };
  const owner = service(Updates, source);
  await owner.value.apply();
  assert.equal(reloads, 0);
  assert.equal(await owner.value.check(), true);
  assert.equal(owner.value.ready(), true);
  const first = owner.value.apply();
  await owner.value.apply();
  assert.equal(reloads, 1);
  reloaded.resolve();
  await first;
  const failure = Error('offline');
  source.check = async () => {
    throw failure;
  };
  assert.equal(await owner.value.check(), false);
  assert.equal(owner.value.error(), failure);
  assert.equal(owner.value.state(), 'error');
  source.check = async () => ({ isAvailable: false });
  assert.equal(await owner.value.check(), false);
  assert.equal(owner.value.error(), null);
  assert.equal(owner.value.state(), 'idle');
  for (const native of [null, { ...source, enabled: false }]) {
    const disabled = service(Updates, native).value;
    assert.equal(disabled.enabled, false);
    assert.equal(await disabled.check(), false);
  }
});

test('Updates discard stale checks/downloads and suppress acquisition on disposal or reentrant publication', async () => {
  const first = deferred<{ isAvailable: boolean }>();
  const second = deferred<{ isAvailable: boolean }>();
  let checks = 0;
  let fetches = 0;
  const source = {
    ...updateSource(),
    check: () => (++checks === 1 ? first.promise : second.promise),
    fetch: async () => {
      fetches++;
      return { isNew: true };
    },
  };
  const owner = service(Updates, source);
  const old = owner.value.check();
  const next = owner.value.check();
  first.resolve({ isAvailable: true });
  assert.equal(await old, false);
  assert.equal(fetches, 0);
  second.resolve({ isAvailable: true });
  assert.equal(await next, true);
  assert.equal(fetches, 1);
  owner.stop();
  await owner.value.apply();
  assert.equal(await owner.value.check(), false);
  const newer = deferred<{ isNew: boolean }>();
  const pending = service(Updates, { ...updateSource(), fetch: () => newer.promise });
  const download = pending.value.check();
  await settle();
  pending.stop();
  assert.equal(await download, false);
  newer.resolve({ isNew: true });
  await settle();
  assert.equal(pending.value.ready(), false);
  let nativeChecks = 0;
  const reactive = owned((stop) =>
    withServiceScope(
      [
        provideService(Updates.SOURCE, () => ({
          ...updateSource(),
          check: async () => {
            nativeChecks++;
            return { isAvailable: true };
          },
        })),
      ],
      () => {
        const updates = useService(Updates);
        createComputed(() => {
          if (updates.state() === 'checking') stop();
        });
        return updates;
      },
    ),
  );
  assert.equal(await reactive.value.check(), false);
  assert.equal(nativeChecks, 0);
});

test('Updates ready publication can reenter a newer check without returning stale success', async () => {
  const source = updateSource();
  const owner = service(Updates, source);
  let restarted = false;
  let next!: Promise<boolean>;
  owned(() =>
    createComputed(() => {
      if (owner.value.ready() && !restarted) {
        restarted = true;
        source.check = async () => ({ isAvailable: false });
        next = untrack(() => owner.value.check());
      }
    }),
  );
  assert.equal(await owner.value.check(), false);
  assert.equal(await next, false);
  assert.equal(owner.value.state(), 'idle');
});
