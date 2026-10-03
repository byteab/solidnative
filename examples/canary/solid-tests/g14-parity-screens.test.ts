import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import {
  Dialogs,
  LayoutAnimation,
  Sharing,
  StatusBar,
  Vibration,
  provideService,
  type NativeDialogs,
  type ObservedSource,
  type ServiceBinding,
} from '@solidnative/device/solid';
import { Battery, type BatteryState } from '@solidnative/expo/solid/battery';
import { Brightness } from '@solidnative/expo/solid/brightness';
import { KeepAwake } from '@solidnative/expo/solid/keep-awake';
import { Locale } from '@solidnative/expo/solid/locale';
import { Network, type NetworkStatus } from '@solidnative/expo/solid/network';
import { DeviceOrientation, type Orientation } from '@solidnative/expo/solid/orientation';
import { Accelerometer, type VectorMeasurement } from '@solidnative/expo/solid/sensors';
import { SecureStorage, Storage } from '@solidnative/expo/solid/store';
import { verifyRoutes } from '../src/app/device/verify-routes.solid.ts';
import { stressRoutes } from '../src/app/stress/routes.solid.ts';
import { stressRows } from '../src/app/stress/stress-rows.solid.ts';
import { parityFixture } from './g14-parity-fixture.tsx';
import { bootConsumer, flatten } from './consumer-harness.ts';
import type { FakeNode } from '../../../packages/platform/solid-tests/fake-fabric.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function observed<T>(initial: T) {
  let listener: ((value: T) => void) | undefined;
  let released = 0;
  const source: ObservedSource<T> = {
    current: () => initial,
    subscribe: (next) => {
      listener = next;
      return () => {
        released++;
      };
    },
  };
  return { source, emit: (value: T) => listener?.(value), released: () => released };
}
function boot(platform: 'ios' | 'android', services: readonly ServiceBinding[] = []) {
  const fixture = parityFixture(
    () => [...verifyRoutes, ...stressRoutes, { path: 'cover', component: () => null }],
    services,
  );
  return { fixture, h: bootConsumer(fixture, platform), nav: fixture.navigation() };
}
const text = (node: FakeNode) =>
  flatten([node])
    .map((child) => child.props['text'] ?? '')
    .join('');
function press(h: ReturnType<typeof bootConsumer>, title: string) {
  const node = h
    .nodes()
    .find((node) => node.instanceHandle.name === 'pressable' && text(node) === title);
  assert.ok(node, title);
  for (const type of ['topTouchStart', 'topTouchEnd']) {
    const point = { identifier: 1, pageX: 1, pageY: 1 };
    h.fabric.emit(node, type, {
      ...point,
      changedTouches: [point],
      touches: type === 'topTouchEnd' ? [] : [point],
    });
  }
  h.clock.flushMicrotasks();
}
const classes = (h: ReturnType<typeof bootConsumer>, name: string) =>
  h.nodes().filter((node) => node.instanceHandle.classes?.has(name));
const settle = async (h: ReturnType<typeof bootConsumer>) => {
  for (let at = 0; at < 12; at++) await Promise.resolve();
  h.clock.flushMicrotasks();
};

function verifyServices(platform: 'ios' | 'android') {
  const level = observed(0.67),
    state = observed<BatteryState>('charging'),
    saving = observed(false);
  const network = observed<NetworkStatus>({ type: 'wifi', connected: true, reachable: null });
  const orientation = observed<Orientation>('landscape-left');
  const plain = new Map([['verify.note', '4']]),
    secure = new Map([['verify.secret', '8']]);
  const writes: string[] = [],
    sensorIntervals: number[] = [],
    bars: string[] = [],
    buzzes: unknown[] = [];
  const alerts: Parameters<NativeDialogs['alert']>[] = [];
  const prompts: ((value: string | null) => void)[] = [];
  const choices: {
    options: Parameters<NonNullable<NativeDialogs['actionSheet']>>[0];
    reply: (value: number) => void;
  }[] = [];
  const notices: string[] = [],
    shares: ReturnType<typeof deferred<{ action: string }>>[] = [];
  const shareRequests: object[] = [];
  let sensor: ((value: VectorMeasurement) => void) | undefined,
    removed = 0,
    failDialog = false,
    failLayout = false;
  const store = (data: Map<string, string>) => ({
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string) => {
      data.set(key, value);
      writes.push(key);
    },
    remove: async (key: string) => {
      data.delete(key);
    },
  });
  const services = [
    provideService(Battery.SOURCE, () => ({
      level: level.source,
      state: state.source,
      saving: saving.source,
    })),
    provideService(Network.SOURCE, () => network.source),
    provideService(Locale.SOURCE, () => ({
      locales: () => [
        {
          languageTag: 'ar-OM',
          languageCode: 'ar',
          regionCode: 'OM',
          textDirection: 'rtl' as const,
          measurementSystem: 'metric' as const,
        },
      ],
      calendars: () => [],
      onChange: () => () => {},
    })),
    provideService(DeviceOrientation.SOURCE, () => ({
      reported: orientation.source,
      lock: async () => {},
      unlock: async () => {},
    })),
    provideService(Brightness.SOURCE, () => ({
      get: async () => 0.42,
      set: async () => {},
      restore: async () => {},
    })),
    provideService(KeepAwake.SOURCE, () => null),
    provideService(Accelerometer.SOURCE, () => ({
      isAvailableAsync: async () => true,
      setUpdateInterval: (ms) => {
        sensorIntervals.push(ms);
      },
      addListener: (listener) => {
        sensor = listener;
        return {
          remove: () => {
            removed++;
          },
        };
      },
    })),
    provideService(Storage.SOURCE, () => store(plain)),
    provideService(SecureStorage.SOURCE, () => store(secure)),
    provideService(Dialogs.SOURCE, () => ({
      platform,
      alert: (...args) => {
        if (failDialog) throw new Error('dialog unavailable');
        alerts.push(args);
      },
      ...(platform === 'ios'
        ? {
            prompt: (
              _title: string,
              _message: string | undefined,
              reply: (value: string | null) => void,
            ) => {
              prompts.push(reply);
            },
            actionSheet: (
              options: Parameters<NonNullable<NativeDialogs['actionSheet']>>[0],
              reply: (value: number) => void,
            ) => {
              choices.push({ options, reply });
            },
          }
        : {}),
      toast: (message) => {
        notices.push(message);
      },
    })),
    provideService(Sharing.SOURCE, () => ({
      share: (request) => {
        shareRequests.push(request);
        const next = deferred<{ action: string }>();
        shares.push(next);
        return next.promise;
      },
    })),
    provideService(Vibration.SOURCE, () => ({
      vibrate: (value) => {
        buzzes.push(value);
      },
      cancel() {},
    })),
    provideService(StatusBar.SOURCE, () => ({
      height: 0,
      setStyle: (style) => {
        bars.push(style);
      },
      setHidden() {},
      setBackgroundColor() {},
      setTranslucent() {},
    })),
    provideService(LayoutAnimation.SOURCE, () => ({
      configureNext: (_config, done, fail) => {
        if (failLayout) fail?.();
        else done?.();
      },
    })),
  ];
  return {
    services,
    level,
    state,
    saving,
    network,
    orientation,
    plain,
    secure,
    writes,
    sensorIntervals,
    bars,
    buzzes,
    alerts,
    prompts,
    choices,
    notices,
    shares,
    shareRequests,
    sensor: () => sensor,
    removed: () => removed,
    failDialog: () => {
      failDialog = true;
    },
    failLayout: () => {
      failLayout = true;
    },
  };
}

function sampling(t: TestContext) {
  const timers = new Map<number, () => void>(),
    frames = new Map<number, FrameRequestCallback>();
  let serial = 1000,
    now = 0;
  t.mock.method(globalThis, 'setInterval', ((callback: () => void, ms: number) => {
    assert.equal(ms, 100);
    const id = ++serial;
    timers.set(id, callback);
    return id;
  }) as unknown as typeof setInterval);
  t.mock.method(globalThis, 'clearInterval', ((id: number) => {
    timers.delete(id);
  }) as unknown as typeof clearInterval);
  const beforeRAF = globalThis.requestAnimationFrame,
    beforeCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    const id = ++serial;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    if (id != null) frames.delete(id);
  };
  t.after(() => {
    globalThis.requestAnimationFrame = beforeRAF;
    globalThis.cancelAnimationFrame = beforeCancel;
  });
  t.mock.method(performance, 'now', () => now);
  return {
    timers,
    frames,
    time: (value: number) => {
      now = value;
    },
    tick: () => {
      const [id, callback] = frames.entries().next().value!;
      frames.delete(id);
      callback(now);
    },
  };
}

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} Verify exposes device values, storage, structural CSS and every action`, async (t) => {
    const v = verifyServices(platform),
      { fixture, h, nav } = boot(platform, v.services);
    t.after(() => h.root.dispose());
    assert.equal(await nav.reset('/verify'), true);
    h.finish();
    await settle(h);
    for (const value of [
      '67%  charging',
      'wifi  connected true',
      'ar-OM  rtl true',
      'landscape-left  landscape true',
      '0.42',
      'plain: 4 / keychain: 8',
    ])
      assert.ok(h.renderedText().includes(value), value);
    v.level.emit(0.1);
    v.state.emit('unplugged');
    v.saving.emit(true);
    v.network.emit({ type: 'none', connected: false, reachable: false });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /10%  unpluggedbattery low \/ savingtrue \/ true/);
    press(h, 'Start reading');
    assert.deepEqual(v.sensorIntervals, [200]);
    v.sensor()!({ x: 1.125, y: -2, z: 0.5, timestamp: 1 });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /x 1.13  y -2.00  z 0.50/);
    press(h, 'Stop reading');
    assert.equal(v.removed(), 1);
    press(h, 'Write to both');
    await settle(h);
    assert.equal(v.plain.get('verify.note'), '5');
    assert.equal(v.secure.get('verify.secret'), '9');
    assert.equal(classes(h, 'verify-row').length, 3);
    const firstTag = classes(h, 'verify-row')[0]!.tag;
    press(h, 'Add row');
    await settle(h);
    assert.equal(classes(h, 'verify-row').length, 4);
    assert.equal(classes(h, 'verify-row')[0]!.tag, firstTag);
    assert.equal(classes(h, 'verify-row')[0]!.props['borderTopLeftRadius'], 10);
    assert.equal(classes(h, 'verify-row')[3]!.props['borderBottomLeftRadius'], 10);
    press(h, 'Remove');
    await settle(h);
    assert.equal(classes(h, 'verify-row').length, 3);
    press(h, 'Confirm');
    assert.equal(v.alerts.at(-1)![2][1]!.style, 'destructive');
    v.alerts.at(-1)![2][1]!.onPress!();
    await settle(h);
    assert.match(h.renderedText(), /Confirmed\./);
    press(h, 'Prompt');
    if (platform === 'ios') v.prompts.at(-1)!('Morgan');
    await settle(h);
    assert.ok(
      h
        .renderedText()
        .includes(platform === 'ios' ? 'Typed: Morgan' : 'No prompt on this platform.'),
    );
    press(h, 'Choose');
    if (platform === 'ios') {
      assert.equal(v.choices.at(-1)!.options.destructiveButtonIndex, 2);
      v.choices.at(-1)!.reply(1);
    } else v.alerts.at(-1)![2][1]!.onPress!();
    await settle(h);
    assert.match(h.renderedText(), /Chose: Library/);
    press(h, 'Notify');
    assert.deepEqual(v.notices, ['Copied to the clipboard']);
    press(h, 'Share');
    assert.deepEqual(v.shareRequests, [{ message: 'solidnative', url: 'https://expo.dev' }]);
    v.shares[0]!.resolve({ action: 'sharedAction' });
    await settle(h);
    assert.match(h.renderedText(), /Something took it\./);
    press(h, 'Vibrate');
    assert.deepEqual(v.buzzes, [300]);
    press(h, 'Toggle the status bar style');
    assert.equal(v.bars.at(-1), 'dark');
    press(h, 'Toggle the status bar style');
    assert.equal(v.bars.at(-1), 'light');
    assert.deepEqual(fixture.errors, []);
    h.root.dispose();
    assert.equal(v.level.released(), 1);
    assert.equal(v.network.released(), 1);
  });

  test(`actual ${platform} Verify rejects stale answers after cover/return and releases native claims`, async (t) => {
    const v = verifyServices(platform),
      { fixture, h, nav } = boot(platform, v.services);
    t.after(() => h.root.dispose());
    await nav.reset('/verify');
    h.finish();
    await settle(h);
    press(h, 'Confirm');
    const older = v.alerts.at(-1)![2][1]!.onPress!;
    press(h, 'Confirm');
    v.alerts.at(-1)![2][0]!.onPress!();
    await settle(h);
    older();
    await settle(h);
    assert.match(h.renderedText(), /Cancelled\./);
    press(h, 'Confirm');
    const covered = v.alerts.at(-1)![2][1]!.onPress!;
    press(h, 'Share');
    press(h, 'Start reading');
    const staleSensor = v.sensor()!;
    press(h, 'Toggle the status bar style');
    await nav.push('/cover');
    h.finish();
    assert.equal(v.removed(), 1);
    await nav.back();
    h.finish();
    covered();
    v.shares[0]!.resolve({ action: 'sharedAction' });
    staleSensor({ x: 99, y: 0, z: 0, timestamp: 0 });
    await settle(h);
    assert.match(h.renderedText(), /Cancelled\./);
    assert.doesNotMatch(h.renderedText(), /Something took it|x 99/);
    assert.match(h.renderedText(), /Start reading/);
    assert.equal(v.sensorIntervals.length, 1);
    press(h, 'Share');
    v.shares[1]!.reject(new Error('share failed'));
    await settle(h);
    assert.match(h.renderedText(), /Dismissed, or nothing took it\./);
    v.failDialog();
    press(h, 'Confirm');
    await settle(h);
    assert.match(h.renderedText(), /Error: dialog unavailable/);
    v.failLayout();
    press(h, 'Add row');
    await settle(h);
    assert.equal(classes(h, 'verify-row').length, 4);
    assert.match(h.renderedText(), /Error: Native layout animation failed\./);
    press(h, 'Start reading');
    press(h, 'Share');
    h.root.dispose();
    assert.equal(v.removed(), 2);
    v.shares[2]!.resolve({ action: 'sharedAction' });
    await settle(h);
    assert.equal(h.nodes().length, 0);
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} stress filters 10000 rows, retains row identity and reprices 20 values at 100ms`, async (t) => {
    const sample = sampling(t),
      { fixture, h, nav } = boot(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/stress');
    h.finish();
    assert.match(h.renderedText(), /10000 rows, first render/);
    assert.ok(classes(h, 'row').length > 0 && classes(h, 'row').length < 10000);
    h.input('Filter', '  BRAVO BRAVO  ', 1);
    const expected = stressRows().filter((row) => row.name.includes('bravo bravo'));
    assert.equal(expected.length, 0);
    assert.equal(classes(h, 'row').length, 0);
    h.input('Filter', '  ALPHA ALPHA 0  ', 2);
    assert.equal(classes(h, 'row').length, 1);
    assert.equal(classes(h, 'row')[0]!.props['nativeID'], 'row-s0');
    const rowTag = classes(h, 'row')[0]!.tag;
    let random = 0;
    t.mock.method(Math, 'random', () => (++random % 2 ? 0 : 0.5));
    press(h, 'Live prices');
    assert.equal(sample.timers.size, 1);
    [...sample.timers.values()][0]!();
    h.clock.flushMicrotasks();
    assert.equal(random, 40);
    assert.equal(classes(h, 'row')[0]!.tag, rowTag);
    assert.equal(text(classes(h, 'price')[0]!), '150.00');
    press(h, 'Stop prices');
    assert.equal(sample.timers.size, 0);
    h.input('Filter', '9999', 3);
    assert.equal(classes(h, 'row')[0]!.props['nativeID'], 'row-s9999');
    h.input('Filter', '', 4);
    assert.ok(classes(h, 'row').length > 1);
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} stress measures native commits and cancels ticker/frame callbacks on cover and disposal`, async (t) => {
    const sample = sampling(t),
      { fixture, h, nav } = boot(platform);
    const output: string[] = [];
    t.mock.method(console, 'error', (value: unknown) => {
      output.push(String(value));
    });
    t.after(() => h.root.dispose());
    await nav.reset('/stress');
    h.finish();
    h.input('Filter', 'alpha alpha 0');
    press(h, 'Live prices');
    const oldTicker = [...sample.timers.values()][0]!;
    press(h, 'Measure');
    const oldFrame = [...sample.frames.values()][0]!;
    sample.time(10);
    sample.tick();
    sample.time(40);
    sample.tick();
    press(h, 'Stop');
    assert.match(h.renderedText(), /2 JS frames, 1 late, worst gap 30ms/);
    assert.match(h.renderedText(), /commits, .* created, .* cloned/);
    assert.equal(sample.frames.size, 0);
    press(h, 'Measure');
    await nav.push('/cover');
    h.finish();
    assert.equal(sample.timers.size, 0);
    assert.equal(sample.frames.size, 0);
    await nav.back();
    h.finish();
    const previous = text(classes(h, 'price')[0]!);
    oldTicker();
    oldFrame(50);
    h.clock.flushMicrotasks();
    assert.equal(text(classes(h, 'price')[0]!), previous);
    assert.equal(sample.frames.size, 0);
    press(h, 'Live prices');
    press(h, 'Measure');
    const disposedTicker = [...sample.timers.values()][0]!,
      disposedFrame = [...sample.frames.values()][0]!;
    h.root.dispose();
    assert.equal(sample.timers.size, 0);
    assert.equal(sample.frames.size, 0);
    disposedTicker();
    disposedFrame(100);
    h.clock.flushMicrotasks();
    assert.equal(h.nodes().length, 0);
    assert.ok(output.every((line) => line.startsWith('[stress] ')));
    assert.deepEqual(fixture.errors, []);
  });
}
