import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRenderEffect, createRoot } from 'solid-js';
import { createSession } from '../src/app/auth/session.solid.ts';

test('a request started by rollback observers supersedes the request that caused rollback', async () => {
  let finishReset!: (value: boolean) => void;
  const reset = new Promise<boolean>((resolve) => {
    finishReset = resolve;
  });
  let dispose!: () => void;
  let armed = false;
  let triggered = false;
  let latest!: Promise<string>;
  const session = createRoot((stop) => {
    dispose = stop;
    const value = createSession({ reset: () => reset }, 0);
    createRenderEffect(() => {
      if (value.user() === null && armed && !triggered) {
        triggered = true;
        latest = value.checkPassword('latest@example.com', 'correct horse');
      }
    });
    return value;
  });
  try {
    assert.equal(await session.checkPassword('first@example.com', 'correct horse'), 'ok');
    const code = session.checkCode('123456');
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(session.user()?.email, 'first@example.com');
    armed = true;
    const superseded = session.checkPassword('older@example.com', 'wrong');
    assert.equal(triggered, true);
    assert.equal(
      await superseded,
      'cancelled',
      'reentrant newer request must have a distinct epoch',
    );
    assert.equal(await latest, 'ok');
    finishReset(false);
    assert.equal(await code, false);
  } finally {
    finishReset(false);
    dispose();
  }
});
