import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, userEvent } from '@solid-native/testing';
import { startApp } from '../start-app.ts';

afterEach(cleanup);

test('counts taps', async () => {
  const app = await startApp();
  await userEvent.press(app.getByTestId('counter'));
  assert.ok(app.getByText('Tapped 1 times'));
  assert.deepEqual(app.errors, []);
});

test('opens the detail screen with the count as its param, and goes back', async () => {
  const app = await startApp();
  await userEvent.press(app.getByTestId('counter'));
  await userEvent.press(app.getByTestId('counter'));
  await userEvent.press(app.getByTestId('open-detail'));
  const title = await app.until(() => app.getByTestId('detail-title'));
  assert.ok(app.getByText('Detail 2'));
  assert.ok(title);
  assert.ok(app.nodes().some((n) => n.props['title'] === 'Item 2'));

  await userEvent.press(app.getByTestId('detail-back'));
  await app.until(() => assert.equal(app.queryByTestId('detail-title'), null));
  assert.ok(app.getByText('Tapped 2 times'));
});

test('a solidacceptance:// link opens a detail screen', async () => {
  const app = await startApp({ launchUrl: 'solidacceptance://detail/77' });
  await app.until(() => app.getByText('Detail 77'));
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: the home screen follows the colour scheme`, async () => {
    const app = await startApp({ scheme });
    const title = app.getByText('Solid, natively');
    assert.equal(
      title.props['color'],
      scheme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(16, 16, 20)',
    );
  });
}
