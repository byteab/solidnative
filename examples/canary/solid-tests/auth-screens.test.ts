import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoginPage } from '../src/app/auth/login-page.solid.tsx';
import { CodePage } from '../src/app/auth/code-page.solid.tsx';
import { AccountPage } from '../src/app/auth/account-page.solid.tsx';
import { signedIn } from '../src/app/auth/session.solid.ts';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';

function authFixture() {
  return consumerFixture((session) => [
    { path: 'auth/login', component: LoginPage },
    { path: 'auth/code', component: CodePage },
    { path: 'account', component: AccountPage, guard: (context) => signedIn(session())(context) },
    {
      path: 'account/settings',
      component: AccountPage,
      data: { settings: true },
      guard: (context) => signedIn(session())(context),
    },
  ]);
}

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} sign-in/code/account/sheet expires during native presentation and removes protected screens`, async (t) => {
    const fixture = authFixture();
    const h = bootConsumer(fixture, platform);
    t.after(() => h.root.dispose());
    const nav = fixture.navigation();
    assert.equal(await nav.reset('/account?source=link#profile'), true);
    h.finish();
    assert.equal(nav.url(), '/auth/login');
    assert.equal(fixture.session().returnTo, '/account?source=link#profile');
    h.press('Sign in');
    assert.ok(h.renderedText().includes('Enter an email address and a password.'));
    h.input('Email', 'ada@example.com');
    h.input('Password', 'correct horse');
    h.press('Sign in');
    await h.waitFor(() => nav.url() === '/auth/code');
    h.finish();
    h.input('Code', '000000');
    h.press('Continue');
    await h.waitFor(() => h.renderedText().includes('That code is not right.'));
    assert.equal(nav.url(), '/auth/code');
    h.input('Code', '123456', 2);
    h.press('Continue');
    await h.waitFor(() => nav.url() === '/account?source=link#profile');
    h.finish();
    assert.equal(nav.entries().length, 1);
    assert.ok(h.renderedText().includes('Signed in as ada@example.com'));
    h.press('Settings');
    await h.waitFor(() => nav.url() === '/account/settings');
    h.clock.flushMicrotasks();
    assert.equal(nav.entries().length, 2);
    const sheet = h
      .nodes()
      .filter((node) => node.viewName === 'RNSScreen')
      .at(-1);
    assert.equal(sheet?.props['stackPresentation'], 'formSheet');
    assert.ok(nav.busy());
    h.press('Let the session expire');
    assert.equal(fixture.session().signedIn(), false);
    assert.ok(!h.renderedText().includes('Signed in as'));
    assert.equal(nav.url(), '/account/settings', 'reset must wait for real transition settlement');
    h.finish();
    await h.waitFor(() => nav.url() === '/auth/login');
    h.finish();
    assert.equal(nav.entries().length, 1);
    assert.equal(fixture.session().resetRequired(), false);
    assert.ok(h.renderedText().includes('Your session has expired. Sign in again.'));
    assert.ok(!h.renderedText().includes('Signed in as'));
    assert.equal(await nav.back(), false);
    h.root.dispose();
    assert.deepEqual(fixture.errors, []);
    assert.deepEqual(h.fabric.roots.get(1), []);
  });
}

test('actual password screen validates and locks after three wrong attempts without changing routes', async (t) => {
  const fixture = authFixture();
  const h = bootConsumer(fixture);
  t.after(() => h.root.dispose());
  assert.equal(await fixture.navigation().reset('/auth/login'), true);
  h.finish();
  h.input('Email', 'ada@example.com');
  h.input('Password', 'wrong');
  for (let attempt = 1; attempt <= 3; attempt++) {
    h.press('Sign in');
    await h.waitFor(() =>
      h
        .renderedText()
        .includes(attempt === 3 ? 'Too many attempts.' : 'That password is not right.'),
    );
  }
  h.input('Password', 'correct horse', 2);
  h.press('Sign in');
  assert.equal(fixture.navigation().url(), '/auth/login');
  assert.equal(fixture.session().user(), null);
  assert.deepEqual(fixture.errors, []);
});
