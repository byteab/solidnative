/**
 * Device state that changes while the app is open, as signals.
 *
 * Every one of these modules is the same three things: a getter, a listener, and a React hook
 * that is those two plus state. The hook is the only surface some of them offer for reading a
 * value *over time*, and it is the one thing that cannot come across - so it is what is rebuilt
 * here, once, and the modules are thin bindings onto it.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  createObserved as observed,
  type ObservedSource as Observed,
} from '@solid-native/device/solid';
import { Battery } from '@solid-native/expo/battery';
import { Brightness } from '@solid-native/expo/brightness';
import { Network, type NetworkStatus } from '@solid-native/expo/network';
import { DeviceOrientation } from '@solid-native/expo/orientation';
import { disposeServices, owned, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A platform that answers once and can then be made to change its mind. */
function source<T>(first: T) {
  let listener: ((value: T) => void) | null = null;
  const api: Observed<T> & { emit(value: T): void; subscribed: boolean } = {
    subscribed: false,
    current: async () => first,
    subscribe: (next) => {
      listener = next;
      api.subscribed = true;
      return () => {
        listener = null;
        api.subscribed = false;
      };
    },
    emit: (value) => listener?.(value),
  };
  return api;
}

describe('a value the platform keeps telling us about', () => {
  it('starts at the stated default, because every getter here is asynchronous', () => {
    // Even when the platform already knows, the answer is a turn away. A signal that started
    // undefined would make every consumer handle a state that lasts one tick.
    const { value } = owned(() => observed(source(0.5), 1));
    assert.equal(value(), 1);
  });

  it('keeps a change the listener heard before the first answer came back', async () => {
    // The first answer was asked for first and can arrive last: a network that dropped while the
    // app was starting reported "offline" through the listener, then the first read's older
    // "online" landed on top of it and stayed.
    let answer: (value: number) => void = () => {};
    let listener: (value: number) => void = () => {};
    const platform: Observed<number> = {
      current: () => new Promise((resolve) => (answer = resolve)),
      subscribe: (next) => ((listener = next), () => {}),
    };
    const { value } = owned(() => observed(platform, 1));
    listener(0.2);
    answer(0.9);
    await settle();
    assert.equal(value(), 0.2);
  });

  it('takes the first answer, then follows the listener', async () => {
    const platform = source(0.5);
    const { value } = owned(() => observed(platform, 1));
    await settle();
    assert.equal(value(), 0.5);

    platform.emit(0.2);
    assert.equal(value(), 0.2);
  });

  it('stops listening when the owner it was made under is disposed', () => {
    // A root service's owner is the app's, so this is the listener going with the app.
    const platform = source(0.5);
    const { stop } = owned(() => observed(platform, 1));
    assert.equal(platform.subscribed, true);
    stop();
    assert.equal(platform.subscribed, false);
  });

  it('is the default forever when the module is not installed', async () => {
    const { value } = owned(() => observed<number>(null, 1));
    await settle();
    assert.equal(value(), 1);
  });
});

describe('the network', () => {
  it('separates having a connection from being able to reach anything', async () => {
    // A captive-portal wifi is connected and reachable by nothing, which is the case an offline
    // banner exists for and the one a boolean would get wrong.
    const platform = source<NetworkStatus>({ connected: true, type: 'wifi', reachable: null });
    const network = serviceWith(Network, platform);
    await settle();

    assert.equal(network.connected(), true);
    assert.equal(network.reachable(), null, 'not yet established, which is not offline');

    platform.emit({ connected: true, type: 'wifi', reachable: false });
    assert.equal(network.reachable(), false);
  });
});

describe('the battery', () => {
  const build = (level: number, state: 'charging' | 'unplugged') =>
    serviceWith(Battery, { level: source(level), state: source(state), saving: source(false) });

  it('calls it low only when it is not going up', async () => {
    const draining = build(0.15, 'unplugged');
    const charging = build(0.15, 'charging');
    await settle();

    assert.equal(draining.low(), true);
    assert.equal(charging.low(), false, 'plugged in at 15% is not a reason to do less');
  });

  /**
   * iOS answers `-1` where the battery level is unavailable - every simulator, and a device that
   * will not say - and Expo passes it through. Taken at face value it is below every threshold an
   * app has, so `low` fires and the app starts shedding work on the one device with no battery to
   * save. Seen on a simulator reading "-100%", which is what sent anyone looking.
   */
  it('does not read the platform\'s "I cannot tell" as an empty battery', async () => {
    const battery = serviceWith(Battery, {
      level: source(-1),
      state: source('unknown' as const),
      saving: source(false),
    });
    await settle();

    assert.equal(battery.known(), false, 'the platform has not said');
    assert.equal(battery.level(), 1, 'and the default stands rather than a negative level');
    assert.equal(battery.low(), false, 'so nothing degrades itself over it');
  });

  it('still reports a genuinely low battery', async () => {
    const battery = serviceWith(Battery, {
      level: source(0.08),
      state: source('unplugged' as const),
      saving: source(false),
    });
    await settle();

    assert.equal(battery.known(), true);
    assert.equal(battery.low(), true);
  });

  it('starts full, because an app should not open in its degraded mode', async () => {
    assert.equal(build(0.05, 'unplugged').low(), false);
  });
});

describe('orientation', () => {
  it('hands back the way to undo a lock', async () => {
    const calls: string[] = [];
    const orientation = serviceWith(DeviceOrientation, {
      reported: source('portrait' as const),
      lock: async (lock: string) => void calls.push(`lock:${lock}`),
      unlock: async () => void calls.push('unlock'),
    });

    const release = orientation.lock('landscape');
    await settle();
    release();
    await settle();

    assert.deepEqual(calls, ['lock:landscape', 'unlock']);
  });

  it('puts back the lock of the screen below when the one above releases its own', async () => {
    // A video screen locked to landscape pushes a portrait-locked form, and Back pops it. The
    // form's release unlocked the whole app, and the video screen below lost its lock.
    const calls: string[] = [];
    const orientation = serviceWith(DeviceOrientation, {
      reported: source('portrait' as const),
      lock: async (lock: string) => void calls.push(`lock:${lock}`),
      unlock: async () => void calls.push('unlock'),
    });

    // Native writes are queued, and a write superseded before it runs is skipped, so each step
    // settles before the next.
    const releaseBelow = orientation.lock('landscape');
    await settle();
    const releaseAbove = orientation.lock('portrait');
    await settle();
    releaseAbove();
    await settle();
    assert.deepEqual(calls, ['lock:landscape', 'lock:portrait', 'lock:landscape']);

    releaseAbove();
    releaseBelow();
    await settle();
    assert.equal(calls.at(-1), 'unlock', 'and unlocks once nothing holds a lock');
    assert.equal(calls.filter((call) => call === 'unlock').length, 1);
  });

  it('is about the device, not the window', async () => {
    // A screen pinned to portrait still has a phone that is sideways, which is what a camera
    // preview needs to know.
    const orientation = serviceWith(DeviceOrientation, {
      reported: source('landscape-left' as const),
      lock: async () => {},
      unlock: async () => {},
    });
    await settle();
    assert.equal(orientation.landscape(), true);
  });
});

describe('brightness', () => {
  it('hands back the way to put it back', async () => {
    // An app that leaves the screen at full brightness after showing a boarding pass is an app
    // the user experiences as a battery fault.
    const calls: string[] = [];
    const brightness = serviceWith(Brightness, {
      get: async () => 0.4,
      set: async (level) => void calls.push(`set:${level}`),
      restore: async () => void calls.push('restore'),
    });
    await settle();
    assert.equal(brightness.level(), 0.4);

    const restore = brightness.set(1);
    assert.equal(brightness.level(), 1, 'immediately, without waiting for the platform');
    // Native writes are queued, and one superseded before it runs is skipped.
    await settle();
    restore();
    await settle();

    assert.deepEqual(calls, ['set:1', 'restore']);
  });

  it('puts back the level of the screen below when the one above restores its own', async () => {
    // A boarding pass at full brightness pushes a dimmed screen over it; popping that restored
    // the system level under the boarding pass, which is the screen that needed it.
    const calls: string[] = [];
    const brightness = serviceWith(Brightness, {
      get: async () => 0.4,
      set: async (level) => void calls.push(`set:${level}`),
      restore: async () => void calls.push('restore'),
    });
    await settle();

    const restoreBelow = brightness.set(1);
    await settle();
    const restoreAbove = brightness.set(0.2);
    await settle();
    restoreAbove();
    await settle();
    assert.deepEqual(calls, ['set:1', 'set:0.2', 'set:1']);
    assert.equal(brightness.level(), 1);

    restoreBelow();
    await settle();
    assert.equal(calls.at(-1), 'restore');
  });

  it('refuses to ask for a level outside the range the platform has', async () => {
    const calls: number[] = [];
    const brightness = serviceWith(Brightness, {
      get: async () => 1,
      set: async (level) => void calls.push(level),
      restore: async () => {},
    });
    brightness.set(4);
    await settle();
    assert.deepEqual(calls, [1]);
  });
});
