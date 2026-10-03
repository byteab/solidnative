/**
 * `StoreReview`, over a fake of `expo-store-review` that records every call.
 *
 * Each method reaches the module's function under its own name, passes its answer back, and
 * answers no rather than throwing when the module is not there.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { StoreReview, type NativeStoreReview } from '@solid-native/expo/store-review';
import { disposeServices, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

function platform(options: { available?: boolean; url?: string | null } = {}) {
  const { available = true, url = 'https://apps.apple.com/app/id1' } = options;
  const calls: string[] = [];
  const native: NativeStoreReview = {
    isAvailableAsync: async () => (calls.push('isAvailableAsync'), available),
    hasAction: async () => (calls.push('hasAction'), available || url !== null),
    requestReview: async () => void calls.push('requestReview'),
    storeUrl: () => (calls.push('storeUrl'), url),
  };
  return Object.assign(native, { calls });
}

const serviceOn = (native: NativeStoreReview | null) => serviceWith(StoreReview, native);

describe('store review', () => {
  it('reaches every function of the module under its own name, and hands back its answers', async () => {
    const native = platform();
    const review = serviceOn(native);
    assert.equal(await review.available(), true);
    assert.equal(await review.hasAction(), true);
    assert.equal(review.storeUrl(), 'https://apps.apple.com/app/id1');
    await review.request();
    assert.deepEqual(native.calls, ['isAvailableAsync', 'hasAction', 'storeUrl', 'requestReview']);
  });

  it('passes on a store with no review prompt and no URL', async () => {
    const review = serviceOn(platform({ available: false, url: null }));
    assert.equal(await review.available(), false);
    assert.equal(await review.hasAction(), false);
    assert.equal(review.storeUrl(), null);
  });

  it('is inert rather than broken with no module installed', async () => {
    const review = serviceOn(null);
    assert.equal(await review.available(), false);
    assert.equal(await review.hasAction(), false);
    assert.equal(review.storeUrl(), null);
    await review.request();
  });
});
