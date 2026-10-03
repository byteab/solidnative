import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

test('feature subpaths import without optional native modules or React', async () => {
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (/^(?:react(?:-native)?(?:\/|$)|expo(?:-|\/|$)|@expo\/)/.test(specifier))
        throw Error(`Eager optional import: ${specifier}`);
      return next(specifier, context);
    },
  });
  try {
    for (const name of [
      'camera',
      'database',
      'dom-component',
      'language-model',
      'map-view',
      'player',
    ])
      assert.ok(Object.keys(await import(`../src/solid/${name}.ts`)).length);
  } finally {
    hook.deregister();
  }
});
