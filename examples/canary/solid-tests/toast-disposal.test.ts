import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRenderEffect, createRoot } from 'solid-js';
import { createToasts } from '../src/app/overlays/toasts.solid.ts';

test('a toast owner disposed by the message update cannot schedule a timer or announce afterward', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timeout = globalThis.setTimeout;
  let scheduled = 0;
  t.mock.method(globalThis, 'setTimeout', (...args: Parameters<typeof setTimeout>) => {
    scheduled++;
    return timeout(...args);
  });
  const announced: string[] = [];
  let dispose!: () => void;
  const toasts = createRoot((stop) => {
    dispose = stop;
    const value = createToasts((message) => announced.push(message));
    createRenderEffect(() => {
      if (value.message()) stop();
    });
    return value;
  });
  try {
    toasts.show('Owner leaves now', 60_000);
    assert.deepEqual(announced, [], 'native announcements must not start after owner cleanup');
    assert.equal(scheduled, 0, 'cleanup must not be followed by a newly allocated timer');
  } finally {
    dispose();
    t.mock.timers.tick(60_000);
  }
});
