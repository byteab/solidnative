import assert from 'node:assert/strict';
import { test } from 'node:test';
import { batch, createRenderEffect, createRoot, createSignal, untrack } from 'solid-js';
import { mountNative } from '@solidnative/platform/solid';
import {
  ColorScheme,
  SafeArea,
  StatusBar,
  SCREEN_IN_FRONT,
  colorSchemeSource,
  statusBarSource,
  createSafeArea,
  createObserved,
  provideService,
  useService,
  useStatusBar,
  withServiceScope,
  type Scheme,
  type SafeAreaMetrics,
  type StatusBarSource,
} from '@solidnative/device/solid';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';
import { deviceFixture } from './g4-device-fixture.tsx';

function source<T>(initial: T | PromiseLike<T>) {
  let emit!: (value: T) => void;
  let removes = 0;
  let subscriptions = 0;
  return {
    current: () => initial,
    subscribe(listener: (value: T) => void) {
      subscriptions++;
      emit = listener;
      return () => {
        removes++;
      };
    },
    emit: (value: T) => emit(value),
    get removes() {
      return removes;
    },
    get subscriptions() {
      return subscriptions;
    },
  };
}
function barSource() {
  const calls: [string, unknown, unknown?][] = [];
  const bar: StatusBarSource = {
    height: 47,
    setStyle: (value, animated) => {
      calls.push(['style', value, animated]);
    },
    setHidden: (value, animation) => {
      calls.push(['hidden', value, animation]);
    },
    setBackgroundColor: (value, animated) => {
      calls.push(['color', value, animated]);
    },
    setTranslucent: (value) => {
      calls.push(['translucent', value]);
    },
  };
  return { bar, calls };
}
const metrics: SafeAreaMetrics = {
  insets: { top: 20, right: 0, bottom: 30, left: 0 },
  frame: { x: 0, y: 0, width: 400, height: 800 },
};

test('compiled services paint synchronous dark sources, front claims, safe-area updates and clean up', async () => {
  const colors = source<Scheme>('dark');
  const area = source<SafeAreaMetrics | null>(null);
  const { bar, calls } = barSource();
  const fixture = deviceFixture({ ...colors, current: () => 'dark' }, area, bar);
  const fabric = createFakeFabric();
  const root = mountNative(fixture.render, { fabric, rootTag: 401 });
  assert.equal(fabric.roots.get(401)![0].children[0].children[0].props['text'], 'dark');
  assert.equal(colors.subscriptions, 1);
  assert.deepEqual(fixture.status().state(), { style: 'light', hidden: false });
  assert.equal(fixture.status().height(), 47);
  colors.emit('light');
  area.emit(metrics);
  root.flush();
  assert.equal(fabric.roots.get(401)![0].children[0].children[0].props['text'], 'light');
  assert.equal(
    fabric.roots
      .get(401)![0]
      .children[1].children.map((node) => node.props['text'])
      .join(''),
    '30:400',
  );
  batch(() => {
    fixture.setFirstFront(false);
    fixture.setSecondFront(true);
  });
  fixture.setHidden(true);
  assert.deepEqual(fixture.status().state(), { style: 'light', hidden: true });
  fixture.setSecondFront(false);
  const before = calls.length;
  fixture.setLight(false);
  assert.equal(calls.length, before, 'covered screens do not subscribe to bar appearance');
  assert.deepEqual(fixture.status().state(), { style: 'dark', hidden: false });
  fixture.setFirstFront(true);
  fixture.setVisible(false);
  assert.deepEqual(fixture.status().state(), { style: 'dark', hidden: false });
  assert.ok(calls.length < 50, 'claims do not recursively observe their own stack writes');
  root.dispose();
  assert.equal(colors.removes, 1);
  assert.equal(area.removes, 1);
  colors.emit('dark');
  area.emit({ ...metrics, insets: { ...metrics.insets, bottom: 100 } });
  assert.equal(fixture.color().current(), 'light');
  assert.equal(fixture.safe().insets().bottom, 30);
  const disposedCalls = calls.length;
  fixture.status().set({ hidden: true });
  fixture.status().push({ style: 'light' })();
  assert.equal(calls.length, disposedCalls);
  await Promise.resolve();
});

test('safe-area provider reports outrank a late snapshot and stop after disposal', async () => {
  let answer!: (value: SafeAreaMetrics | null) => void;
  const feed = source(
    new Promise<SafeAreaMetrics | null>((resolve) => {
      answer = resolve;
    }),
  );
  let dispose!: () => void;
  const area = createRoot((cleanup) => {
    dispose = cleanup;
    return createSafeArea(feed);
  });
  assert.equal(area.known(), false);
  assert.deepEqual(area.insets(), { top: 0, right: 0, bottom: 0, left: 0 });
  area.report(metrics.insets, metrics.frame);
  answer(null);
  await Promise.resolve();
  assert.deepEqual(area.frame(), metrics.frame);
  assert.equal(area.known(), true);
  dispose();
  area.report({ ...metrics.insets, top: 500 }, metrics.frame);
  feed.emit(null);
  assert.equal(area.insets().top, 20);
  assert.equal(feed.removes, 1);
});

test('color and safe-area source overrides remain nearest, lazy and independently scoped', () => {
  let factoryCalls = 0;
  let sets: (Scheme | null)[] = [];
  createRoot((dispose) => {
    withServiceScope(
      [
        provideService(ColorScheme.SOURCE, () => {
          factoryCalls++;
          return {
            current: () => 'dark',
            subscribe: () => () => {},
            set: (value) => {
              sets.push(value);
            },
          };
        }),
      ],
      () => {
        assert.equal(factoryCalls, 0);
        const outer = useService(ColorScheme);
        outer.set(null);
        outer.set('light');
        withServiceScope(
          [
            provideService(ColorScheme, ColorScheme.create),
            provideService(ColorScheme.SOURCE, () => ({
              current: () => 'light',
              subscribe: () => () => {},
            })),
            provideService(SafeArea.SOURCE, () => ({
              current: () => metrics,
              subscribe: () => () => {},
            })),
            provideService(SafeArea, SafeArea.create),
          ],
          () => {
            const inner = useService(ColorScheme);
            assert.equal(inner.current(), 'light');
            inner.set('dark');
            assert.equal(outer.current(), 'dark');
            assert.equal(useService(SafeArea).frame()?.width, 400);
            assert.equal(useService(SCREEN_IN_FRONT)(), true);
          },
        );
      },
    );
    dispose();
  });
  assert.equal(factoryCalls, 1);
  assert.deepEqual(sets, [null, 'light']);
  assert.throws(() => useStatusBar(() => ({})), /active Solid owner/);
});

test('base status-bar changes preserve active claims; imperative claims do not track themselves', () => {
  const { bar, calls } = barSource();
  let dispose!: () => void;
  let state!: StatusBar;
  let release!: () => void;
  const [version, setVersion] = createSignal(false);
  let runs = 0;
  createRoot((cleanup) => {
    dispose = cleanup;
    withServiceScope([provideService(StatusBar.SOURCE, () => bar)], () => {
      state = useService(StatusBar);
      release = state.push({ style: 'light' });
      state.set({ style: 'dark', hidden: true });
      assert.deepEqual(untrack(state.state), { style: 'light', hidden: true });
      createRenderEffect(() => {
        runs++;
        state.push({ translucent: version(), backgroundColor: 'red', animated: true });
      });
    });
  });
  setVersion(true);
  assert.equal(runs, 2);
  release();
  release();
  assert.deepEqual(state.state(), {
    style: 'dark',
    hidden: true,
    translucent: true,
    backgroundColor: 'red',
    animated: true,
  });
  assert.ok(calls.some((call) => call[0] === 'hidden' && call[2] === 'fade'));
  dispose();
});

test('a failed native status setter rolls back the claim before the failed screen cleans up', () => {
  const { bar } = barSource();
  let fail = false;
  const source = {
    ...bar,
    setStyle: (style: string) => {
      if (fail || style === 'light') throw new Error('native setter');
    },
  };
  let status!: StatusBar;
  createRoot((dispose) => {
    withServiceScope([provideService(StatusBar.SOURCE, () => source)], () => {
      status = useService(StatusBar);
      status.set({ style: 'dark' });
      assert.throws(
        () => withServiceScope([], () => useStatusBar(() => ({ style: 'light' }))),
        /native setter/,
      );
      assert.deepEqual(untrack(status.state), { style: 'dark' });
      fail = true;
      assert.throws(() => status.push({ style: 'light' }), /native setter/);
      assert.deepEqual(
        untrack(status.state),
        { style: 'dark' },
        'failed restoration still releases the claim',
      );
    });
    fail = false;
    dispose();
  });
});

test('disposing a color service prevents a retained imperative setter from changing native appearance', () => {
  let sets = 0;
  let color!: ColorScheme;
  createRoot((dispose) => {
    withServiceScope(
      [
        provideService(ColorScheme.SOURCE, () => ({
          current: () => 'dark',
          subscribe: () => () => {},
          set: () => {
            sets++;
          },
        })),
      ],
      () => {
        color = useService(ColorScheme);
      },
    );
    color.set('light');
    assert.equal(sets, 1);
    dispose();
  });
  color.set('dark');
  assert.equal(sets, 1);
});

test('direct native source factories map static methods without invoking React components', () => {
  let scheme: Scheme | null = 'dark';
  let nativeListener!: () => void;
  let removals = 0;
  let assigned: unknown;
  const colors = colorSchemeSource({
    Appearance: {
      getColorScheme: () => scheme,
      addChangeListener: (listener) => {
        nativeListener = () => listener({});
        return {
          remove: () => {
            removals++;
          },
        };
      },
      setColorScheme: (value) => {
        assigned = value;
      },
    },
  });
  assert.equal(colors.current(), 'dark');
  let heard: Scheme = 'dark';
  const stop = colors.subscribe((value) => {
    heard = value;
  });
  scheme = null;
  nativeListener();
  assert.equal(heard, 'light');
  colors.set?.(null);
  assert.equal(assigned, 'unspecified');
  colors.set?.('dark');
  assert.equal(assigned, 'dark');
  stop();
  assert.equal(removals, 1);
  const calls: unknown[][] = [];
  const bar = statusBarSource({
    StatusBar: {
      currentHeight: 12,
      setBarStyle: (...args) => {
        calls.push(args);
      },
      setHidden: (...args) => {
        calls.push(args);
      },
      setBackgroundColor: (...args) => {
        calls.push(args);
      },
      setTranslucent: (...args) => {
        calls.push(args);
      },
    },
  });
  bar.setStyle('light', true);
  bar.setHidden(true, 'fade');
  bar.setBackgroundColor('red');
  bar.setTranslucent(false);
  assert.deepEqual(calls, [['light-content', true], [true, 'fade'], ['red', undefined], [false]]);
  assert.equal(bar.height, 12);
  const inert = colorSchemeSource(null);
  assert.equal(inert.current(), 'light');
  inert.subscribe(() => {})();
  const absent = statusBarSource(null);
  absent.setStyle('default');
  absent.setHidden(false);
  absent.setBackgroundColor('blue');
  absent.setTranslucent(true);
  assert.equal(absent.height, undefined);
});

test('observed accepts synchronous snapshots immediately while a synchronous event wins', () => {
  createRoot((dispose) => {
    assert.equal(createObserved({ current: () => 2, subscribe: () => () => {} }, 0)(), 2);
    assert.equal(
      createObserved(
        {
          current: () => 2,
          subscribe: (emit) => {
            emit(3);
            return () => {};
          },
        },
        0,
      )(),
      3,
    );
    dispose();
  });
});
