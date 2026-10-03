import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catchError, createEffect, createRoot, createSignal, onCleanup } from 'solid-js';
import { mountNative } from '@solid-native/platform/solid';
import {
  createServiceToken,
  provideService,
  useService,
  withServiceScope,
  type ServiceToken,
} from '@solid-native/device/solid';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';
import { serviceFixture } from './service-fixture.tsx';

function source() {
  let listener: ((value: number) => void) | undefined;
  let subscriptions = 0;
  let removals = 0;
  return {
    current: () => Promise.resolve(0),
    subscribe(next: (value: number) => void) {
      listener = next;
      subscriptions++;
      return () => removals++;
    },
    emit: (value: number) => listener?.(value),
    get subscriptions() {
      return subscriptions;
    },
    get removals() {
      return removals;
    },
  };
}

test('compiled providers share root subscriptions, override a screen and dispose on removal', () => {
  const rootSource = source();
  const innerSource = source();
  const fixture = serviceFixture(rootSource, innerSource);
  const fabric = createFakeFabric();
  const root = mountNative(fixture.render, { fabric, rootTag: 201 });
  assert.equal(rootSource.subscriptions, 1);
  assert.equal(innerSource.subscriptions, 0);
  rootSource.emit(7);
  root.flush();
  const children = fabric.roots.get(201)![0].children;
  assert.equal(children[0].children[0].props['text'], '7');
  assert.equal(children[1].children[0].props['text'], '7');
  fixture.setVisible(true);
  root.flush();
  assert.equal(innerSource.subscriptions, 1);
  innerSource.emit(11);
  root.flush();
  assert.equal(fabric.roots.get(201)![0].children[2].children[0].props['text'], '11');
  assert.equal(fixture.sample(), 7);
  fixture.setVisible(false);
  root.flush();
  assert.equal(innerSource.removals, 1);
  assert.equal(rootSource.removals, 0);
  root.dispose();
  root.dispose();
  assert.equal(rootSource.removals, 1);
  innerSource.emit(90);
  rootSource.emit(90);
  assert.equal(fixture.sample(), 7);
  assert.deepEqual(fabric.roots.get(201), []);
});

test('tokens are lazy, scope-local, identity-based and nearest explicit overrides win', () => {
  let calls = 0;
  const token = createServiceToken('same name', () => ++calls);
  const other = createServiceToken('same name', () => ++calls);
  createRoot((dispose) => {
    withServiceScope([], () => {
      assert.equal(calls, 0);
      assert.equal(useService(token), 1);
      assert.equal(useService(token), 1);
      assert.equal(useService(other), 2);
      withServiceScope([provideService(token, () => 99)], () => {
        assert.equal(useService(token), 99);
        assert.equal(useService(other), 2);
      });
    });
    withServiceScope([], () => assert.equal(useService(token), 3));
    dispose();
  });
  assert.throws(() => useService(token), /requires a ServiceScope/);
  assert.throws(() => withServiceScope([], () => 0), /active Solid owner/);
});

test('failed factories clean their effects and can retry without caching a partial service', () => {
  const [value, setValue] = createSignal(0);
  const effects: number[] = [];
  const errors: unknown[] = [];
  let attempts = 0;
  const token = createServiceToken('retry', () => {
    attempts++;
    createEffect(() => effects.push(value()));
    onCleanup(() => {
      throw new Error('cleanup failed');
    });
    if (attempts === 1) throw new Error('factory failed');
    return 'ready';
  });
  createRoot((dispose) => {
    withServiceScope(
      [],
      () => {
        assert.throws(() => useService(token), /factory failed/);
        assert.equal(useService(token), 'ready');
      },
      (error) => errors.push(error),
    );
    dispose();
  });
  const before = [...effects];
  setValue(1);
  assert.deepEqual(effects, before);
  assert.equal(attempts, 2);
  assert.equal(errors.length, 2);
});

test('scope disposal stops every service even if cleanup and the error reporter throw', () => {
  const [value, setValue] = createSignal(0);
  const effects: number[] = [];
  const cleaned: string[] = [];
  const a = createServiceToken('a', () => {
    createEffect(() => effects.push(value()));
    onCleanup(() => cleaned.push('a'));
    return 1;
  });
  const b = createServiceToken('b', () => {
    useService(a);
    onCleanup(() => cleaned.push('b'));
    onCleanup(() => {
      throw new Error('b failed');
    });
    return 2;
  });
  let dispose!: () => void;
  createRoot((cleanup) => {
    dispose = cleanup;
    withServiceScope(
      [],
      () => useService(b),
      () => {
        throw new Error('reporter failed');
      },
    );
  });
  assert.deepEqual(effects, [0]);
  dispose();
  setValue(1);
  assert.deepEqual(effects, [0]);
  assert.deepEqual(cleaned, ['b', 'a']);
});

test('duplicate overrides and circular factory dependencies fail with useful diagnostics', () => {
  const token: ServiceToken<number> = createServiceToken('loop', () => useService(token));
  createRoot((dispose) => {
    assert.throws(
      () =>
        withServiceScope([provideService(token, () => 1), provideService(token, () => 2)], () => 0),
      /Duplicate service override: loop/,
    );
    withServiceScope([], () => assert.throws(() => useService(token), /Circular service/));
    dispose();
  });
});

test('a factory that disposes the scope cannot strand a newly created service', () => {
  let cleanups = 0;
  createRoot((dispose) => {
    const token = createServiceToken('self disposal', () => {
      onCleanup(() => cleanups++);
      dispose();
      return 1;
    });
    withServiceScope([], () => {
      assert.throws(() => useService(token), /disposed while creating/);
      assert.throws(() => useService(token), /scope has been disposed/);
    });
  });
  assert.equal(cleanups, 1);
});

test('an inherited error handler cannot turn a failed service factory into a cached result', () => {
  let cleanups = 0;
  let attempts = 0;
  const handled: unknown[] = [];
  const failure = new Error('factory rejected');
  const token = createServiceToken('boundary failure', () => {
    attempts++;
    onCleanup(() => cleanups++);
    throw failure;
  });
  createRoot((dispose) => {
    catchError(
      () =>
        withServiceScope([], () => {
          assert.throws(
            () => useService(token),
            (error) => error === failure,
          );
          assert.throws(
            () => useService(token),
            (error) => error === failure,
          );
        }),
      (error) => handled.push(error),
    );
    dispose();
  });
  assert.equal(attempts, 2);
  assert.equal(cleanups, 2);
  assert.deepEqual(handled, []);
});

test('a handled scope render failure immediately releases services and child computations', () => {
  const [value, setValue] = createSignal(0);
  const effects: number[] = [];
  const cleaned: string[] = [];
  const failure = new Error('screen failed');
  const handled: unknown[] = [];
  const token = createServiceToken('screen', () => {
    onCleanup(() => cleaned.push('service'));
    createEffect(() => effects.push(value()));
    return 1;
  });
  let dispose!: () => void;
  createRoot((cleanup) => {
    dispose = cleanup;
    catchError(
      () =>
        withServiceScope([], () => {
          useService(token);
          createEffect(() => effects.push(value()));
          onCleanup(() => cleaned.push('subtree'));
          throw failure;
        }),
      (error) => handled.push(error),
    );
  });
  assert.deepEqual(handled, [failure]);
  assert.deepEqual(cleaned, ['subtree', 'service']);
  const before = [...effects];
  setValue(1);
  assert.deepEqual(effects, before);
  dispose();
  assert.deepEqual(cleaned, ['subtree', 'service']);
});
