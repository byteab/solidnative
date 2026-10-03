import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRenderEffect, createRoot } from 'solid-js';
import { createSession } from '../src/app/auth/session.solid.ts';

test('an already-aborted attempt never cancels a newer password request', async () => {
  let dispose!: () => void;
  const session = createRoot((stop) => {
    dispose = stop;
    return createSession({ reset: async () => true }, 0);
  });
  try {
    const aborted = new AbortController();
    aborted.abort();
    const newer = session.checkPassword('new@example.com', 'correct horse');
    assert.equal(
      await session.checkPassword('old@example.com', 'wrong', aborted.signal),
      'cancelled',
    );
    assert.equal(await session.checkCode('123456', aborted.signal), false);
    assert.equal(await newer, 'ok');
    assert.equal(await session.checkCode('123456'), true);
    assert.equal(session.user()?.email, 'new@example.com');
  } finally {
    dispose();
  }
});

test('aborting during candidate publication rolls back but retains verified credentials and the return URL', async () => {
  const cancellation = new AbortController();
  let calls = 0;
  let dispose!: () => void;
  const session = createRoot((stop) => {
    dispose = stop;
    const value = createSession(
      {
        reset: async () => {
          calls++;
          return true;
        },
      },
      0,
    );
    createRenderEffect(() => {
      if (value.user()) cancellation.abort();
    });
    return value;
  });
  try {
    session.returnTo = '/account?filter=open#latest';
    await session.checkPassword('ada@example.com', 'correct horse');
    assert.equal(await session.checkCode('123456', cancellation.signal), false);
    assert.equal(session.signedIn(), false);
    assert.equal(calls, 0);
    assert.equal(session.returnTo, '/account?filter=open#latest');
    assert.equal(await session.checkCode('123456'), true);
    assert.equal(calls, 1);
  } finally {
    dispose();
  }
});

test('screen disposal caused by an accepted reset cannot roll back successful authentication', async () => {
  const cancellation = new AbortController();
  let dispose!: () => void;
  const session = createRoot((stop) => {
    dispose = stop;
    return createSession(
      {
        reset: async () => {
          cancellation.abort();
          return true;
        },
      },
      0,
    );
  });
  try {
    await session.checkPassword('ada@example.com', 'correct horse');
    assert.equal(await session.checkCode('123456', cancellation.signal), true);
    assert.equal(session.signedIn(), true);
  } finally {
    dispose();
  }
});
