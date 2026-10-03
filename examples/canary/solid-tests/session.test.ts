import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import {
  createRouteMatch,
  parseRouteLocation,
} from '../../../packages/router/src/solid/route-match.ts';
import { createSession, signedIn } from '../src/app/auth/session.solid.ts';

function boot(delay = 0) {
  const resets: (string | readonly string[])[] = [];
  let dispose!: () => void;
  const session = createRoot((cleanup) => {
    dispose = cleanup;
    return createSession(
      {
        reset: async (path) => {
          resets.push(path);
          return true;
        },
      },
      delay,
    );
  });
  return { session, resets, dispose };
}

test('auth guard remembers exact return URL and code resets the complete native stack', async () => {
  const { session, resets, dispose } = boot();
  const context = {
    from: undefined,
    to: createRouteMatch(parseRouteLocation('/account/orders?filter=open#latest'), {}, {}),
    signal: new AbortController().signal,
  };
  assert.equal(signedIn(session)(context), '/auth/login');
  assert.equal(await session.checkPassword('ada@example.com', 'correct horse'), 'ok');
  assert.equal(await session.checkCode('000000'), false);
  assert.deepEqual(resets, []);
  assert.equal(await session.checkCode('123456'), true);
  assert.equal(session.user()?.email, 'ada@example.com');
  assert.deepEqual(resets, ['/account/orders?filter=open#latest']);
  assert.equal(session.returnTo, '/account');
  assert.equal(signedIn(session)(context), true);
  await session.expire();
  assert.equal(session.user(), null);
  assert.equal(session.notice(), 'Your session has expired. Sign in again.');
  assert.equal(resets.at(-1), '/auth/login');
  dispose();
});

test('three wrong passwords lock subsequent attempts', async () => {
  const { session, dispose } = boot();
  assert.equal(await session.checkPassword('ada@example.com', 'wrong'), 'wrong');
  assert.equal(await session.checkPassword('ada@example.com', 'wrong'), 'wrong');
  assert.equal(await session.checkPassword('ada@example.com', 'wrong'), 'locked');
  assert.equal(await session.checkPassword('ada@example.com', 'correct horse'), 'locked');
  assert.equal(await session.checkCode('123456'), false);
  dispose();
});

test('sign-out and owner disposal invalidate pending authentication and cancel timers', async () => {
  const { session, resets, dispose } = boot(60_000);
  const password = session.checkPassword('ada@example.com', 'correct horse');
  await session.signOut();
  assert.equal(await password, 'cancelled');
  const code = session.checkCode('123456');
  dispose();
  assert.equal(await code, false);
  assert.equal(await session.signOut(), false);
  assert.equal(await session.checkPassword('late@example.com', 'correct horse'), 'cancelled');
  assert.deepEqual(resets, ['/auth/login']);
  assert.equal(session.user(), null);
});

for (const outcome of ['refused', 'rejected'] as const) {
  test(`a ${outcome} route reset rolls back sign-in and preserves credentials and return URL for retry`, async () => {
    const paths: (string | readonly string[])[] = [];
    let dispose!: () => void;
    const session = createRoot((cleanup) => {
      dispose = cleanup;
      return createSession(
        {
          reset: async (path) => {
            paths.push(path);
            if (paths.length > 1) return true;
            if (outcome === 'rejected') throw new Error('navigation failed');
            return false;
          },
        },
        0,
      );
    });
    try {
      session.returnTo = '/account/orders?filter=open#latest';
      await session.checkPassword('ada@example.com', 'correct horse');
      if (outcome === 'rejected')
        await assert.rejects(session.checkCode('123456'), /navigation failed/);
      else assert.equal(await session.checkCode('123456'), false);
      assert.equal(session.signedIn(), false);
      assert.equal(session.user(), null);
      assert.equal(session.returnTo, '/account/orders?filter=open#latest');
      assert.equal(await session.checkCode('123456'), true);
      assert.equal(session.user()?.email, 'ada@example.com');
      assert.deepEqual(paths, [
        '/account/orders?filter=open#latest',
        '/account/orders?filter=open#latest',
      ]);
    } finally {
      dispose();
    }
  });
}

test('a pending sign-in reset cannot report success or restore identity after sign-out', async () => {
  let finish!: (value: boolean) => void;
  let dispose!: () => void;
  let started!: () => void;
  const staged = new Promise<void>((resolve) => {
    started = resolve;
  });
  const session = createRoot((cleanup) => {
    dispose = cleanup;
    return createSession(
      {
        reset: (path) =>
          path === '/auth/login'
            ? Promise.resolve(true)
            : new Promise<boolean>((resolve) => {
                finish = resolve;
                started();
              }),
      },
      0,
    );
  });
  try {
    await session.checkPassword('ada@example.com', 'correct horse');
    const signingIn = session.checkCode('123456');
    await staged;
    await session.signOut();
    finish(true);
    assert.equal(await signingIn, false);
    assert.equal(session.user(), null);
    assert.equal(session.signedIn(), false);
  } finally {
    dispose();
  }
});
