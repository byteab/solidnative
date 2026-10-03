import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRenderEffect, createRoot } from 'solid-js';
import { LoginPage } from '../src/app/auth/login-page.solid.tsx';
import { CodePage } from '../src/app/auth/code-page.solid.tsx';
import { AccountPage } from '../src/app/auth/account-page.solid.tsx';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';

const later = () => new Promise<void>((resolve) => setTimeout(resolve, 15));
function fixture() {
  return consumerFixture(() => [
    { path: 'auth/login', component: LoginPage },
    { path: 'auth/code', component: CodePage },
    { path: 'account', component: AccountPage },
    { path: 'elsewhere', component: () => null },
  ]);
}

test('disposing the code screen while validation is pending cannot later sign in and reset navigation', async (t) => {
  const f = fixture();
  const h = bootConsumer(f);
  t.after(() => h.root.dispose());
  const nav = f.navigation();
  await nav.reset('/auth/code');
  h.finish();
  await f.session().checkPassword('ada@example.com', 'correct horse');
  h.input('Code', '123456');
  h.press('Continue');
  const codeOwner = nav.current()!.owner;
  await nav.reset('/elsewhere');
  h.finish();
  assert.equal(codeOwner.disposed, true);
  await later();
  h.finish();
  assert.equal(nav.url(), '/elsewhere', 'a removed screen must not issue a delayed auth reset');
  assert.equal(f.session().signedIn(), false);
  assert.deepEqual(f.errors, []);
});

test('disposing the password screen while validation is pending cannot later push code', async (t) => {
  const f = fixture();
  const h = bootConsumer(f);
  t.after(() => h.root.dispose());
  const nav = f.navigation();
  await nav.reset('/auth/login');
  h.finish();
  h.input('Email', 'ada@example.com');
  h.input('Password', 'correct horse');
  h.press('Sign in');
  await nav.reset('/elsewhere');
  h.finish();
  await later();
  h.finish();
  assert.equal(nav.url(), '/elsewhere');
  assert.equal(f.session().signedIn(), false);
  assert.deepEqual(f.errors, []);
});

test('notice-clear observer disposing the root prevents the password continuation from starting navigation', async (t) => {
  const f = fixture();
  const h = bootConsumer(f);
  t.after(() => h.root.dispose());
  const nav = f.navigation();
  await f.session().expire();
  h.finish();
  assert.ok(f.session().notice());
  let disposed = false;
  let pushesAfterDisposal = 0;
  let stopObserver!: () => void;
  const push = nav.push;
  nav.push = (...args) => {
    if (disposed) pushesAfterDisposal++;
    return push(...args);
  };
  createRoot((stop) => {
    stopObserver = stop;
    createRenderEffect(() => {
      if (f.session().notice() === null) {
        disposed = true;
        h.root.dispose();
      }
    });
  });
  t.after(() => stopObserver());
  h.input('Email', 'ada@example.com');
  h.input('Password', 'correct horse');
  h.press('Sign in');
  await later();
  assert.equal(disposed, true);
  assert.equal(pushesAfterDisposal, 0, 'publishing notice may synchronously destroy this screen');
  assert.deepEqual(f.errors, []);
});
