/**
 * The layer between React Native's API and this package's `Source` interfaces.
 *
 * Every capability in `@solidnative/device` is a service reading a `SOURCE` token, and every
 * test of those services provides a fake source - which is what makes the services well covered
 * and left the *default* factories, the ones that actually talk to React Native, almost entirely
 * unrun. That is the wrong half to leave untested. A service's logic is ordinary TypeScript that
 * fails loudly; a source factory is a translation between two APIs, where a wrong property name or
 * a capability detected the wrong way does nothing at all and says nothing about it. The Android
 * dialog bugs lived here: `ActionSheetIOS` is exported on Android with a null module under it, so
 * "is the module there" answered yes and `choose` silently never resolved.
 *
 * `reactNative()` reaches `require('react-native')` through a bare `require` identifier, which in
 * an ES module resolves to a global if one exists. Defining one is therefore the same seam a
 * device gives it, with no production code aware of the test - the alternative would be an
 * override hook that exists only to be overridden.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  accessibilitySource,
  androidPermission,
  appStateSource,
  colorSchemeSource,
  deepLinkSource,
  directionSource,
  hardwareBackSource,
  keyboardSource,
  screenSource,
  sharingSource,
  statusBarSource,
} from '@solidnative/device';

type Native = Record<string, unknown>;

/**
 * Installs a fake `react-native` for one call, and takes it away again.
 *
 * Set rather than injected because that is exactly what a device does: Metro's CommonJS `require`
 * is in scope for the module, and `reactNative()` reads it as a free variable.
 */
function withNative<T>(native: Native, run: () => T): T {
  const host = globalThis as Record<string, unknown>;
  host['require'] = (id: string) => (id === 'react-native' ? native : undefined);
  try {
    return run();
  } finally {
    delete host['require'];
  }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)['require'];
});

describe('a source factory with no react-native', () => {
  /*
   * Off a device every factory has to return something inert rather than throwing, because the
   * test suite and the web build both import this package and neither has React Native. A factory
   * that threw here would take down an import, not a feature.
   */
  it('gives every capability a working no-op', async () => {
    const accessibility = accessibilitySource();
    assert.deepEqual(await accessibility.current(), {
      screenReader: false,
      reduceMotion: false,
      boldText: false,
      fontScale: 1,
    });
    assert.doesNotThrow(() => accessibility.announce('ignored'));
    assert.doesNotThrow(() => accessibility.subscribe(() => {})());

    assert.doesNotThrow(() => keyboardSource().dismiss());
    assert.doesNotThrow(() => statusBarSource().setStyle('light'));
    assert.equal(statusBarSource().height, undefined);
    assert.equal(sharingSource(), null, 'nothing to share with');
    assert.equal(directionSource().current(), 'ltr');
    assert.doesNotThrow(() => hardwareBackSource().subscribe(() => false)());
  });
});

describe('the accessibility source', () => {
  const native = () => ({
    AccessibilityInfo: {
      isScreenReaderEnabled: () => Promise.resolve(true),
      isReduceMotionEnabled: () => Promise.resolve(false),
      isBoldTextEnabled: () => Promise.resolve(true),
      announceForAccessibility: (message: string) => announced.push(message),
      addEventListener: (event: string, handler: (value: boolean) => void) => {
        handlers.set(event, handler);
        return { remove: () => removed.push(event) };
      },
    },
    AppState: {
      currentState: 'active',
      addEventListener: (event: string, handler: (state: string) => void) => {
        appStateHandler = handler;
        return { remove: () => removed.push(event) };
      },
    },
    PixelRatio: { getFontScale: () => fontScale },
  });
  let announced: string[] = [];
  let removed: string[] = [];
  let handlers = new Map<string, (value: boolean) => void>();
  let appStateHandler: (state: string) => void = () => {};
  let fontScale = 1.5;

  afterEach(() => {
    announced = [];
    removed = [];
    handlers = new Map();
    appStateHandler = () => {};
    fontScale = 1.5;
  });

  it('reads all four settings, including the one that is not a boolean', async () => {
    // `fontScale` comes off `PixelRatio` rather than `AccessibilityInfo`, which is the detail a
    // translation layer gets wrong and nothing notices: text that never respects a size setting.
    const current = await withNative(native(), () => accessibilitySource().current());
    assert.deepEqual(current, {
      screenReader: true,
      reduceMotion: false,
      boldText: true,
      fontScale: 1.5,
    });
  });

  it('reports each change under the name the service reads', async () => {
    const seen: unknown[] = [];
    const stop = withNative(native(), () => accessibilitySource().subscribe((v) => seen.push(v)));

    handlers.get('screenReaderChanged')!(true);
    handlers.get('reduceMotionChanged')!(true);
    handlers.get('boldTextChanged')!(false);
    assert.deepEqual(seen, [{ screenReader: true }, { reduceMotion: true }, { boldText: false }]);

    // Four listeners, four removals: dropping one leaks a subscription onto a dead service.
    stop();
    assert.deepEqual(removed.sort(), [
      'boldTextChanged',
      'change',
      'reduceMotionChanged',
      'screenReaderChanged',
    ]);
  });

  it('re-reads fontScale when the app comes back, since changing it means leaving for Settings', () => {
    const seen: unknown[] = [];
    withNative(native(), () => accessibilitySource().subscribe((v) => seen.push(v)));

    fontScale = 2;
    appStateHandler('active');
    assert.deepEqual(seen, [{ fontScale: 2 }]);

    // Going to the background is not the moment that matters - only coming back is.
    fontScale = 3;
    appStateHandler('background');
    assert.deepEqual(seen, [{ fontScale: 2 }]);
  });

  it('passes an announcement through', () => {
    withNative(native(), () => accessibilitySource().announce('Saved'));
    assert.deepEqual(announced, ['Saved']);
  });
});

describe('the keyboard source', () => {
  /** A fake `react-native` on one platform, keeping every keyboard handler it is given. */
  function keyboardOn(os: string) {
    const handlers = new Map<string, (event: unknown) => void>();
    const removed: string[] = [];
    const native = {
      Platform: { OS: os },
      Keyboard: {
        dismiss: () => {},
        addListener: (event: string, handler: (e: unknown) => void) => {
          handlers.set(event, handler);
          return { remove: () => removed.push(event) };
        },
      },
    };
    const seen: unknown[] = [];
    const stop = withNative(native, () => keyboardSource().subscribe((v) => seen.push(v)));
    const fire = (event: string, payload: unknown) => handlers.get(event)!(payload);
    return { handlers, removed, seen, stop, fire };
  }

  const frame = (height: number, screenY: number) => ({
    endCoordinates: { height, screenY },
    duration: 250,
    easing: 'keyboard',
  });

  it('on iOS, reports the keyboard as it starts to move, with its timing', () => {
    // RN's own KeyboardAvoidingView listens for the Will events on iOS: the Did events arrive
    // once the keyboard has landed, and a layout that waits for them moves after it, not with it.
    const { handlers, removed, seen, stop, fire } = keyboardOn('ios');
    assert.deepEqual(
      [...handlers.keys()].sort(),
      ['keyboardWillChangeFrame', 'keyboardWillHide', 'keyboardWillShow'],
      'no Did events on iOS',
    );

    fire('keyboardWillShow', {
      endCoordinates: { height: 291, screenY: 500 },
      duration: 250,
      easing: 'easeOut',
    });
    // The predictive bar appearing grows the keyboard that is already up.
    fire('keyboardWillChangeFrame', {
      endCoordinates: { height: 335, screenY: 456 },
      duration: 0,
      easing: 'easeInEaseOut',
    });
    // A hide carries its timing too, so a layout can ease back down with the keyboard.
    fire('keyboardWillHide', {
      endCoordinates: { height: 335, screenY: 791 },
      duration: 250,
      easing: 'easeIn',
    });

    assert.deepEqual(seen, [
      { height: 291, screenY: 500, duration: 250, easing: 'easeOut' },
      { height: 335, screenY: 456, duration: 0, easing: 'easeInEaseOut' },
      { height: 0, duration: 250, easing: 'easeIn' },
    ]);
    stop();
    assert.deepEqual(removed.sort(), [
      'keyboardWillChangeFrame',
      'keyboardWillHide',
      'keyboardWillShow',
    ]);
  });

  it('on iOS, ignores a frame change while the keyboard is down', () => {
    // UIKit posts WillChangeFrame beside WillShow and WillHide as well as on its own, and the one
    // beside a hide is the frame the keyboard leaves by, off the bottom of the screen.
    const { seen, stop, fire } = keyboardOn('ios');

    fire('keyboardWillChangeFrame', frame(335, 456));
    fire('keyboardWillShow', frame(335, 456));
    fire('keyboardWillHide', frame(335, 791));
    fire('keyboardWillChangeFrame', frame(335, 791));

    assert.deepEqual(seen, [
      { height: 335, screenY: 456, duration: 250, easing: 'keyboard' },
      { height: 0, duration: 250, easing: 'keyboard' },
    ]);
    stop();
  });

  it('on Android, keeps to the Did events, which are the only ones it sends', () => {
    const { handlers, removed, seen, stop, fire } = keyboardOn('android');
    assert.deepEqual([...handlers.keys()].sort(), ['keyboardDidHide', 'keyboardDidShow']);

    fire('keyboardDidShow', {
      endCoordinates: { height: 291, screenY: 500 },
      duration: 0,
      easing: 'keyboard',
    });
    // A hide reports zero rather than the last height, so a layout reading it moves back down.
    fire('keyboardDidHide', {});

    assert.deepEqual(seen, [
      { height: 291, screenY: 500, duration: 0, easing: 'keyboard' },
      { height: 0 },
    ]);
    stop();
    assert.deepEqual(removed.sort(), ['keyboardDidHide', 'keyboardDidShow']);
  });
});

describe('the status bar source', () => {
  it("maps this package's style names onto React Native's", () => {
    const calls: unknown[][] = [];
    const native = {
      StatusBar: {
        currentHeight: 51.8,
        setBarStyle: (...args: unknown[]) => calls.push(['setBarStyle', ...args]),
        setHidden: (...args: unknown[]) => calls.push(['setHidden', ...args]),
        setBackgroundColor: (...args: unknown[]) => calls.push(['setBackgroundColor', ...args]),
        setTranslucent: (...args: unknown[]) => calls.push(['setTranslucent', ...args]),
      },
    };

    withNative(native, () => {
      const source = statusBarSource();
      source.setStyle('light', true);
      source.setHidden(true, 'fade');
      source.setBackgroundColor('#000000', false);
      source.setTranslucent(true);
      // A getter rather than a value: Android reports the height once the bar exists, and reading
      // it at factory time would capture whatever it was before layout.
      assert.equal(source.height, 51.8);
    });

    assert.deepEqual(calls, [
      ['setBarStyle', 'light-content', true],
      ['setHidden', true, 'fade'],
      ['setBackgroundColor', '#000000', false],
      ['setTranslucent', true],
    ]);
  });
});

describe('the screen source', () => {
  it('reports both sizes and follows a change', () => {
    let emit: (sizes: unknown) => void = () => {};
    let removed = false;
    const native = {
      Dimensions: {
        get: (which: string) =>
          which === 'window' ? { width: 411, height: 838 } : { width: 411, height: 914 },
        addEventListener: (_event: string, handler: (sizes: unknown) => void) => {
          emit = handler;
          return { remove: () => (removed = true) };
        },
      },
    };

    withNative(native, () => {
      const source = screenSource();
      assert.deepEqual(source.current(), {
        window: { width: 411, height: 838 },
        screen: { width: 411, height: 914 },
      });

      const seen: unknown[] = [];
      const stop = source.subscribe((sizes) => seen.push(sizes));
      emit({ window: { width: 838, height: 411 }, screen: { width: 914, height: 411 } });
      assert.deepEqual(seen, [
        { window: { width: 838, height: 411 }, screen: { width: 914, height: 411 } },
      ]);
      stop();
      assert.equal(removed, true);
    });
  });
});

describe('the colour scheme and app state sources', () => {
  it('follows the appearance, treating no answer as light', () => {
    let emit: () => void = () => {};
    /*
     * `null` is what React Native returns when the system has no preference, and it has to mean
     * light rather than leaving the app unthemed.
     *
     * The fake changes what `getColorScheme()` answers rather than carrying a scheme in the event,
     * because that is what the source reads: it ignores the change payload and re-reads. Worth a
     * test of its own, since the payload is the obvious thing to trust and it is the wrong one -
     * React Native calls the listener for appearance changes that are not the colour scheme.
     */
    let scheme: string | null = null;
    const native = {
      Appearance: {
        getColorScheme: () => scheme,
        addChangeListener: (handler: () => void) => {
          emit = handler;
          return { remove: () => {} };
        },
      },
    };

    withNative(native, () => {
      const source = colorSchemeSource();
      assert.equal(source.current(), 'light');
      const seen: string[] = [];
      source.subscribe((value) => seen.push(value));
      scheme = 'dark';
      emit();
      scheme = null;
      emit();
      assert.deepEqual(seen, ['dark', 'light']);
    });
  });

  it('sets an app-wide scheme over the system one, and hands it back', () => {
    const asked: (string | null | undefined)[] = [];
    const native = {
      Appearance: {
        getColorScheme: () => 'light',
        addChangeListener: () => ({ remove: () => {} }),
        setColorScheme: (scheme: string | null | undefined) => void asked.push(scheme),
      },
    };
    withNative(native, () => {
      const source = colorSchemeSource();
      source.set?.('dark');
      source.set?.(null);
      assert.deepEqual(asked, ['dark', 'unspecified']);
    });
  });

  it('keeps inactive apart from active, as a call or the app switcher leaves it', () => {
    const native = {
      AppState: { currentState: 'inactive', addEventListener: () => ({ remove: () => {} }) },
    };
    withNative(native, () => assert.equal(appStateSource().current(), 'inactive'));
  });

  it('reports the app state, treating a missing one as active', () => {
    let emit: (state: string) => void = () => {};
    const native = {
      AppState: {
        currentState: null,
        addEventListener: (_event: string, handler: typeof emit) => {
          emit = handler;
          return { remove: () => {} };
        },
      },
    };

    withNative(native, () => {
      const source = appStateSource();
      assert.equal(source.current(), 'active');
      const seen: string[] = [];
      source.subscribe((state) => seen.push(state));
      emit('background');
      assert.deepEqual(seen, ['background']);
    });
  });
});

describe('the direction source', () => {
  it('reads the layout direction, which is fixed for the process', () => {
    assert.equal(
      withNative({ I18nManager: { isRTL: true } }, () => directionSource().current()),
      'rtl',
    );
    assert.equal(
      withNative({ I18nManager: { isRTL: false } }, () => directionSource().current()),
      'ltr',
    );
  });
});

describe('the hardware back source', () => {
  it('subscribes and unsubscribes through BackHandler', () => {
    let handler: (() => boolean) | null = null;
    let removed = false;
    const native = {
      BackHandler: {
        addEventListener: (_event: string, listener: () => boolean) => {
          handler = listener;
          return { remove: () => (removed = true) };
        },
      },
    };

    withNative(native, () => {
      const stop = hardwareBackSource().subscribe(() => true);
      assert.equal(handler!(), true, 'the handler reaches BackHandler unchanged');
      stop();
      assert.equal(removed, true);
    });
  });
});

describe('the deep link source', () => {
  it('reports the launch URL and every one after it', async () => {
    let emit: (event: { url: string }) => void = () => {};
    let removed = false;
    const opened: string[] = [];
    const native = {
      Linking: {
        getInitialURL: () => Promise.resolve('app://launch/path'),
        openURL: (url: string) => {
          opened.push(url);
          return Promise.resolve(true);
        },
        addEventListener: (_event: string, handler: typeof emit) => {
          emit = handler;
          return { remove: () => (removed = true) };
        },
      },
    };

    const source = withNative(native, () => deepLinkSource());
    assert.equal(await source.launchUrl(), 'app://launch/path');

    // The event carries `{ url }` and the listener takes the string, which is the shape a
    // subscriber would otherwise have to unwrap itself.
    const seen: string[] = [];
    const stop = source.subscribe((url) => seen.push(url));
    emit({ url: 'app://later' });
    assert.deepEqual(seen, ['app://later']);
    stop();
    assert.equal(removed, true);

    source.open('app://elsewhere');
    assert.deepEqual(opened, ['app://elsewhere']);
  });

  it('swallows a rejected open, because a dead link is not a crash', async () => {
    // `openURL` rejects when nothing can handle the scheme. An unhandled rejection would take the
    // app down for a link that simply had nowhere to go.
    const native = {
      Linking: {
        getInitialURL: () => Promise.resolve(null),
        openURL: () => Promise.reject(new Error('no handler')),
        addEventListener: () => ({ remove: () => {} }),
      },
    };
    const source = withNative(native, () => deepLinkSource());
    assert.doesNotThrow(() => source.open('nope://x'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('an Android permission on the wrong platform', () => {
  it('is granted outright on iOS, rather than reading PermissionsAndroid as denied', async () => {
    // `PermissionsAndroid` is the same module object on iOS - not absent, but a stub that warns
    // and resolves `false`/`'denied'` for every call. Reaching for it unguarded would read an iOS
    // permission the platform never asked about as refused rather than the granted this promises.
    const calls: string[] = [];
    const native = {
      Platform: { OS: 'ios' },
      PermissionsAndroid: {
        check: async (permission: string) => (calls.push(`check:${permission}`), false),
        request: async (permission: string) => (calls.push(`request:${permission}`), 'denied'),
      },
    };

    const [check, request] = withNative(native, () =>
      androidPermission('android.permission.POST_NOTIFICATIONS'),
    );

    assert.deepEqual(await check(), { status: 'granted', granted: true, canAskAgain: false });
    assert.deepEqual(await request(), { status: 'granted', granted: true, canAskAgain: false });
    assert.deepEqual(
      calls,
      [],
      'PermissionsAndroid was never asked on a platform that is not Android',
    );
  });

  it('reaches the real PermissionsAndroid on Android', async () => {
    const calls: string[] = [];
    const native = {
      Platform: { OS: 'android' },
      PermissionsAndroid: {
        check: async (permission: string) => (calls.push(`check:${permission}`), true),
        request: async (permission: string) => (calls.push(`request:${permission}`), 'granted'),
      },
    };

    const [check] = withNative(native, () =>
      androidPermission('android.permission.POST_NOTIFICATIONS'),
    );

    assert.deepEqual(await check(), { status: 'granted', granted: true, canAskAgain: false });
    assert.deepEqual(calls, ['check:android.permission.POST_NOTIFICATIONS']);
  });
});

describe('the sharing source', () => {
  const shareWith = (os: string) => {
    const shared: unknown[] = [];
    const native = {
      Platform: { OS: os },
      Share: {
        share: (content: unknown) => {
          shared.push(content);
          return Promise.resolve({ action: 'sharedAction', activityType: 'com.example' });
        },
      },
    };
    return { shared, native };
  };

  it('exists once there is a platform to share with', async () => {
    const { shared, native } = shareWith('ios');
    const source = withNative(native, () => sharingSource());
    assert.notEqual(source, null);
    const result = await source!.share({ message: 'Look at this' });
    assert.deepEqual(shared, [{ message: 'Look at this' }]);
    assert.equal(result.action, 'sharedAction');
  });

  it('passes a url straight through on iOS, which reads it itself', async () => {
    const { shared, native } = shareWith('ios');
    await withNative(native, () => sharingSource())!.share({
      url: 'https://example.com',
      title: 'A',
    });
    assert.deepEqual(shared, [{ url: 'https://example.com', title: 'A' }]);
  });

  it('folds a url into the message on Android, which has no url field of its own', async () => {
    // Android's own Share module reads only title and message - a url-only request would open a
    // sheet with an empty body and nothing to actually share.
    const { shared, native } = shareWith('android');
    await withNative(native, () => sharingSource())!.share({
      url: 'https://example.com',
      title: 'A',
    });
    assert.deepEqual(shared, [{ title: 'A', message: 'https://example.com' }]);
  });

  it('puts the url after an existing message on Android, rather than replacing it', async () => {
    const { shared, native } = shareWith('android');
    await withNative(native, () => sharingSource())!.share({
      message: 'Check this out',
      url: 'https://example.com',
    });
    assert.deepEqual(shared, [
      { title: undefined, message: 'Check this out\nhttps://example.com' },
    ]);
  });
});
