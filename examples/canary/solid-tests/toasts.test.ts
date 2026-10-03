import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { createToasts } from '../src/app/overlays/toasts.solid.ts';

test('toasts announce, replace, dismiss and stop after their owner is disposed', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const announcements: string[] = [];
  let dispose!: () => void;
  const toasts = createRoot((cleanup) => {
    dispose = cleanup;
    return createToasts((message) => announcements.push(message));
  });
  toasts.show('First', 100);
  t.mock.timers.tick(50);
  toasts.show('Second', 100);
  t.mock.timers.tick(50);
  assert.equal(toasts.message(), 'Second');
  t.mock.timers.tick(50);
  assert.equal(toasts.message(), null);
  toasts.show('Third');
  toasts.dismiss();
  assert.equal(toasts.message(), null);
  dispose();
  toasts.show('Late');
  assert.deepEqual(announcements, ['First', 'Second', 'Third']);
  t.mock.timers.tick(10_000);
  assert.equal(toasts.message(), null);
});

test('loading cover survives overlapping work and releases on success and rejection', async () => {
  let dispose!: () => void;
  const toasts = createRoot((cleanup) => {
    dispose = cleanup;
    return createToasts(() => {});
  });
  let first!: (value: number) => void;
  let second!: (reason: Error) => void;
  const a = toasts.while(
    new Promise<number>((resolve) => {
      first = resolve;
    }),
  );
  const b = toasts.while(
    new Promise<never>((_, reject) => {
      second = reject;
    }),
  );
  const failure = assert.rejects(b, /request failed/);
  assert.equal(toasts.loading(), true);
  first(42);
  assert.equal(await a, 42);
  assert.equal(toasts.loading(), true);
  second(new Error('request failed'));
  await failure;
  assert.equal(toasts.loading(), false);
  dispose();
  assert.equal(await toasts.while(Promise.resolve(7)), 7);
  assert.equal(toasts.loading(), false);
});
