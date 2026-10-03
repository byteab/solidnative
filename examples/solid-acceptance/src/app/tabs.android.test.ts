import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, userEvent } from '@solid-native/testing';
import { startApp } from './start-app.ts';

afterEach(cleanup);

test('android: a bottom navigation bar with tinted image icons, and every tab opens', async () => {
  const app = await startApp({ platform: 'android' });
  assert.equal(app.getByTestId('tabs').viewName, 'RNSTabsHostAndroid');
  const tabs = app.nodes().filter((n) => n.viewName === 'RNSTabsScreenAndroid');
  assert.deepEqual(
    tabs.map((n) => n.props['tabBarItemAccessibilityLabel']),
    ['Home tab', 'List tab', 'Motion tab'],
  );
  assert.ok(JSON.stringify(tabs.map((n) => n.props)).includes('tab-list.png'));

  await userEvent.press(app.getByTestId('counter'));
  assert.ok(app.getByText('Tapped 1 times'));
  await app.selectTab('list');
  await app.until(() => app.getByTestId('row-1'));
  await app.selectTab('motion');
  await app.until(() => app.getByTestId('animated-box'));
  await app.selectTab('home');
  await app.until(() => app.getByText('Tapped 1 times'));
  assert.deepEqual(app.errors, []);
});
