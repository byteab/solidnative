import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { createObserved } from '@solid-native/device/solid';

test('observed source rejects stale reads and retained callbacks after owner disposal', async () => {
  let resolve!: (value: number) => void;
  let emit!: (value: number) => void;
  let removals = 0;
  let dispose!: () => void;
  const observed = createRoot((cleanup) => {
    dispose = cleanup;
    return createObserved(
      {
        current: () => new Promise<number>((done) => (resolve = done)),
        subscribe: (listener) => {
          emit = listener;
          return () => removals++;
        },
      },
      0,
    );
  });
  emit(2);
  resolve(1);
  await Promise.resolve();
  assert.equal(observed(), 2);
  dispose();
  emit(3);
  assert.equal(observed(), 2);
  assert.equal(removals, 1);
});

test('observed source preserves fallback on failure and accepts initial read before events', async () => {
  let dispose!: () => void;
  const values = createRoot((cleanup) => {
    dispose = cleanup;
    return [
      createObserved({ current: () => Promise.resolve(5), subscribe: () => () => {} }, 0),
      createObserved(
        { current: () => Promise.reject(new Error('unsupported')), subscribe: () => () => {} },
        1,
      ),
      createObserved(
        {
          current: () => {
            throw new Error('unsupported');
          },
          subscribe: () => () => {},
        },
        2,
      ),
      createObserved(null, 3),
    ];
  });
  await Promise.resolve();
  assert.deepEqual(
    values.map((value) => value()),
    [5, 1, 2, 3],
  );
  dispose();
  assert.throws(() => createObserved(null, 0), /active Solid owner/);
});

test('an initial async answer after disposal cannot mutate its accessor', async () => {
  let resolve!: (value: number) => void;
  const value = createRoot((dispose) => {
    const result = createObserved(
      { current: () => new Promise<number>((done) => (resolve = done)), subscribe: () => () => {} },
      1,
    );
    dispose();
    return result;
  });
  resolve(2);
  await Promise.resolve();
  assert.equal(value(), 1);
});

test('a source that disposes its owner during subscribe still releases the returned listener', () => {
  let removals = 0;
  let reads = 0;
  createRoot((dispose) => {
    createObserved(
      {
        current: () => ++reads,
        subscribe: () => {
          dispose();
          return () => removals++;
        },
      },
      0,
    );
  });
  assert.equal(removals, 1);
  assert.equal(reads, 0);
});

test('the listener is installed before a getter can emit a newer value than its snapshot', async () => {
  let emit!: (value: number) => void;
  let dispose!: () => void;
  const value = createRoot((cleanup) => {
    dispose = cleanup;
    return createObserved(
      {
        current: () => {
          emit(7);
          return 4;
        },
        subscribe: (listener) => {
          emit = listener;
          return () => {};
        },
      },
      0,
    );
  });
  await Promise.resolve();
  assert.equal(value(), 7);
  dispose();
});
