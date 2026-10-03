/**
 * Motion sensors and locale, the two Expo modules whose only surface for reading over time is a
 * hook.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ORIGIN, Sensor, type Vector } from '@solidnative/expo/sensors';
import { Locale } from '@solidnative/expo/locale';
import { disposeServices, owned, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

/** Availability is answered on a microtask, even where the answer is a constant. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function sensor() {
  let listener: ((reading: Vector) => void) | null = null;
  return {
    interval: 0,
    listeners: 0,
    addListener(next: (reading: Vector) => void) {
      listener = next;
      this.listeners++;
      return {
        remove: () => {
          listener = null;
          this.listeners--;
        },
      };
    },
    setUpdateInterval(ms: number) {
      this.interval = ms;
    },
    isAvailableAsync: async () => true,
    emit: (reading: Vector) => listener?.(reading),
  };
}

describe('a sensor', () => {
  it('reports nothing until it is started', () => {
    // These fire faster than anything can usefully draw and every event is a change-detection
    // pass, so a sensor that subscribed on construction would be a phone that never idles.
    const native = sensor();
    const accelerometer = owned(() => new Sensor(native, ORIGIN)).value;

    assert.deepEqual(accelerometer.reading(), ORIGIN);
    assert.equal(native.listeners, 0);
  });

  it('reads at the interval it was asked for, and hands back the way to stop', () => {
    const native = sensor();
    const accelerometer = owned(() => new Sensor(native, ORIGIN)).value;

    const stop = accelerometer.start(50);
    assert.equal(native.interval, 50);
    native.emit({ x: 1, y: 2, z: 3 });
    assert.deepEqual(accelerometer.reading(), { x: 1, y: 2, z: 3 });

    stop();
    assert.equal(native.listeners, 0, 'a sensor nobody stops is a battery nobody gets back');
  });

  it('does not stack subscriptions when started twice', () => {
    const native = sensor();
    const accelerometer = owned(() => new Sensor(native, ORIGIN)).value;
    accelerometer.start();
    accelerometer.start();
    assert.equal(native.listeners, 1);
  });

  it('keeps reading for one component when another that started it stops', () => {
    // The sensor is one per app, and each component hands its own stop to its owner's cleanup. A
    // screen pushed over one that reads the accelerometer, and popped again, stopped it for both.
    const native = sensor();
    const accelerometer = owned(() => new Sensor(native, ORIGIN)).value;
    const stopBelow = accelerometer.start(100);
    const stopAbove = accelerometer.start(20);
    assert.equal(native.interval, 20, 'as often as the most demanding reader asks');

    stopAbove();
    assert.equal(native.listeners, 1, 'still reading for the screen below');
    assert.equal(native.interval, 100, 'and back to its own interval');
    native.emit({ x: 4, y: 5, z: 6 });
    assert.deepEqual(accelerometer.reading(), { x: 4, y: 5, z: 6 });

    stopAbove();
    assert.equal(native.listeners, 1, 'a stop called twice takes nothing more');
    stopBelow();
    assert.equal(native.listeners, 0);
  });

  it('is inert with no sensor at all', async () => {
    const accelerometer = owned(() => new Sensor<Vector>(null, ORIGIN)).value;
    // Null rather than false first: a screen asking `sensor.available()` should show
    // nothing while the platform is still answering, not "this device has no accelerometer".
    assert.equal(accelerometer.available(), null);
    await settle();
    assert.equal(accelerometer.available(), false);
    accelerometer.start()();
  });

  it('answers availability as a signal, so a template can ask', async () => {
    const accelerometer = owned(() => new Sensor(sensor(), ORIGIN)).value;
    await settle();
    assert.equal(accelerometer.available(), true);
  });
});

describe('the locale', () => {
  const locale = (tag: string, direction: 'ltr' | 'rtl' = 'ltr') => ({
    languageTag: tag,
    languageCode: tag.split('-')[0]!,
    regionCode: tag.split('-')[1] ?? null,
    textDirection: direction,
    measurementSystem: 'metric' as const,
  });

  function platform(first: string) {
    let tags = [first];
    let listener: (() => void) | null = null;
    return {
      locales: () => tags.map((tag) => locale(tag)),
      calendars: () => [],
      onChange: (next: () => void) => ((listener = next), () => {}),
      change: (tag: string) => {
        tags = [tag];
        listener?.();
      },
    };
  }

  it('reads the preferred one, and re-reads when the user changes it', () => {
    // The reason this is more than a re-export: a user can switch language in Settings and come
    // back, and a date that was formatted correctly is then wrong.
    const native = platform('en-GB');
    const state = serviceWith(Locale, native);
    assert.equal(state.tag(), 'en-GB');

    native.change('fr-FR');
    assert.equal(state.tag(), 'fr-FR');
  });

  it('says which way the layout runs, which is not a translation decision', () => {
    const state = serviceWith(Locale, {
      locales: () => [locale('ar-EG', 'rtl')],
      calendars: () => [],
      onChange: () => () => {},
    });
    assert.equal(state.rtl(), true);
  });

  it('gives no tag rather than guessing one when nothing is reported', () => {
    assert.equal(serviceWith(Locale, null).tag(), undefined);
  });
});
