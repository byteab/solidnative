import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solidnative/device/solid';
import { Clipboard } from '@solidnative/expo/solid/clipboard';
import { FileSystem, type NativeFile } from '@solidnative/expo/solid/file-system';
import { Haptics } from '@solidnative/expo/solid/haptics';
import { AppleSignIn } from '@solidnative/expo/solid/apple-sign-in';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import { ExpoPage } from '../src/app/expo/expo.solid.tsx';
import { NativeViewsPage } from '../src/app/expo/native-views.solid.tsx';
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} Expo modules retain images, clipboard, file IO and haptics`, async (t) => {
    let text = '',
      content = '',
      impacts = 0,
      changes!: () => void,
      removed = 0;
    let pending: ReturnType<typeof deferred<string>> | undefined;
    const file: NativeFile = {
      uri: 'cache/canary.txt',
      exists: false,
      get size() {
        return content.length;
      },
      create() {},
      write(value) {
        content = String(value);
      },
      text: async () => content,
      textSync: () => content,
      bytes: async () => new Uint8Array(),
      delete() {},
    };
    const fixture = consumerFixture(
      () => [
        { path: 'expo', component: ExpoPage },
        { path: 'cover', component: () => null },
      ],
      [
        provideService(Clipboard.SOURCE, () => ({
          getStringAsync: () => pending?.promise ?? Promise.resolve(text),
          setStringAsync: async (value) => {
            text = value;
            changes();
            return true;
          },
          addClipboardListener: (listener) => {
            changes = listener;
            return {
              remove: () => {
                removed++;
              },
            };
          },
        })),
        provideService(FileSystem.SOURCE, () => ({
          cacheDirectory: {},
          documentDirectory: {},
          file: (_directory, name) => {
            assert.equal(name, 'canary.txt');
            return file;
          },
        })),
        provideService(Haptics.SOURCE, () => ({
          impactAsync: async () => {
            impacts++;
          },
          notificationAsync: async () => {},
          selectionAsync: async () => {},
        })),
      ],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/expo');
    h.finish();
    assert.ok(h.nodes().some((n) => JSON.stringify(n.props).includes('local.png')));
    h.press('Copy');
    await h.waitFor(() => h.renderedText().includes('Copied: Solid Native'));
    assert.match(h.renderedText(), /pasteboard has changed 1 times/);
    h.press('Paste');
    await h.waitFor(() => h.renderedText().includes('Pasted: Solid Native'));
    h.press('Write and read back');
    assert.match(h.renderedText(), /written at .* bytes/);
    h.press('Impact');
    assert.equal(impacts, 1);
    pending = deferred<string>();
    h.press('Paste');
    await nav.push('/cover');
    h.finish();
    await nav.back();
    h.finish();
    pending.resolve('stale covered answer');
    await new Promise((resolve) => setTimeout(resolve, 0));
    h.clock.flushMicrotasks();
    assert.doesNotMatch(h.renderedText(), /stale covered answer/);
    h.root.dispose();
    assert.equal(removed, 1);
    assert.deepEqual(fixture.errors, []);
  });
}
test('actual native views ignore a stale availability snapshot and a covered sign-in answer', async (t) => {
  const available = deferred<boolean>(),
    credential = deferred<null>();
  let starts = 0;
  const fixture = consumerFixture(
    () => [
      { path: 'native-views', component: NativeViewsPage },
      { path: 'cover', component: () => null },
    ],
    [
      provideService(AppleSignIn, () => ({
        revoked: () => 0,
        available: () => available.promise,
        signIn: () => {
          starts++;
          return credential.promise;
        },
        refresh: async () => null,
        signOut: async () => null,
        credentialState: async () => null,
        formatName: () => '',
      })),
    ],
  );
  const h = bootConsumer(fixture),
    nav = fixture.navigation();
  t.after(() => h.root.dispose());
  await nav.reset('/native-views');
  h.finish();
  const apple = h.nodes().find((n) => n.props['accessibilityLabel'] === 'Continue with Apple')!;
  assert.ok(apple);
  assert.equal(apple.props['buttonType'], 1);
  h.fabric.emit(apple, 'topButtonPress');
  h.clock.flushMicrotasks();
  assert.equal(starts, 1);
  assert.match(h.renderedText(), /Signing in\./);
  available.resolve(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  h.clock.flushMicrotasks();
  assert.match(h.renderedText(), /Signing in\./);
  await nav.push('/cover');
  h.finish();
  await nav.back();
  h.finish();
  credential.resolve(null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  h.clock.flushMicrotasks();
  assert.doesNotMatch(h.renderedText(), /Cancelled\./);
  h.root.dispose();
  assert.deepEqual(fixture.errors, []);
});
