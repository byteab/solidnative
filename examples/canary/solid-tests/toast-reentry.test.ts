import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRenderEffect, createRoot } from 'solid-js';
import { createToasts } from '../src/app/overlays/toasts.solid.ts';

test('a newer toast raised synchronously by the first message owns its full duration and announcement', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let dispose!: () => void;
  const announced: string[] = [];
  const toasts = createRoot((stop) => {
    dispose = stop;
    const value = createToasts((message) => announced.push(message));
    createRenderEffect(() => {
      if (value.message() === 'first') value.show('second', 1000);
    });
    return value;
  });
  try {
    toasts.show('first', 50);
    assert.equal(toasts.message(), 'second');
    assert.deepEqual(announced, ['second']);
    t.mock.timers.tick(50);
    assert.equal(
      toasts.message(),
      'second',
      'superseded first timeout cannot erase the newer toast',
    );
    t.mock.timers.tick(950);
    assert.equal(toasts.message(), null);
  } finally {
    dispose();
    t.mock.timers.tick(1000);
  }
});

test('synchronous dismissal during message publication suppresses the obsolete announcement', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let dispose!: () => void;
  const announced: string[] = [];
  const toasts = createRoot((stop) => {
    dispose = stop;
    const value = createToasts((message) => announced.push(message));
    createRenderEffect(() => {
      if (value.message() === 'dismissed') value.dismiss();
    });
    return value;
  });
  try {
    toasts.show('dismissed');
    assert.equal(toasts.message(), null);
    assert.deepEqual(announced, []);
  } finally {
    dispose();
    t.mock.timers.tick(2500);
  }
});
