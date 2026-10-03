/**
 * The platform capabilities, driven through their source tokens.
 *
 * Every service reads its platform through a token whose default reaches React Native, so a test
 * overrides the token and gets the real service over a fake device. Nothing here needs a screen,
 * and nothing here would work off one either: `reactNative()` returns null in Node, which is what
 * makes every capability inert rather than broken.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRoot } from 'solid-js';
import {
  COMPACT_WIDTH,
  Accessibility,
  AppState,
  ColorScheme,
  DeepLinks,
  Direction,
  HardwareBack,
  Keyboard,
  SafeArea,
  Screen,
  currentConditions,
  deviceTokens,
  appStateSource,
  colorSchemeSource,
  directionSource,
  keyboardSource,
  pathOf,
  provideService,
  reactNative,
  screenSource,
  useService,
  watchConditions,
  withServiceScope,
  type ServiceToken,
} from '@solid-native/device';

/** A service over a fake device: each source token overridden in a service scope of its own. */
function build<T>(
  service: ServiceToken<T>,
  providers: { provide: ServiceToken<unknown>; useValue: unknown }[],
): T {
  return createRoot(() =>
    withServiceScope(
      providers.map(({ provide, useValue }) => provideService(provide, () => useValue as never)),
      () => useService(service),
    ),
  );
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('off a device', () => {
  it('has no react native to reach, so every source is inert rather than broken', () => {
    assert.equal(reactNative(), null, 'Node has no CommonJS require in an ES module');

    const keyboard = keyboardSource();
    assert.doesNotThrow(() => keyboard.dismiss());
    assert.doesNotThrow(() => keyboard.subscribe(() => {})());
    assert.equal(colorSchemeSource().current(), 'light');
    assert.equal(directionSource().current(), 'ltr');
    assert.equal(appStateSource().current(), 'active');
    assert.equal(screenSource().current().window.width, 0);
  });
});

describe('the keyboard', () => {
  it('reports what the platform said, as signals', () => {
    let emit: (metrics: { height: number; screenY?: number }) => void = () => {};
    const keyboard = build(Keyboard, [
      {
        provide: Keyboard.SOURCE,
        useValue: { subscribe: (fn: typeof emit) => ((emit = fn), () => {}), dismiss: () => {} },
      },
    ]);

    assert.equal(keyboard.visible(), false);
    emit({ height: 300, screenY: 500 });
    assert.equal(keyboard.height(), 300);
    assert.equal(keyboard.visible(), true);
    assert.equal(keyboard.metrics().screenY, 500, 'the geometry a layout needs, not just a flag');

    emit({ height: 0 });
    assert.equal(keyboard.visible(), false);
  });
});

describe('the back button', () => {
  it('passes the handler through, and its unsubscribe back', () => {
    let handler: (() => boolean) | null = null;
    const back = build(HardwareBack, [
      {
        provide: HardwareBack.SOURCE,
        useValue: {
          subscribe: (fn: () => boolean) => ((handler = fn), () => (handler = null)),
        },
      },
    ]);

    const stop = back.handle(() => true);
    assert.equal(handler!(), true, 'the platform asks, and this answers');
    stop();
    assert.equal(handler, null, 'and lets go');
  });
});

describe('deep links', () => {
  it("ignores the development client's own launch url", () => {
    // `expo run:ios` launches through this, and it is an instruction to Expo's launcher rather
    // than a path. Routed, it matches nothing and the app is blank on every dev launch - which
    // is exactly what it looked like the first time the canary ran on a simulator.
    assert.equal(
      pathOf('dev.solidnative.canary://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'),
      null,
    );
    assert.equal(pathOf('canary://expo-development-client'), null);
    assert.equal(pathOf('canary://expo-development-client/?url=x'), null);
  });

  it('still routes a path that merely starts with something similar', () => {
    assert.equal(pathOf('canary://expo-development-clientele'), '/expo-development-clientele');
    assert.equal(
      pathOf('canary://settings/expo-development-client'),
      '/settings/expo-development-client',
    );
  });

  const source = (launch: string | null) => {
    let listener: ((url: string) => void) | null = null;
    return {
      deliver: (url: string) => listener?.(url),
      value: {
        launchUrl: () => Promise.resolve(launch),
        subscribe: (fn: (url: string) => void) => ((listener = fn), () => (listener = null)),
        open: () => {},
      },
    };
  };

  it('reduces a url to the path the router can navigate to', () => {
    assert.equal(pathOf('canary://primitives'), '/primitives');
    assert.equal(pathOf('https://example.com/primitives'), '/primitives');
    assert.equal(pathOf('canary://'), '/');
    assert.equal(pathOf(null), null);
  });

  it('keeps the query and fragment of a web link with no path', () => {
    // A universal link is often the bare domain with an invite code on it.
    assert.equal(pathOf('https://example.com?invite=abc'), '/?invite=abc');
    assert.equal(pathOf('https://example.com#top'), '/#top');
    assert.equal(pathOf('https://example.com/join?invite=abc'), '/join?invite=abc');
  });

  it('finds the app path inside an Expo Go development url', () => {
    assert.equal(pathOf('exp://127.0.0.1:8081/--/detail'), '/detail');
    assert.equal(
      pathOf('exp://192.168.1.4:8081'),
      '/',
      'a dev url with no app path is the root, not a route named after the machine',
    );
  });

  it('does not deliver a launch at the root, which is where the app starts anyway', async () => {
    const platform = source('canary://');
    const links = build(DeepLinks, [{ provide: DeepLinks.SOURCE, useValue: platform.value }]);
    const seen: string[] = [];
    links.subscribe((path) => seen.push(path));
    await settle();
    assert.deepEqual(seen, []);
  });

  it('holds the launch url when nothing is listening yet', async () => {
    const platform = source('canary://users/7');
    const links = build(DeepLinks, [{ provide: DeepLinks.SOURCE, useValue: platform.value }]);
    await settle();
    assert.equal(links.initialUrl(), '/users/7', 'history can start there');
  });

  it('delivers the launch url as a link when the router got in first', async () => {
    const platform = source('canary://users/7');
    const links = build(DeepLinks, [{ provide: DeepLinks.SOURCE, useValue: platform.value }]);

    const seen: string[] = [];
    links.subscribe((path) => seen.push(path));
    await settle();

    assert.deepEqual(seen, ['/users/7'], 'the promise lost the race, and nothing was dropped');
    assert.equal(links.initialUrl(), null);
  });

  it('passes a link that arrives later through as a path', async () => {
    const platform = source(null);
    const links = build(DeepLinks, [{ provide: DeepLinks.SOURCE, useValue: platform.value }]);

    const seen: string[] = [];
    const stop = links.subscribe((path) => seen.push(path));
    platform.deliver('canary://settings');
    stop();
    platform.deliver('canary://ignored');

    assert.deepEqual(seen, ['/settings']);
  });
});

describe('the screen', () => {
  const sizes = (width: number, height: number) => ({
    window: { width, height },
    screen: { width, height },
  });

  /*
   * `Screen.window` reads the safe-area provider's measured frame, because on Android 15 an app
   * draws behind the system bars and `Dimensions` reports the area between them. Nothing reports
   * a frame in these tests, so `window` stays on its `Dimensions` fallback - which is what these
   * two are about. `screen-drawable.test.ts` covers the measured case.
   */
  it('calls a square window portrait, as a media query does', () => {
    const screen = build(Screen, [
      {
        provide: Screen.SOURCE,
        useValue: { current: () => sizes(500, 500), subscribe: () => () => {} },
      },
    ]);
    assert.equal(screen.orientation(), 'portrait');
  });

  it('derives orientation, and follows a rotation', () => {
    let emit: (value: ReturnType<typeof sizes>) => void = () => {};
    const screen = build(Screen, [
      {
        provide: Screen.SOURCE,
        useValue: {
          current: () => sizes(400, 800),
          subscribe: (fn: typeof emit) => ((emit = fn), () => {}),
        },
      },
    ]);

    assert.equal(screen.orientation(), 'portrait');
    assert.equal(screen.window().width, 400);

    emit(sizes(800, 400));
    assert.equal(screen.orientation(), 'landscape');
    assert.equal(screen.window().width, 800);
  });

  it('calls a phone compact and a tablet not, and changes its mind on a rotation', () => {
    // The branch a sidebar reads to decide whether it is a rail or a sheet. An iPad turned to
    // portrait is still a tablet, so this has to be about width rather than orientation - and it
    // has to follow, because on iPadOS a window can be resized without the device moving at all.
    let emit: (value: ReturnType<typeof sizes>) => void = () => {};
    const screen = build(Screen, [
      {
        provide: Screen.SOURCE,
        useValue: {
          current: () => sizes(402, 874),
          subscribe: (fn: typeof emit) => ((emit = fn), () => {}),
        },
      },
    ]);

    assert.equal(screen.compact(), true, 'a phone in portrait');

    emit(sizes(874, 402));
    assert.equal(screen.compact(), false, 'and the same phone on its side is not');

    emit(sizes(820, 1180));
    assert.equal(screen.compact(), false, 'an iPad in portrait, which is the case that matters');

    emit(sizes(COMPACT_WIDTH, 1024));
    assert.equal(screen.compact(), false, 'the boundary belongs to the roomy side');
  });
});

describe('the direction', () => {
  it('reports which way round the world is, as a signal and as a boolean', () => {
    // The one capability the cascade cannot answer for. `direction: rtl` mirrors the paint and
    // tells no one, so every decision made in TypeScript - which edge `align: 'start'` means,
    // which way a drag adds to a value - reads it from here instead. See `anchor.test.ts`.
    let emit: (value: 'ltr' | 'rtl') => void = () => {};
    const direction = build(Direction, [
      {
        provide: Direction.SOURCE,
        useValue: {
          current: () => 'rtl',
          subscribe: (fn: typeof emit) => ((emit = fn), () => {}),
        },
      },
    ]);
    assert.equal(direction.current(), 'rtl');
    assert.equal(direction.rtl(), true);

    // React Native cannot change its mind without a restart, but the browser source can - so the
    // signal follows the source rather than being read once.
    emit('ltr');
    assert.equal(direction.current(), 'ltr');
    assert.equal(direction.rtl(), false);
  });
});

describe('the colour scheme and the app state', () => {
  it('start where the platform is and follow it', () => {
    let scheme: (value: 'light' | 'dark') => void = () => {};
    const colors = build(ColorScheme, [
      {
        provide: ColorScheme.SOURCE,
        useValue: {
          current: () => 'dark',
          subscribe: (fn: typeof scheme) => ((scheme = fn), () => {}),
        },
      },
    ]);
    assert.equal(colors.current(), 'dark');
    scheme('light');
    assert.equal(colors.current(), 'light');

    let state: (value: 'active' | 'background') => void = () => {};
    const app = build(AppState, [
      {
        provide: AppState.SOURCE,
        useValue: {
          current: () => 'active',
          subscribe: (fn: typeof state) => ((state = fn), () => {}),
        },
      },
    ]);
    assert.equal(app.active(), true);
    state('background');
    assert.equal(app.active(), false);
    assert.equal(app.current(), 'background');
  });
});

describe('accessibility settings', () => {
  const platform = () => {
    let listener: (change: Record<string, boolean>) => void = () => {};
    const announced: string[] = [];
    return {
      announced,
      change: (value: Record<string, boolean>) => listener(value),
      value: {
        current: () =>
          Promise.resolve({ screenReader: true, reduceMotion: false, boldText: false }),
        subscribe: (fn: typeof listener) => ((listener = fn), () => {}),
        announce: (message: string) => announced.push(message),
      },
    };
  };

  it('assumes nothing is on until the platform answers', async () => {
    const fake = platform();
    const settings = build(Accessibility, [
      { provide: Accessibility.SOURCE, useValue: fake.value },
    ]);

    assert.equal(settings.screenReader(), false, 'the first paint cannot wait for a promise');
    await settle();
    assert.equal(settings.screenReader(), true);
  });

  it('changes one setting without disturbing the others', async () => {
    const fake = platform();
    const settings = build(Accessibility, [
      { provide: Accessibility.SOURCE, useValue: fake.value },
    ]);
    await settle();

    fake.change({ reduceMotion: true });
    assert.equal(settings.reduceMotion(), true);
    assert.equal(settings.screenReader(), true, 'still on; the event carried one key');

    settings.announce('nothing matched');
    assert.deepEqual(fake.announced, ['nothing matched']);
  });
});

describe('the tokens the device settles at startup', () => {
  it('offers the platform hairline, and nothing off a device', () => {
    // `1px` is a fat line on a 3x screen: a native divider is one physical pixel, which is a
    // third of a point. React Native works the number out; nothing here should second-guess it.
    // Off a device there is no answer, and inventing one would be a line of the wrong weight.
    assert.deepEqual(deviceTokens(), {});
  });
});

describe('the engine conditions', () => {
  it('start from the device and keep up with it', async () => {
    const updates: unknown[] = [];
    const classes = new Set<string>();
    const engine = {
      root: 'root',
      updateConditions: (conditions: unknown) => updates.push(conditions),
      addClass: (_: string, name: string) => classes.add(name),
      removeClass: (_: string, name: string) => classes.delete(name),
    };

    // Off a device every source is inert, so these are the neutral values an app starts at.
    const initial = currentConditions();
    assert.deepEqual(initial, {
      width: 0,
      height: 0,
      colorScheme: 'light',
      reducedMotion: false,
    });

    const stop = watchConditions(engine);
    await settle();
    stop();
    assert.deepEqual(updates, [], 'nothing changed, so the engine was not disturbed');
    assert.deepEqual([...classes], [], 'a light start puts no dark class on the root');
  });
});
