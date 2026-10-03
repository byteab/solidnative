import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { createNativeRoot } from '@solid-native/platform/solid';
import * as registry from '../src/solid/dev-reload.ts';
const { registerModule } = createRequire(import.meta.url)(
  '@solid-native/metro/solid-reload-runtime.cjs',
);
import { createReloadFixture, createCleanupFailureFixture } from './reload-fixture.tsx';
import { createFakeFabric, createClock } from './fake-fabric.ts';

const key = Symbol.for('@solid-native/platform/solid/dev-reload/v1');
const globals = globalThis as typeof globalThis & { __DEV__?: boolean; [key]?: unknown };

function freshDevelopmentVM() {
  // Model only the registry reset performed by a native VM reload; this is not device evidence.
  delete globals[key];
  globals.__DEV__ = true;
}

function hotModule() {
  let dispose = () => {};
  return {
    module: {
      hot: {
        accept() {},
        dispose(callback: () => void) {
          dispose = callback;
        },
      },
    },
    update: () => dispose(),
  };
}

test('compiled TSX roots clean up across repeated reload requests, failures and fresh-VM recovery', () => {
  try {
    for (let generation = 0; generation < 4; generation++) {
      freshDevelopmentVM();
      const fabric = createFakeFabric();
      const clock = createClock();
      const fixture = createReloadFixture();
      const root = createNativeRoot({ fabric, clock, rootTag: 1 });
      root.render(fixture.View);
      const oldNode = fabric.roots.get(1)![0]!;
      fabric.emit(oldNode, 'topTouchEnd');
      clock.flushMicrotasks();
      assert.equal(fixture.count(), 1);
      assert.equal(fixture.cleanup.event, 1);
      const failed = createNativeRoot({ fabric, clock, rootTag: 11 });
      const broken = createReloadFixture(true);
      assert.throws(() => failed.render(broken.View), /broken development render/);
      assert.equal(failed.disposed, true);
      assert.deepEqual(broken.cleanup, { owner: 1, native: 1, event: 0 });
      const second = createNativeRoot({ fabric, clock, rootTag: 11 });
      const secondFixture = createReloadFixture();
      second.render(secondFixture.View);
      fixture.setCount(7);
      let afterCommit = 0;
      root.afterCommit(() => afterCommit++);
      const hot = hotModule();
      let reloads = 0;
      assert.equal(
        registerModule(
          hot.module,
          registry,
          () => {
            reloads++;
            assert.equal(root.disposed, true);
            assert.equal(second.disposed, true);
            assert.deepEqual(fabric.roots.get(1) ?? [], []);
            assert.deepEqual(fabric.roots.get(11), []);
          },
          'Reload.solid.tsx',
        ),
        true,
      );
      hot.update();
      hot.update();
      root.dispose();
      const commits = fabric.commits;
      fabric.emit(oldNode, 'topTouchEnd');
      fixture.setCount(99);
      clock.flushMicrotasks();
      assert.deepEqual(fixture.cleanup, { owner: 1, native: 1, event: 1 });
      assert.deepEqual(secondFixture.cleanup, { owner: 1, native: 1, event: 0 });
      assert.equal(afterCommit, 0);
      assert.equal(clock.frames.size, 0);
      assert.equal(fabric.commits, commits);
      assert.equal(reloads, 1);
      assert.equal(
        registerModule(hot.module, registry, () => reloads++, 'Replacement.solid.tsx'),
        false,
      );
      assert.throws(
        () => createNativeRoot({ fabric, clock, rootTag: 1 }),
        /awaiting a clean reload/,
      );
    }
    freshDevelopmentVM();
    const fabric = createFakeFabric();
    const recovered = createNativeRoot({ fabric, clock: createClock(), rootTag: 1 });
    const fixture = createReloadFixture();
    recovered.render(fixture.View);
    assert.equal(fixture.count(), 0, 'a new VM starts with fresh state');
    assert.equal(fabric.roots.get(1)!.length, 1);
    recovered.dispose();
  } finally {
    delete globals.__DEV__;
    delete globals[key];
  }
});

test('registry contains bad root cleanup and production roots remain outside reload ownership', (t) => {
  try {
    freshDevelopmentVM();
    const errors: unknown[] = [];
    t.mock.method(console, 'error', (error: unknown) => errors.push(error));
    const unregister = registry.registerNativeReloadRoot({
      dispose() {
        throw new Error('must not run');
      },
    });
    unregister();
    unregister();
    registry.registerNativeReloadRoot({
      dispose() {
        throw new Error('bad root');
      },
    });
    let cleanups = 0;
    registry.registerNativeReloadRoot({
      dispose() {
        cleanups++;
      },
    });
    assert.equal(registry.disposeNativeRootsForReload(), true);
    assert.equal(registry.disposeNativeRootsForReload(), false);
    assert.equal(cleanups, 1);
    assert.equal(errors.length, 1);
    delete globals[key];
    globals.__DEV__ = false;
    const root = createNativeRoot({ fabric: createFakeFabric(), clock: createClock(), rootTag: 1 });
    root.render(createReloadFixture().View);
    assert.equal(globals[key], undefined, 'production root does not initialize dev registry');
    registry.disposeNativeRootsForReload();
    assert.equal(root.disposed, false);
    root.dispose();
  } finally {
    delete globals.__DEV__;
    delete globals[key];
  }
});

for (const mode of ['normal disposal', 'failed mount', 'reload']) {
  test(`throwing owner cleanup preserves sibling teardown and cleanup order during ${mode}`, (t) => {
    try {
      freshDevelopmentVM();
      const errors: unknown[] = [];
      t.mock.method(console, 'error', () => {});
      const fabric = createFakeFabric();
      const root = createNativeRoot({
        fabric,
        clock: createClock(),
        rootTag: 1,
        engineOptions: {
          onError(error) {
            errors.push(error);
            throw new Error('reporter failure');
          },
        },
      });
      const fixture = createCleanupFailureFixture(mode === 'failed mount');
      if (mode === 'failed mount') assert.throws(() => root.render(fixture.View), /failed mount/);
      else {
        root.render(fixture.View);
        if (mode === 'reload') registry.disposeNativeRootsForReload();
        else root.dispose();
      }
      root.dispose();
      fixture.setValue(1);
      assert.deepEqual(
        fixture.values,
        [0],
        'sibling effect unsubscribes despite later cleanup failure',
      );
      assert.deepEqual(fixture.cleanups, ['throwing child', 'root', 'duplicate', 'duplicate']);
      assert.equal(errors.length, 1);
      assert.deepEqual(fabric.roots.get(1) ?? [], []);
    } finally {
      delete globals.__DEV__;
      delete globals[key];
    }
  });
}
