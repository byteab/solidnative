import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRoot } from '@solid-native/platform/solid';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';
import { createStatusShellFixture } from './g4-status-shell-fixture.tsx';

test('lazy route services compose status claims with actual native navigation front ownership', async () => {
  const styles: string[] = [];
  const fixture = createStatusShellFixture((style) => {
    styles.push(style);
    assert.ok(styles.length < 100, 'status source must settle without repeated application');
  });
  const fabric = createFakeFabric();
  const errors: unknown[] = [];
  const root = createNativeRoot({
    fabric,
    rootTag: 901,
    engineOptions: {
      onError: (error) => {
        errors.push(error);
      },
    },
  });
  root.render(fixture.View);
  const nav = fixture.navigation();
  assert.equal(await nav.reset('/'), true);
  nav.complete(nav.transition()!);
  root.flush();
  assert.equal(styles.at(-1), 'dark');
  fixture.theme('dark');
  root.flush();
  assert.equal(styles.at(-1), 'light');
  const home = nav.current()!;
  assert.equal(await nav.push('/detail'), true);
  nav.complete(nav.transition()!);
  root.flush();
  assert.equal(styles.at(-1), 'default');
  fixture.theme('light');
  root.flush();
  assert.equal(styles.at(-1), 'default');
  assert.equal(await nav.pop(), true);
  nav.complete(nav.transition()!);
  root.flush();
  assert.equal(nav.current(), home);
  assert.equal(styles.at(-1), 'dark');
  assert.deepEqual(errors, []);
  root.dispose();
  assert.deepEqual(errors, [], 'root teardown must not merely contain cleanup failures');
  assert.deepEqual(fixture.errors, [], 'route teardown must complete without cleanup errors');
  assert.deepEqual(fixture.cleanups, ['detail', 'home', 'color']);
});
