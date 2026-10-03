import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, userEvent } from '@solid-native/testing';
import { startApp } from '../start-app.ts';

afterEach(cleanup);

async function openForm(scheme: 'light' | 'dark' = 'light') {
  const app = await startApp({ scheme });
  await userEvent.press(app.getByTestId('open-form'));
  await app.until(() => app.getByTestId('name-input'));
  return app;
}

const RED = 'rgb(225, 29, 72)';

test('submitting an empty form shows every error and no result', async () => {
  const app = await openForm();
  await userEvent.press(app.getByTestId('submit'));
  await app.until(() => app.getByTestId('email-error'));
  assert.ok(app.getByText('Enter your name'));
  assert.ok(app.getByText('Enter your email'));
  assert.equal(app.getByLabelText('Name').props['borderTopColor'], RED);
  assert.equal(app.queryByTestId('form-result'), null);
});

test('validates as you type, and a valid form submits', async () => {
  const app = await openForm();
  await userEvent.type(app.getByTestId('name-input'), 'A');
  assert.ok(app.getByText('At least 2 characters'));
  await userEvent.type(app.getByTestId('name-input'), 'da');
  assert.equal(app.queryByTestId('name-error'), null);

  await userEvent.type(app.getByTestId('email-input'), 'ada@');
  assert.ok(app.getByText('Not an email address'));
  await userEvent.type(app.getByTestId('email-input'), 'example.com');
  assert.equal(app.queryByTestId('email-error'), null);
  assert.notEqual(app.getByLabelText('Email').props['borderTopColor'], RED);

  await userEvent.press(app.getByTestId('submit'));
  await app.until(() => app.getByTestId('form-result'));
  assert.ok(app.getByText('Thanks, Ada <ada@example.com>'));
  assert.deepEqual(app.errors, []);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: the fields follow the colour scheme`, async () => {
    const app = await openForm(scheme);
    assert.equal(
      app.getByLabelText('Name').props['backgroundColor'],
      scheme === 'dark' ? 'rgb(28, 28, 34)' : 'rgb(255, 255, 255)',
    );
  });
}
