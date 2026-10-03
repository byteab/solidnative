import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, runWithOwner, getOwner, onCleanup, type Owner } from 'solid-js';
import {
  Accessibility,
  accessibilitySource,
  BackHandler,
  DeepLinks,
  deepLinkSource,
  HardwareBack,
  hardwareBackSource,
  Keyboard,
  keyboardSource,
  Linking,
  pathOf,
  provideService,
  SafeArea,
  Screen,
  screenSource,
  useService,
  withServiceScope,
  type AccessibilitySettings,
  type DeepLinkSource,
  type HardwareBackSource,
  type KeyboardMetrics,
} from '@solidnative/device/solid';
import type { NativeKeyboardEvent } from '../src/react-native.ts';

function scope<T>(render: () => T) {
  let dispose!: () => void;
  const value = createRoot((cleanup) => {
    dispose = cleanup;
    return render();
  });
  return { value, dispose };
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

test('keyboard is lazy, shares app ownership, accepts synchronous events and stops stale calls', () => {
  let creates = 0;
  let removes = 0;
  let dismisses = 0;
  let emit!: (metrics: KeyboardMetrics) => void;
  const root = scope(() =>
    withServiceScope(
      [
        provideService(Keyboard.SOURCE, () => {
          creates++;
          return {
            subscribe(listener) {
              emit = listener;
              listener({ height: 240 });
              return () => {
                removes++;
              };
            },
            dismiss: () => {
              dismisses++;
            },
          };
        }),
      ],
      () => {
        assert.equal(creates, 0);
        const keyboard = useService(Keyboard);
        withServiceScope([], () => assert.equal(useService(Keyboard), keyboard));
        return keyboard;
      },
    ),
  );
  assert.equal(creates, 1);
  assert.equal(root.value.height(), 240);
  assert.equal(root.value.visible(), true);
  emit({ height: 0, duration: 160, easing: 'keyboard' });
  assert.equal(root.value.visible(), false);
  assert.equal(root.value.metrics().duration, 160);
  root.value.dismiss();
  root.dispose();
  root.dispose();
  root.value.dismiss();
  emit({ height: 999 });
  assert.equal(root.value.height(), 0);
  assert.equal(dismisses, 1);
  assert.equal(removes, 1);
});

test('native keyboard mapping follows iOS Will frames and Android Did events', () => {
  for (const platform of ['ios', 'android']) {
    const listeners = new Map<string, (event: NativeKeyboardEvent) => void>();
    let removes = 0;
    let dismisses = 0;
    const source = keyboardSource({
      Platform: { OS: platform },
      Keyboard: {
        addListener(name, callback) {
          listeners.set(name, callback);
          return { remove: () => void removes++ };
        },
        dismiss: () => void dismisses++,
      },
    });
    const values: KeyboardMetrics[] = [];
    const stop = source.subscribe((metrics) => values.push(metrics));
    const event = {
      endCoordinates: { height: 300, screenY: 500 },
      duration: 200,
      easing: 'keyboard',
    };
    if (platform === 'ios') {
      listeners.get('keyboardWillChangeFrame')!(event);
      assert.equal(values.length, 0);
      listeners.get('keyboardWillShow')!(event);
      listeners.get('keyboardWillChangeFrame')!({
        ...event,
        endCoordinates: { height: 320, screenY: 480 },
      });
      listeners.get('keyboardWillHide')!(event);
      listeners.get('keyboardWillChangeFrame')!(event);
      assert.deepEqual(
        values.map((value) => value.height),
        [300, 320, 0],
      );
      assert.deepEqual(values.at(-1), { height: 0, duration: 200, easing: 'keyboard' });
    } else {
      listeners.get('keyboardDidShow')!({ endCoordinates: event.endCoordinates });
      listeners.get('keyboardDidHide')!(event);
      assert.deepEqual(values, [{ height: 300, screenY: 500 }, { height: 0 }]);
    }
    source.dismiss();
    stop();
    assert.equal(removes, listeners.size);
    assert.equal(dismisses, 1);
  }
  keyboardSource(null).subscribe(() => {})();
  keyboardSource(null).dismiss();
});

function linkSource(launch: Promise<string | null>) {
  let emit!: (url: string) => void;
  let removes = 0;
  const opened: string[] = [];
  const source: DeepLinkSource = {
    launchUrl: () => launch,
    subscribe(listener) {
      emit = listener;
      return () => void removes++;
    },
    open: (url) => void opened.push(url),
  };
  return { source, emit: (url: string) => emit(url), opened, removes: () => removes };
}

test('pathOf preserves custom, web and Expo paths while excluding launcher instructions', () => {
  const cases: [string | null, string | null][] = [
    [null, null],
    ['', null],
    ['canary://projects/3?tab=mine#task', '/projects/3?tab=mine#task'],
    ['https://example.com/projects/3', '/projects/3'],
    ['HTTPS://example.com', '/'],
    ['https://example.com?q=1', '/?q=1'],
    ['https://example.com#tab', '/#tab'],
    ['exp://127.0.0.1:8081/--/projects/3', '/projects/3'],
    ['canary://expo-development-client/?url=encoded', null],
    ['/projects/3', '/projects/3'],
  ];
  for (const [url, path] of cases) assert.equal(pathOf(url), path);
});

test('deep links subscribe before startup, preserve early paths and reject stale launch/disposed work', async () => {
  const launch = deferred<string | null>();
  const feed = linkSource(launch.promise);
  const root = scope(() =>
    withServiceScope([provideService(DeepLinks.SOURCE, () => feed.source)], () =>
      useService(DeepLinks),
    ),
  );
  assert.equal(Linking, DeepLinks);
  feed.emit('canary://projects/7');
  assert.equal(root.value.initialUrl(), '/projects/7');
  const heard: string[] = [];
  const stop = root.value.subscribe((path) => heard.push(path));
  launch.resolve('canary://stale');
  await root.value.ready;
  assert.deepEqual(heard, []);
  feed.emit('canary://projects/8');
  assert.deepEqual(heard, ['/projects/8']);
  stop();
  stop();
  root.value.open('https://example.com');
  root.dispose();
  root.value.open('https://ignored.example.com');
  root.value.subscribe(() => assert.fail('disposed subscription'))();
  feed.emit('canary://ignored');
  assert.equal(feed.removes(), 1);
  assert.deepEqual(feed.opened, ['https://example.com']);
});

test('late launch paths are delivered once, listeners own independent lifetime and failed listeners are contained', async () => {
  const launch = deferred<string | null>();
  const feed = linkSource(launch.promise);
  let owner: Owner | null = null;
  const root = scope(() =>
    withServiceScope([provideService(DeepLinks.SOURCE, () => feed.source)], () => {
      owner = getOwner();
      return useService(DeepLinks);
    }),
  );
  const heard: string[] = [];
  const screen = runWithOwner(owner, () =>
    scope(() => {
      root.value.subscribe((path) => heard.push(`screen:${path}`));
    }),
  )!;
  const previous = console.error;
  console.error = () => {};
  try {
    root.value.subscribe(() => {
      throw new Error('consumer');
    });
    root.value.subscribe((path) => heard.push(`app:${path}`));
    launch.resolve('canary://projects/2');
    await root.value.ready;
    assert.deepEqual(heard, ['screen:/projects/2', 'app:/projects/2']);
    screen.dispose();
    feed.emit('canary://projects/3');
    assert.deepEqual(heard.slice(2), ['app:/projects/3']);
  } finally {
    console.error = previous;
    root.dispose();
  }
});

test('startup URL rejection, synchronous read failure and disposal are safe', async () => {
  for (const launchUrl of [
    () => Promise.reject(new Error('native read')),
    () => {
      throw new Error('native read');
    },
    () => Promise.resolve('canary://later'),
  ]) {
    const root = scope(() =>
      withServiceScope(
        [
          provideService(DeepLinks.SOURCE, () => ({
            launchUrl,
            subscribe: () => () => {},
            open: () => {},
          })),
        ],
        () => useService(DeepLinks),
      ),
    );
    root.dispose();
    await root.value.ready;
    assert.equal(root.value.initialUrl(), null);
  }
});

test('hardware back callbacks retain native priority and clean up at both screen and app boundaries', () => {
  const handlers: (() => boolean)[] = [];
  let removes = 0;
  let owner: Owner | null = null;
  const source: HardwareBackSource = {
    subscribe(handler) {
      handlers.push(handler);
      return () => {
        handlers.splice(handlers.indexOf(handler), 1);
        removes++;
      };
    },
  };
  const root = scope(() =>
    withServiceScope([provideService(HardwareBack.SOURCE, () => source)], () => {
      owner = getOwner();
      return useService(HardwareBack);
    }),
  );
  assert.equal(BackHandler, HardwareBack);
  const order: string[] = [];
  const old = root.value.handle(() => {
    order.push('app');
    return false;
  });
  const screen = runWithOwner(owner, () =>
    scope(() => {
      root.value.handle(() => {
        order.push('screen');
        return true;
      });
    }),
  )!;
  assert.equal(
    [...handlers].reverse().some((handler) => handler()),
    true,
  );
  assert.deepEqual(order, ['screen']);
  screen.dispose();
  assert.equal(handlers[0](), false);
  const stale = handlers[0];
  root.dispose();
  old();
  assert.equal(stale(), false);
  assert.equal(removes, 2);
  root.value.handle(() => true)();
  assert.equal(handlers.length, 0);
});

test('back registration failure can be retried and native wrapper returns the original decision', () => {
  let handler!: () => boolean;
  let removed = 0;
  const source = hardwareBackSource({
    BackHandler: {
      addEventListener(event, callback) {
        assert.equal(event, 'hardwareBackPress');
        handler = callback;
        return { remove: () => void removed++ };
      },
    },
  });
  const stop = source.subscribe(() => true);
  assert.equal(handler(), true);
  stop();
  assert.equal(removed, 1);
  hardwareBackSource(null).subscribe(() => true)();
  let fails = true;
  const root = scope(() =>
    withServiceScope(
      [
        provideService(HardwareBack.SOURCE, () => ({
          subscribe: () => {
            if (fails) throw new Error('subscribe');
            return () => {};
          },
        })),
      ],
      () => useService(HardwareBack),
    ),
  );
  assert.throws(() => root.value.handle(() => true), /subscribe/);
  fails = false;
  root.value.handle(() => true)();
  root.dispose();
});

test('throwing back unsubscription cannot abort cleanup of a screen owner', () => {
  let siblingCleaned = false;
  let removals = 0;
  let back!: HardwareBack;
  const root = scope(() =>
    withServiceScope(
      [
        provideService(HardwareBack.SOURCE, () => ({
          subscribe: () => () => {
            removals++;
            throw new Error('native unsubscribe');
          },
        })),
      ],
      () => {
        back = useService(HardwareBack);
      },
    ),
  );
  const screen = scope(() => {
    onCleanup(() => {
      siblingCleaned = true;
    });
    back.handle(() => true);
  });
  const previous = console.error;
  console.error = () => {
    throw new Error('reporter');
  };
  try {
    assert.doesNotThrow(screen.dispose);
    assert.equal(siblingCleaned, true);
    root.dispose();
    assert.equal(removals, 1);
  } finally {
    console.error = previous;
  }
});

test('accessibility merges late snapshot only into fields without newer events and guards announcements', async () => {
  const first = deferred<AccessibilitySettings>();
  let emit!: (settings: Partial<AccessibilitySettings>) => void;
  let removes = 0;
  const announcements: string[] = [];
  const root = scope(() =>
    withServiceScope(
      [
        provideService(Accessibility.SOURCE, () => ({
          current: () => first.promise,
          subscribe(listener) {
            emit = listener;
            return () => void removes++;
          },
          announce: (message) => void announcements.push(message),
        })),
      ],
      () => useService(Accessibility),
    ),
  );
  emit({ reduceMotion: true, fontScale: 2 });
  first.resolve({ screenReader: true, reduceMotion: false, boldText: true, fontScale: 1 });
  await first.promise;
  assert.deepEqual(
    [
      root.value.screenReader(),
      root.value.reduceMotion(),
      root.value.boldText(),
      root.value.fontScale(),
    ],
    [true, true, true, 2],
  );
  root.value.announce('Saved');
  root.dispose();
  emit({ fontScale: 9 });
  root.value.announce('Ignored');
  assert.equal(root.value.fontScale(), 2);
  assert.deepEqual(announcements, ['Saved']);
  assert.equal(removes, 1);
});

test('screen follows measured safe-area frame, display rotation, and source cleanup', () => {
  let emit!: (sizes: {
    window: { width: number; height: number };
    screen: { width: number; height: number };
  }) => void;
  let removes = 0;
  const root = scope(() =>
    withServiceScope(
      [
        provideService(Screen.SOURCE, () => ({
          current: () => ({
            window: { width: 400, height: 700 },
            screen: { width: 400, height: 800 },
          }),
          subscribe(listener) {
            emit = listener;
            return () => void removes++;
          },
        })),
        provideService(SafeArea.SOURCE, () => ({ current: () => null, subscribe: () => () => {} })),
      ],
      () => ({ screen: useService(Screen), safe: useService(SafeArea) }),
    ),
  );
  assert.deepEqual(root.value.screen.window(), { width: 400, height: 700 });
  root.value.safe.report(
    { top: 30, left: 0, bottom: 20, right: 0 },
    { x: 0, y: 0, width: 900, height: 600 },
  );
  emit({ window: { width: 800, height: 500 }, screen: { width: 900, height: 600 } });
  assert.deepEqual(root.value.screen.window(), { width: 900, height: 600 });
  assert.deepEqual(root.value.screen.display(), { width: 900, height: 600 });
  assert.equal(root.value.screen.orientation(), 'landscape');
  assert.equal(root.value.screen.compact(), false);
  root.dispose();
  assert.equal(removes, 1);
  const inert = screenSource(null);
  assert.deepEqual(inert.current(), {
    window: { width: 0, height: 0 },
    screen: { width: 0, height: 0 },
  });
  inert.subscribe(() => {})();
});

test('native accessibility source reads settings, listens for all updates and announces directly', async () => {
  const events = new Map<string, (value: boolean) => void>();
  let appState!: (state: string) => void;
  let scale = 1;
  let removes = 0;
  let announcement = '';
  const source = accessibilitySource({
    AccessibilityInfo: {
      isScreenReaderEnabled: async () => true,
      isReduceMotionEnabled: async () => false,
      isBoldTextEnabled: async () => true,
      announceForAccessibility: (message) => {
        announcement = message;
      },
      addEventListener(event, handler) {
        events.set(event, handler);
        return { remove: () => void removes++ };
      },
    },
    AppState: {
      currentState: 'active',
      addEventListener(_event, handler) {
        appState = handler;
        return { remove: () => void removes++ };
      },
    },
    PixelRatio: { get: () => 2, getFontScale: () => scale },
  });
  assert.deepEqual(await source.current(), {
    screenReader: true,
    reduceMotion: false,
    boldText: true,
    fontScale: 1,
  });
  const updates: Partial<AccessibilitySettings>[] = [];
  const stop = source.subscribe((settings) => updates.push(settings));
  events.get('screenReaderChanged')!(false);
  events.get('reduceMotionChanged')!(true);
  events.get('boldTextChanged')!(false);
  scale = 2;
  appState('inactive');
  appState('active');
  assert.deepEqual(updates, [
    { screenReader: false },
    { reduceMotion: true },
    { boldText: false },
    { fontScale: 2 },
  ]);
  source.announce('Finished');
  assert.equal(announcement, 'Finished');
  stop();
  assert.equal(removes, 4);
  const inert = accessibilitySource(null);
  assert.equal((await inert.current()).fontScale, 1);
  inert.subscribe(() => {})();
  inert.announce('Ignored');
});

test('grouped native listener setup rolls back and cleanup releases siblings after one throws', () => {
  for (const api of ['accessibility', 'keyboard']) {
    let creates = 0;
    let failSetup = true;
    let removes = 0;
    const register = () => {
      if (++creates === 2 && failSetup) throw new Error('setup failure');
      return {
        remove() {
          removes++;
          if (removes === 1) throw new Error('cleanup failure');
        },
      };
    };
    const source =
      api === 'keyboard'
        ? keyboardSource({
            Platform: { OS: 'ios' },
            Keyboard: { addListener: register, dismiss: () => {} },
          })
        : accessibilitySource({
            AccessibilityInfo: {
              isScreenReaderEnabled: async () => false,
              isReduceMotionEnabled: async () => false,
              isBoldTextEnabled: async () => false,
              announceForAccessibility: () => {},
              addEventListener: register,
            },
            AppState: { currentState: 'active', addEventListener: register },
            PixelRatio: { get: () => 2, getFontScale: () => 1 },
          });
    assert.throws(() => source.subscribe(() => {}), /setup failure/);
    assert.equal(removes, 1, 'failed setup releases the first listener even if removal throws');
    creates = 0;
    removes = 0;
    failSetup = false;
    const stop = source.subscribe(() => {});
    assert.throws(stop, /Native listener cleanup failed/);
    assert.equal(removes, api === 'keyboard' ? 3 : 4);
    stop();
    assert.equal(removes, creates, 'cleanup remains idempotent after an error');
  }
});

test('link native factory isolates promise failures and maps only direct native methods', async () => {
  let callback!: (event: { url: string }) => void;
  let removes = 0;
  const opened: string[] = [];
  const source = deepLinkSource({
    Linking: {
      getInitialURL: async () => 'canary://projects',
      addEventListener(event, listener) {
        assert.equal(event, 'url');
        callback = listener;
        return { remove: () => void removes++ };
      },
      openURL: (url) => {
        opened.push(url);
        return Promise.reject(new Error('unsupported'));
      },
    },
  });
  assert.equal(await source.launchUrl(), 'canary://projects');
  const values: string[] = [];
  const stop = source.subscribe((url) => values.push(url));
  callback({ url: 'canary://projects/2' });
  source.open('https://example.com');
  await Promise.resolve();
  assert.deepEqual(values, ['canary://projects/2']);
  assert.deepEqual(opened, ['https://example.com']);
  stop();
  assert.equal(removes, 1);
  const inert = deepLinkSource(null);
  assert.equal(await inert.launchUrl(), null);
  inert.subscribe(() => {})();
  inert.open('ignored');
});
