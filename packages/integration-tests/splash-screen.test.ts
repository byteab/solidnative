/**
 * Holding the splash screen until the app has something worth showing.
 *
 * The ordering is the whole feature and it is easy to get subtly wrong, so it is what is pinned
 * here: the native screen hides itself on the first frame, so an app that loads fonts before
 * mounting shows a blank window for as long as that takes.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Splash, type NativeSplashScreen } from '@solid-native/expo/splash-screen';

function recorder() {
  const calls: string[] = [];
  const native: NativeSplashScreen = {
    preventAutoHideAsync: async () => (calls.push('hold'), true),
    hideAsync: async () => void calls.push('hide'),
  };
  return { calls, native };
}

describe('the splash screen', () => {
  it('holds once, however many times it is asked', () => {
    const { calls, native } = recorder();
    const splash = new Splash(native);
    splash.hold();
    splash.hold();
    assert.deepEqual(calls, ['hold']);
  });

  it('waits for a frame after the work before uncovering it', async () => {
    // Hiding the moment the work resolves uncovers the frame that was on screen while it ran,
    // which is the empty one. The frame in between is what makes the handover invisible.
    const { calls, native } = recorder();
    const splash = new Splash(native);

    await splash.hideWhenReady(
      Promise.resolve().then(() => void calls.push('work')),
      async () => void calls.push('frame'),
    );
    assert.deepEqual(calls, ['work', 'frame', 'hide']);
  });

  it('uncovers anyway when the work fails, rather than leaving a splash forever', async () => {
    const { calls, native } = recorder();
    const splash = new Splash(native);

    await assert.rejects(
      splash.hideWhenReady(Promise.reject(new Error('no fonts')), async () => {}),
      /no fonts/,
    );
    assert.deepEqual(calls, ['hide'], 'the app is visible, in the fallback face');
  });

  it('is inert rather than broken when the module is not installed', async () => {
    const splash = new Splash(null);
    assert.equal(splash.available, false);
    splash.hold();
    await splash.hide();
  });
});
