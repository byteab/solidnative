import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
test('icons load only plain SVG data machinery and canonical Solid host', async () => {
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (/^(?:react(?:-native)?(?:\/|$)|react-native-svg)/.test(specifier))
        throw new Error(`Icon imported ${specifier}`);
      return next(specifier, context);
    },
  });
  try {
    for (const module of [
      await import('@solidnative/icons'),
      await import('@solidnative/icons/solid'),
    ]) {
      assert.equal(typeof module.Icon, 'function');
      assert.equal(typeof module.IconProvider, 'function');
    }
  } finally {
    hook.deregister();
  }
});
