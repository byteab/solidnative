/**
 * `Tracking`, over a fake of `expo-tracking-transparency` that records every call.
 *
 * The permission is App Tracking Transparency's: asked once, and the advertising identifier is
 * only worth reading once it is granted.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Tracking, type NativeTracking } from '@solidnative/expo/tracking';
import { disposeServices, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

function platform(options: { granted?: boolean; available?: boolean; id?: string | null } = {}) {
  const { granted = true, available = true, id = 'ad-id' } = options;
  const calls: string[] = [];
  const answer = {
    status: granted ? 'granted' : 'denied',
    granted,
    canAskAgain: true,
    expires: 'never',
  } as const;
  const native = {
    getTrackingPermissionsAsync: async () => (calls.push('getTrackingPermissionsAsync'), answer),
    requestTrackingPermissionsAsync: async () => (
      calls.push('requestTrackingPermissionsAsync'),
      answer
    ),
    isAvailable: () => (calls.push('isAvailable'), available),
    getAdvertisingId: () => (calls.push('getAdvertisingId'), id),
  } as unknown as NativeTracking;
  return Object.assign(native, { calls });
}

const serviceOn = (native: NativeTracking | null) => serviceWith(Tracking, native);

describe('tracking', () => {
  it('checks and asks for the permission through the module s own pair', async () => {
    const native = platform();
    const tracking = serviceOn(native);
    assert.equal(await tracking.permission.check(), true);
    assert.equal(await tracking.permission.request(), true);
    assert.deepEqual(native.calls, [
      'getTrackingPermissionsAsync',
      'requestTrackingPermissionsAsync',
    ]);
    assert.equal(tracking.permission.granted(), true);
  });

  it('reaches the rest of the module under its own names, and hands back its answers', () => {
    const native = platform();
    const tracking = serviceOn(native);
    assert.equal(tracking.available(), true);
    assert.equal(tracking.advertisingId(), 'ad-id');
    assert.deepEqual(native.calls, ['isAvailable', 'getAdvertisingId']);
  });

  it('follows a refusal', async () => {
    const tracking = serviceOn(platform({ granted: false, id: null }));
    assert.equal(await tracking.permission.ensure(), false);
    assert.equal(tracking.advertisingId(), null);
  });

  it('is inert rather than broken with no module installed', async () => {
    const tracking = serviceOn(null);
    assert.equal(await tracking.permission.ensure(), false);
    assert.equal(tracking.permission.blocked(), true);
    assert.equal(tracking.available(), false);
    assert.equal(tracking.advertisingId(), null);
  });
});
