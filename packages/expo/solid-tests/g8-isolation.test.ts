import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

test('all public Solid Expo subpaths remain lazy and independent of framework/native module execution', async () => {
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (
        /^(?:react(?:-native)?(?:\/|$)|expo(?:-|\/|$)|@expo\/|@react-native-async-storage\/)/.test(
          specifier,
        )
      )
        throw new Error(`Eager forbidden import: ${specifier}`);
      return next(specifier, context);
    },
  });
  try {
    for (const name of [
      'battery',
      'network',
      'clipboard',
      'haptics',
      'brightness',
      'orientation',
      'keep-awake',
      'locale',
      'store',
      'crypto',
      'browser',
    ]) {
      const module = await import(`@solid-native/expo/solid/${name}`);
      assert.ok(Object.keys(module).length);
    }
    const root = await import('@solid-native/expo/solid');
    assert.equal(typeof root.Permission, 'function');
  } finally {
    hook.deregister();
  }
});
