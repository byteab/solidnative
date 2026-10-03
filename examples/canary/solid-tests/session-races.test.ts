import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRenderEffect, createRoot } from 'solid-js';
import { createSession } from '../src/app/auth/session.solid.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

test('a newer password attempt cannot inherit a provisional user from an unsettled reset', async () => {
  const reset = deferred<boolean>();
  let dispose!: () => void;
  const session = createRoot((stop) => {
    dispose = stop;
    return createSession({ reset: () => reset.promise }, 0);
  });
  try {
    await session.checkPassword('first@example.com', 'correct horse');
    const oldCode = session.checkCode('123456');
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(
      session.user()?.email,
      'first@example.com',
      'destination guards can see the provisional user',
    );
    const nextPassword = session.checkPassword('second@example.com', 'wrong');
    assert.equal(
      session.signedIn(),
      false,
      'superseding authentication rolls back the previous provisional user',
    );
    assert.equal(await nextPassword, 'wrong');
    reset.resolve(false);
    assert.equal(await oldCode, false);
    assert.equal(session.signedIn(), false);
  } finally {
    reset.resolve(false);
    dispose();
  }
});

test('disposal triggered by a provisional user update cannot start navigation afterward', async () => {
  let dispose!: () => void;
  const resets: unknown[] = [];
  const session = createRoot((stop) => {
    dispose = stop;
    const value = createSession(
      {
        reset: async (path) => {
          resets.push(path);
          return true;
        },
      },
      0,
    );
    createRenderEffect(() => {
      if (value.user()) stop();
    });
    return value;
  });
  try {
    await session.checkPassword('ada@example.com', 'correct horse');
    assert.equal(await session.checkCode('123456'), false);
    assert.deepEqual(resets, [], 'no navigation may begin after the session owner has disposed');
  } finally {
    dispose();
  }
});
