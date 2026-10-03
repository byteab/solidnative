import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { createNativeRoot } from '@solid-native/platform/solid';
import {
  conditionSources,
  conditionSettingsSource,
  screenSource,
  currentConditions,
  deviceTokens,
  watchConditions,
  type ConditionSources,
  type ConditionSettings,
} from '@solid-native/device/solid';
import type { Conditions } from '@solid-native/fabric';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';
import { conditionFixture } from './g4-device-fixture.tsx';

function sources() {
  let size!: Parameters<ConditionSources['screen']['subscribe']>[0];
  let color!: Parameters<ConditionSources['colors']['subscribe']>[0];
  let setting!: Parameters<ConditionSources['settings']['subscribe']>[0];
  let answer!: (value: ConditionSettings) => void;
  let scale = 1;
  const removals = [0, 0, 0];
  const values: ConditionSources = {
    screen: {
      current: () => ({ window: { width: 400, height: 800 }, screen: { width: 400, height: 800 } }),
      subscribe: (next) => {
        size = next;
        return () => {
          removals[0]++;
        };
      },
    },
    colors: {
      current: () => 'dark',
      subscribe: (next) => {
        color = next;
        return () => {
          removals[1]++;
        };
      },
    },
    settings: {
      current: () =>
        new Promise<ConditionSettings>((resolve) => {
          answer = resolve;
        }),
      subscribe: (next) => {
        setting = next;
        return () => {
          removals[2]++;
        };
      },
    },
    fontScale: () => scale,
  };
  return {
    values,
    removals,
    resize: (width: number, height: number) =>
      size({ window: { width, height }, screen: { width, height } }),
    color: (value: 'light' | 'dark') => color(value),
    settings: (value: Partial<ConditionSettings>) => setting(value),
    answer: (value: ConditionSettings) => answer(value),
    scale: (value: number) => {
      scale = value;
    },
  };
}
function host() {
  const updates: Conditions[] = [];
  const classes = new Set<string>();
  let measurements = 0;
  return {
    root: {},
    updateConditions: (value: Conditions) => {
      updates.push(value);
    },
    addClass: (_node: object, name: string) => {
      classes.add(name);
    },
    removeClass: (_node: object, name: string) => {
      classes.delete(name);
    },
    remeasureText: () => {
      measurements++;
    },
    updates,
    classes,
    get measurements() {
      return measurements;
    },
  };
}

test('compiled native root owns CSS condition subscriptions and real viewport updates', async () => {
  const feed = sources();
  const fabric = createFakeFabric();
  const root = createNativeRoot({
    fabric,
    rootTag: 402,
    engineOptions: { conditions: currentConditions(feed.values) },
  });
  root.render(() => {
    watchConditions(root.engine, { sources: feed.values });
    return conditionFixture();
  });
  assert.equal(root.engine.root.classes?.has('dark'), true);
  const text = () => fabric.roots.get(402)![0].children[0];
  const tag = text().tag;
  assert.equal(text().props['width'], 200);
  feed.resize(600, 300);
  assert.equal(text().props['width'], 300);
  assert.equal(text().tag, tag);
  feed.color('light');
  assert.equal(root.engine.root.classes?.has('dark'), false);
  root.dispose();
  assert.deepEqual(feed.removals, [1, 1, 1]);
  const commits = fabric.commits;
  feed.resize(700, 300);
  feed.color('dark');
  feed.settings({ reduceMotion: true });
  feed.answer({ reduceMotion: true, fontScale: 2 });
  await Promise.resolve();
  assert.equal(fabric.commits, commits);
});

test('source events win over initial reads per property, including settings async races', async () => {
  const feed = sources();
  const target = host();
  const originalCurrent = feed.values.screen.current;
  const overridden: ConditionSources = {
    ...feed.values,
    screen: {
      ...feed.values.screen,
      current: () => {
        feed.resize(900, 400);
        return originalCurrent();
      },
    },
    colors: {
      ...feed.values.colors,
      current: () => {
        feed.color('light');
        return 'dark';
      },
    },
  };
  const stop = watchConditions(target, { sources: overridden });
  assert.deepEqual(target.updates, [
    { width: 900, height: 400, colorScheme: 'light', reducedMotion: false },
  ]);
  feed.settings({ reduceMotion: false });
  feed.answer({ reduceMotion: true, fontScale: 2 });
  await Promise.resolve();
  assert.equal(target.updates.at(-1)?.reducedMotion, false);
  assert.equal(target.measurements, 0, 'resize already sampled a fresher font scale');
  feed.scale(3);
  feed.resize(600, 300);
  feed.settings({ fontScale: 3 });
  assert.equal(
    target.measurements,
    1,
    'dimension and foreground duplicate scale only remeasure once',
  );
  feed.settings({ reduceMotion: true });
  assert.equal(target.updates.at(-1)?.reducedMotion, true);
  stop();
  stop();
  assert.deepEqual(feed.removals, [1, 1, 1]);
  const count = target.updates.length;
  feed.settings({ reduceMotion: false, fontScale: 4 });
  feed.resize(900, 400);
  assert.equal(target.updates.length, count);
  assert.equal(target.measurements, 1);
  const partial = sources();
  const other = host();
  const stopOther = watchConditions(other, { sources: partial.values });
  partial.settings({ reduceMotion: false });
  partial.answer({ reduceMotion: true, fontScale: 2 });
  await Promise.resolve();
  assert.equal(
    other.measurements,
    1,
    'a motion event does not suppress an independent scale snapshot',
  );
  // Its start already says no reduced motion, so the late snapshot's `true` must not be sent.
  assert.deepEqual(other.updates, [], 'the motion event kept the start, so nothing was sent');
  stopOther();
});

test('dark class opt-out, async failures, scale event precedence and explicit teardown', async () => {
  const feed = sources();
  const target = host();
  const stop = watchConditions(target, { darkClass: false, sources: feed.values });
  assert.equal(target.classes.size, 0);
  feed.settings({ fontScale: 2 });
  feed.answer({ reduceMotion: true, fontScale: 1 });
  await Promise.resolve();
  assert.equal(target.measurements, 1);
  assert.equal(target.updates.at(-1)?.reducedMotion, true);
  stop();
  const failure = sources();
  const fresh = host();
  const second = watchConditions(fresh, {
    sources: {
      ...failure.values,
      settings: {
        ...failure.values.settings,
        current: () => Promise.reject(new Error('unavailable')),
      },
    },
  });
  await Promise.resolve();
  assert.deepEqual(fresh.updates, [], 'a failed settings read leaves the start as it was');
  second();
});

test('watcher releases partial setup and continues teardown after a removal throws', () => {
  const target = host();
  const feed = sources();
  assert.throws(
    () =>
      watchConditions(target, {
        sources: {
          ...feed.values,
          colors: {
            current: () => 'light',
            subscribe: () => {
              throw new Error('subscribe');
            },
          },
        },
      }),
    /subscribe/,
  );
  assert.deepEqual(feed.removals, [1, 0, 0]);
  const all = sources();
  const failure = watchConditions(target, {
    sources: {
      ...all.values,
      settings: {
        current: () => ({ reduceMotion: false, fontScale: 1 }),
        subscribe: () => () => {
          throw new Error('remove');
        },
      },
    },
  });
  assert.throws(failure, /Condition source cleanup failed/);
  failure();
  assert.deepEqual(all.removals, [1, 1, 0]);
});

test('owner disposal during subscription removes just-returned listener and skips all snapshots', () => {
  const feed = sources();
  let removals = 0;
  let reads = 0;
  createRoot((dispose) => {
    watchConditions(host(), {
      sources: {
        ...feed.values,
        screen: {
          current: () => {
            reads++;
            return feed.values.screen.current();
          },
          subscribe: () => {
            dispose();
            return () => {
              removals++;
            };
          },
        },
      },
    });
  });
  assert.equal(removals, 1);
  assert.equal(reads, 0);
  assert.deepEqual(feed.removals, [0, 0, 0]);
});

test('native conditions read dimensions/settings and clean partial native subscriptions', async () => {
  let dimensions!: (value: {
    window: { width: number; height: number };
    screen: { width: number; height: number };
  }) => void;
  let removes = 0;
  const sizes = screenSource({
    Dimensions: {
      get: () => ({ width: 100, height: 200 }),
      addEventListener: (_name, listener) => {
        dimensions = listener;
        return {
          remove: () => {
            removes++;
          },
        };
      },
    },
  });
  assert.equal(sizes.current().window.width, 100);
  let width = 0;
  const stopSize = sizes.subscribe((value) => {
    width = value.window.width;
  });
  dimensions({ window: { width: 500, height: 600 }, screen: { width: 500, height: 600 } });
  assert.equal(width, 500);
  stopSize();
  let motion!: (value: boolean) => void;
  let foreground!: (value: string) => void;
  const native = {
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => true,
      isScreenReaderEnabled: async () => false,
      isBoldTextEnabled: async () => false,
      announceForAccessibility: () => {},
      addEventListener: (_name: string, listener: (value: boolean) => void) => {
        motion = listener;
        return {
          remove: () => {
            removes++;
          },
        };
      },
    },
    AppState: {
      currentState: 'active',
      addEventListener: (_name: 'change', listener: (value: string) => void) => {
        foreground = listener;
        return {
          remove: () => {
            removes++;
          },
        };
      },
    },
    PixelRatio: { get: () => 3, getFontScale: () => 2 },
  };
  const settings = conditionSettingsSource(native);
  assert.deepEqual(await settings.current(), { reduceMotion: true, fontScale: 2 });
  const events: Partial<ConditionSettings>[] = [];
  const stop = settings.subscribe((value) => {
    events.push(value);
  });
  motion(false);
  foreground('background');
  foreground('active');
  assert.deepEqual(events, [{ reduceMotion: false }, { fontScale: 2 }]);
  stop();
  stop();
  assert.equal(removes, 3);
  const broken = {
    ...native,
    AppState: {
      ...native.AppState,
      addEventListener: () => {
        throw new Error('partial');
      },
    },
  };
  assert.throws(() => conditionSettingsSource(broken).subscribe(() => {}), /partial/);
  assert.equal(removes, 4);
  const throwingMotion = {
    ...native,
    AccessibilityInfo: {
      ...native.AccessibilityInfo,
      addEventListener: () => ({
        remove: () => {
          throw new Error('native remove');
        },
      }),
    },
  };
  const complete = conditionSettingsSource(throwingMotion).subscribe(() => {});
  assert.throws(complete, /Condition settings cleanup failed/);
  assert.equal(removes, 5, 'foreground still removed after motion failure');
  complete();
  const bothFailures = { ...throwingMotion, AppState: broken.AppState };
  assert.throws(() => conditionSettingsSource(bothFailures).subscribe(() => {}), /partial/);
  const fallback = conditionSettingsSource(null);
  assert.deepEqual(await fallback.current(), { reduceMotion: false, fontScale: 1 });
  fallback.subscribe(() => {})();
  assert.deepEqual(screenSource(null).current().window, { width: 0, height: 0 });
  screenSource(null).subscribe(() => {})();
});

test('off-device defaults and explicit density injection keep optional native loading lazy', async () => {
  const defaults = conditionSources();
  assert.deepEqual(currentConditions(defaults), {
    width: 0,
    height: 0,
    colorScheme: 'light',
    reducedMotion: false,
  });
  assert.equal(defaults.fontScale(), 1);
  assert.deepEqual(deviceTokens(), {});
  assert.deepEqual(
    deviceTokens(() => 0.5),
    { '--hairline': { length: 0.5 } },
  );
  const stop = watchConditions(host());
  await Promise.resolve();
  stop();
});
