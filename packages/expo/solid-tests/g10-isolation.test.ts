import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

test('startup/resource entries import without optional native modules or either old framework', async () => {
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (/^(?:react(?:-native)?(?:\/|$)|expo(?:-|\/|$)|@expo\/)/.test(specifier)) {
        throw Error(`Eager optional import: ${specifier}`);
      }
      return next(specifier, context);
    },
  });
  try {
    for (const name of ['app-info', 'assets', 'fonts', 'splash-screen', 'updates']) {
      const value = await import(`../src/solid/${name}.ts`);
      assert.ok(Object.keys(value).length);
    }
  } finally {
    hook.deregister();
  }
});
