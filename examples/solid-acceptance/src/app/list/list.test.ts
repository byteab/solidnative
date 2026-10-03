import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, fireEvent, userEvent, waitFor } from '@solidnative/testing';
import { startApp } from '../start-app.ts';

afterEach(cleanup);

async function openList() {
  const app = await startApp();
  await app.selectTab('list');
  await app.until(() => app.getByTestId('row-1'));
  return app;
}

test('the list tab is a virtual list of 200 rows that scrolls', async () => {
  const app = await openList();
  const list = app.getByTestId('list');
  assert.ok(app.getByLabelText('Row 1'));
  // Virtual: only the rows near the viewport exist, not all 200.
  assert.equal(app.queryByTestId('row-200'), null);

  await fireEvent.scroll(list, {
    contentOffset: { x: 0, y: 199 * 56 },
    contentSize: { width: 402, height: 200 * 56 },
    layoutMeasurement: { width: 402, height: 700 },
  });
  await app.until(() => app.getByTestId('row-200'));
  assert.deepEqual(app.errors, []);
});

test('pull to refresh shows the indicator, then stops it', async () => {
  const app = await openList();
  assert.ok(app.getByText('Refreshed 0 times'));
  const control = () => app.nodes().find((n) => n.viewName === 'PullToRefreshView')!;
  assert.equal(control().props['refreshing'], false);

  await fireEvent(control(), 'topRefresh');
  assert.equal(control().props['refreshing'], true);

  await waitFor(() => assert.ok(app.getByText('Refreshed 1 times')));
  assert.equal(control().props['refreshing'], false);
});

test('a row opens its detail screen', async () => {
  const app = await openList();
  await userEvent.press(app.getByTestId('row-3'));
  await app.until(() => app.getByText('Detail 3'));
  assert.ok(app.nodes().some((n) => n.props['title'] === 'Item 3'));
});
