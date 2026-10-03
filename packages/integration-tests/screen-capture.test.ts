/**
 * `ScreenCapture`, over a fake of `expo-screen-capture` that records every call.
 *
 * Screenshots taken are a signal, counted rather than held, since the event carries nothing; the
 * listener behind it ends with the app. The rest is the module's own functions.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ScreenCapture, type NativeScreenCapture } from '@solid-native/expo/screen-capture';
import { disposeServices, ownedService, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

function platform(granted = true) {
  const calls: unknown[][] = [];
  let screenshot: (() => void) | undefined;
  const record =
    <T>(name: string, answer?: T) =>
    async (...args: unknown[]) => (calls.push([name, ...args]), answer);
  const answer = { status: granted ? 'granted' : 'denied', granted, canAskAgain: true };
  const native = {
    isAvailableAsync: record('isAvailableAsync', true),
    preventScreenCaptureAsync: record('preventScreenCaptureAsync'),
    allowScreenCaptureAsync: record('allowScreenCaptureAsync'),
    enableAppSwitcherProtectionAsync: record('enableAppSwitcherProtectionAsync'),
    disableAppSwitcherProtectionAsync: record('disableAppSwitcherProtectionAsync'),
    getPermissionsAsync: record('getPermissionsAsync', answer),
    requestPermissionsAsync: record('requestPermissionsAsync', answer),
    addScreenshotListener: (listener: () => void) => {
      screenshot = listener;
      return { remove: () => void calls.push(['remove']) };
    },
  } as unknown as NativeScreenCapture;
  return Object.assign(native, { calls, screenshot: () => screenshot?.() });
}

const serviceOn = (native: NativeScreenCapture | null) => serviceWith(ScreenCapture, native);

describe('screen capture', () => {
  it('counts the screenshots taken', () => {
    const native = platform();
    const capture = serviceOn(native);
    assert.equal(capture.screenshots(), 0);
    native.screenshot();
    native.screenshot();
    assert.equal(capture.screenshots(), 2);
  });

  it('reaches every function of the module under its own name, with its arguments', async () => {
    const native = platform();
    const capture = serviceOn(native);
    assert.equal(await capture.available(), true);
    await capture.prevent('payment');
    await capture.allow('payment');
    await capture.prevent();
    await capture.allow();
    await capture.protectAppSwitcher(0.8);
    await capture.unprotectAppSwitcher();
    assert.deepEqual(native.calls, [
      ['isAvailableAsync'],
      ['preventScreenCaptureAsync', 'payment'],
      ['allowScreenCaptureAsync', 'payment'],
      ['preventScreenCaptureAsync', undefined],
      ['allowScreenCaptureAsync', undefined],
      ['enableAppSwitcherProtectionAsync', 0.8],
      ['disableAppSwitcherProtectionAsync'],
    ]);
  });

  it('checks and asks for the permission through the module s own pair', async () => {
    const native = platform(false);
    const capture = serviceOn(native);
    assert.equal(await capture.permission.ensure(), false);
    assert.deepEqual(
      native.calls.map(([name]) => name),
      ['getPermissionsAsync', 'requestPermissionsAsync'],
    );
  });

  it('stops listening when the app is destroyed', () => {
    const native = platform();
    const service = ownedService(ScreenCapture, native);
    void service.value;
    service.stop();
    assert.deepEqual(native.calls, [['remove']]);
  });

  it('is inert rather than broken with no module installed', async () => {
    const capture = serviceOn(null);
    assert.equal(capture.screenshots(), 0);
    assert.equal(await capture.available(), false);
    assert.equal(await capture.permission.ensure(), false);
    await capture.prevent();
    await capture.allow();
    await capture.protectAppSwitcher();
    await capture.unprotectAppSwitcher();
  });
});
