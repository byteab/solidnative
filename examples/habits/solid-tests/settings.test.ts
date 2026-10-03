import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solid-native/device/solid';
import { Notifications, type NativeNotifications } from '@solid-native/expo/solid/notifications';
import { bootHabits } from './habits-harness.ts';

/** The slice of expo-notifications this screen reaches, recording what it was asked to do. */
function notifications(granted: boolean) {
  const calls: unknown[][] = [];
  const status = { status: granted ? 'granted' : 'denied', granted, canAskAgain: false };
  const subscription = { remove: () => {} };
  const native = {
    addNotificationReceivedListener: () => subscription,
    addNotificationResponseReceivedListener: () => subscription,
    addNotificationsDroppedListener: () => subscription,
    addPushTokenListener: () => subscription,
    getLastNotificationResponseAsync: async () => null,
    getPermissionsAsync: async () => status,
    requestPermissionsAsync: async () => status,
    cancelAllScheduledNotificationsAsync: async () => void calls.push(['cancelAll']),
    scheduleNotificationAsync: async (request: unknown) => {
      calls.push(['schedule', request]);
      return 'id';
    },
  } as unknown as NativeNotifications;
  return { native, calls };
}

async function open(t: { after(fn: () => void): void }, granted: boolean) {
  const fake = notifications(granted);
  const h = bootHabits({
    services: [provideService(Notifications.SOURCE, () => fake.native)],
  });
  t.after(() => h.root.dispose());
  await h.settle();
  // The root stack selects the tab in place. A tap on the bar goes through `selectTab`; see below.
  assert.equal(await h.navigation().push('/settings'), true);
  await h.waitFor(() => h.byLabel('Daily reminders', 'switch').length > 0);
  return { ...fake, h };
}

test('settings lists every streak, by habit', async (t) => {
  const { h } = await open(t, true);
  assert.equal(h.navigation().url(), '/settings');
  const text = h.renderedText();
  for (const part of ['Settings', 'Reminders', 'Streaks', 'Drink water9', 'Exercise6'])
    assert.ok(text.includes(part), part);
  assert.deepEqual(h.errors, []);
});

test('turning reminders on schedules one a day for each habit with a time', async (t) => {
  const { calls, h } = await open(t, true);
  h.toggle('Daily reminders', true);
  await h.waitFor(() => calls.filter(([kind]) => kind === 'schedule').length === 3);
  assert.deepEqual(calls[0], ['cancelAll']);
  assert.deepEqual(calls[1], [
    'schedule',
    {
      identifier: 'seed-water',
      content: { title: 'Drink water', body: "Don't forget today." },
      trigger: { type: 'daily', hour: 9, minute: 0 },
    },
  ]);
  assert.equal(h.one('Daily reminders', 'switch').props['value'], true);
});

test('refused, it schedules nothing and says where to turn them on', async (t) => {
  const { calls, h } = await open(t, false);
  h.toggle('Daily reminders', true);
  await h.waitFor(() => h.renderedText().includes('Notifications are turned off for Habits'));
  assert.deepEqual(calls, []);
  assert.equal(h.one('Daily reminders', 'switch').props['value'], false);
});

test('turning reminders off cancels them', async (t) => {
  const { calls, h } = await open(t, true);
  h.toggle('Daily reminders', true);
  await h.waitFor(() => calls.length > 1);
  await h.settle();
  calls.length = 0;
  h.toggle('Daily reminders', false);
  await h.waitFor(() => calls.length > 0);
  assert.deepEqual(calls, [['cancelAll']]);
});

test('a tap on the Settings tab in the bar opens it', async (t) => {
  const h = bootHabits();
  t.after(() => h.root.dispose());
  await h.settle();
  const bar = h.nodes().find((node) => node.viewName.startsWith('RNSTabsHost'));
  assert.ok(bar);
  h.fabric.emit(bar, 'topTabSelected', { selectedScreenKey: 'settings', provenance: 1 });
  await h.waitFor(() => h.navigation().url() === '/settings');
  assert.deepEqual(h.errors, []);
});
