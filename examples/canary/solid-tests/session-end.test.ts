import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, createSignal } from 'solid-js';
import { createSession } from '../src/app/auth/session.solid.ts';

test('expiry clears identity immediately and waits for a native transition before resetting every screen', async () => {
  const [busy, setBusy] = createSignal(false);
  let calls = 0;
  let dispose!: () => void;
  const session = createRoot((stop) => {
    dispose = stop;
    return createSession(
      {
        busy,
        reset: async () => {
          calls++;
          return !busy();
        },
      },
      0,
    );
  });
  try {
    await session.checkPassword('ada@example.com', 'correct horse');
    assert.equal(await session.checkCode('123456'), true);
    setBusy(true);
    const expiry = session.expire();
    await Promise.resolve();
    assert.equal(session.user(), null);
    assert.equal(session.resetRequired(), true);
    assert.equal(calls, 1, 'must not issue a knowingly refused native reset');
    setBusy(false);
    assert.equal(await expiry, true);
    assert.equal(calls, 2);
    assert.equal(session.resetRequired(), false);
    assert.equal(session.notice(), 'Your session has expired. Sign in again.');
  } finally {
    dispose();
  }
});

for (const rejected of [false, true]) {
  test(`an idle ${rejected ? 'throwing' : 'refused'} end reset stays signed out and can be retried`, async () => {
    let calls = 0;
    let dispose!: () => void;
    const session = createRoot((stop) => {
      dispose = stop;
      return createSession(
        {
          reset: async () => {
            if (++calls !== 2) return true;
            if (rejected) throw new Error('cannot reset');
            return false;
          },
        },
        0,
      );
    });
    try {
      await session.checkPassword('ada@example.com', 'correct horse');
      await session.checkCode('123456');
      if (rejected) await assert.rejects(session.signOut(), /cannot reset/);
      else assert.equal(await session.signOut(), false);
      assert.equal(session.signedIn(), false);
      assert.equal(session.resetRequired(), true);
      assert.equal(await session.retryEnd(), true);
      assert.equal(session.resetRequired(), false);
    } finally {
      dispose();
    }
  });
}

test('disposal releases a blocked end without later resetting a disposed navigation', async () => {
  const [busy, setBusy] = createSignal(true);
  let calls = 0;
  let dispose!: () => void;
  const session = createRoot((stop) => {
    dispose = stop;
    return createSession(
      {
        busy,
        reset: async () => {
          calls++;
          return true;
        },
      },
      0,
    );
  });
  const ending = session.signOut();
  dispose();
  assert.equal(await ending, false);
  setBusy(false);
  await Promise.resolve();
  assert.equal(calls, 0);
});
