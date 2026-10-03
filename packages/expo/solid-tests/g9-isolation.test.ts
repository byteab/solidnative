import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
test('new Expo entries execute without React or any optional native package', async () => {
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (/^(?:react(?:-native)?(?:\/|$)|expo(?:-|\/|$)|@expo\/)/.test(specifier))
        throw Error(`Eager optional import: ${specifier}`);
      return next(specifier, context);
    },
  });
  try {
    for (const name of ['file-system', 'sensors', 'apple-sign-in', 'expo-ui-components']) {
      const value = await import(`@solid-native/expo/solid/${name}`);
      assert.ok(Object.keys(value).length);
    }
  } finally {
    hook.deregister();
  }
});
