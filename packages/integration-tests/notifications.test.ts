/**
 * `Notifications`, over a fake of `expo-notifications` that records every call.
 *
 * The listeners are the part React was holding - and in particular the difference between a
 * notification *arriving* and a user *tapping* one, which is a navigation instruction. The rest is
 * the module's own functions, each checked to reach the module under its own name, and to answer
 * empty rather than throw when the module is not there.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { DevicePushToken, NotificationResponse } from 'expo-notifications';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  Notifications,
  TriggerType,
  type NativeNotifications,
} from '@solid-native/expo/notifications';
import { disposeServices, ownedService, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const responseTo = (id: string, action = 'default'): NotificationResponse =>
  ({
    notification: { request: { identifier: id, content: {} } },
    actionIdentifier: action,
  }) as never;

type Kind = 'received' | 'response' | 'dropped' | 'pushToken';

function platform(
  launched: NotificationResponse | null = null,
  options: { permission?: boolean; expoToken?: string; deviceToken?: DevicePushToken } = {},
) {
  const { permission = true, expoToken = 'ExponentPushToken[abc]', deviceToken } = options;
  const calls: unknown[][] = [];
  const listeners: Partial<Record<Kind, (value: never) => void>> = {};
  const subscribe = (kind: Kind) => (listener: (value: never) => void) => {
    listeners[kind] = listener;
    return { remove: () => void calls.push(['remove', kind]) };
  };
  const record =
    (name: string, answer?: unknown) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args]);
      return answer;
    };
  const status = {
    status: permission ? 'granted' : 'denied',
    granted: permission,
    canAskAgain: true,
    expires: 'never',
  };
  const native = {
    addNotificationReceivedListener: subscribe('received'),
    addNotificationResponseReceivedListener: subscribe('response'),
    addNotificationsDroppedListener: subscribe('dropped'),
    addPushTokenListener: subscribe('pushToken'),
    getLastNotificationResponseAsync: record('getLastNotificationResponseAsync', launched),
    clearLastNotificationResponseAsync: record('clearLastNotificationResponseAsync'),
    getPermissionsAsync: record('getPermissionsAsync', status),
    requestPermissionsAsync: record('requestPermissionsAsync', status),
    scheduleNotificationAsync: record('scheduleNotificationAsync', 'scheduled-1'),
    cancelScheduledNotificationAsync: record('cancelScheduledNotificationAsync'),
    cancelAllScheduledNotificationsAsync: record('cancelAllScheduledNotificationsAsync'),
    getAllScheduledNotificationsAsync: record('getAllScheduledNotificationsAsync', ['s']),
    getNextTriggerDateAsync: record('getNextTriggerDateAsync', 1_000),
    getPresentedNotificationsAsync: record('getPresentedNotificationsAsync', ['p']),
    dismissNotificationAsync: record('dismissNotificationAsync'),
    dismissAllNotificationsAsync: record('dismissAllNotificationsAsync'),
    getBadgeCountAsync: record('getBadgeCountAsync', 4),
    setBadgeCountAsync: record('setBadgeCountAsync', true),
    getNotificationChannelsAsync: record('getNotificationChannelsAsync', ['c']),
    getNotificationChannelAsync: record('getNotificationChannelAsync', 'channel'),
    setNotificationChannelAsync: record('setNotificationChannelAsync', 'channel'),
    deleteNotificationChannelAsync: record('deleteNotificationChannelAsync'),
    getNotificationChannelGroupsAsync: record('getNotificationChannelGroupsAsync', ['g']),
    getNotificationChannelGroupAsync: record('getNotificationChannelGroupAsync', 'group'),
    setNotificationChannelGroupAsync: record('setNotificationChannelGroupAsync', 'group'),
    deleteNotificationChannelGroupAsync: record('deleteNotificationChannelGroupAsync'),
    getNotificationCategoriesAsync: record('getNotificationCategoriesAsync', ['k']),
    setNotificationCategoryAsync: record('setNotificationCategoryAsync', 'category'),
    deleteNotificationCategoryAsync: record('deleteNotificationCategoryAsync', true),
    setNotificationHandler: (handler: unknown) =>
      void calls.push(['setNotificationHandler', handler]),
    getExpoPushTokenAsync: record('getExpoPushTokenAsync', { type: 'expo', data: expoToken }),
    getDevicePushTokenAsync: record(
      'getDevicePushTokenAsync',
      deviceToken ?? { type: 'ios', data: 'x' },
    ),
    unregisterForNotificationsAsync: record('unregisterForNotificationsAsync'),
    setAutoServerRegistrationEnabledAsync: record('setAutoServerRegistrationEnabledAsync'),
    subscribeToTopicAsync: record('subscribeToTopicAsync'),
    unsubscribeFromTopicAsync: record('unsubscribeFromTopicAsync'),
    registerTaskAsync: record('registerTaskAsync', null),
    unregisterTaskAsync: record('unregisterTaskAsync', null),
  } as unknown as NativeNotifications;
  return Object.assign(native, {
    calls,
    emit: (kind: Kind, value?: unknown) => listeners[kind]?.(value as never),
  });
}

const serviceOn = (native: NativeNotifications | null) => serviceWith(Notifications, native);

describe('notifications', () => {
  it('separates one arriving from one being tapped', () => {
    const native = platform();
    const notifications = serviceOn(native);

    native.emit('received', { request: { identifier: 'a', content: {} } });
    assert.equal(notifications.latest()?.request.identifier, 'a');
    assert.equal(notifications.response(), null, 'arriving is not the user asking for anything');
  });

  it('swallows a native call that fails, rather than leaving an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', record);
    try {
      const failing = Object.assign(platform(), {
        getLastNotificationResponseAsync: () => Promise.reject(new Error('no launch response')),
        dismissAllNotificationsAsync: () => Promise.reject(new Error('dismiss failed')),
        setBadgeCountAsync: () => Promise.reject(new Error('badge failed')),
      });
      const notifications = serviceOn(failing);
      notifications.dismissAll();
      notifications.setBadge(3);
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.deepEqual(unhandled, []);
      assert.equal(notifications.response(), null);
    } finally {
      process.off('unhandledRejection', record);
    }
  });

  it('picks up the one that launched the app, which nothing was listening for', async () => {
    // A cold start from a notification: the tap happened before any listener existed. Missing
    // this is the single most common way notification routing is got wrong.
    const notifications = serviceOn(platform(responseTo('launch')));
    await settle();
    assert.equal(notifications.response()?.notification.request.identifier, 'launch');
  });

  it('does not let the launch response overwrite one the user just made', async () => {
    const native = platform(responseTo('launch'));
    const notifications = serviceOn(native);
    native.emit('response', responseTo('newer'));

    await settle();
    assert.equal(notifications.response()?.notification.request.identifier, 'newer');
  });

  it('hands a response over exactly once', async () => {
    // Routing on a tap is a one-off and the signal is not: an effect on it fires again whenever
    // its component is recreated, sending the user back to a screen they navigated away from.
    const notifications = serviceOn(platform(responseTo('launch')));
    await settle();

    assert.equal(notifications.take()?.notification.request.identifier, 'launch');
    assert.equal(notifications.take(), null);
  });

  it('hands over the text typed into a reply action', () => {
    const native = platform();
    const notifications = serviceOn(native);
    native.emit('response', { ...responseTo('chat', 'reply'), userText: 'On my way' });
    const reply: string | undefined = notifications.take()?.userText;
    assert.equal(reply, 'On my way');
  });

  it('hands over a second tap on the same notification', () => {
    // Same notification, tapped again after the app was backgrounded. It is a new instruction.
    const native = platform();
    const notifications = serviceOn(native);

    native.emit('response', responseTo('a'));
    assert.ok(notifications.take());

    native.emit('response', responseTo('a', 'reply'));
    assert.ok(notifications.take(), 'a different action on the same notification');
  });

  it('clears the response here and in the module', async () => {
    const native = platform(responseTo('launch'));
    const notifications = serviceOn(native);
    await settle();
    await notifications.clearResponse();
    assert.equal(notifications.response(), null);
    assert.ok(native.calls.some(([name]) => name === 'clearLastNotificationResponseAsync'));
  });

  it('counts the drops Android reports', () => {
    const native = platform();
    const notifications = serviceOn(native);
    assert.equal(notifications.dropped(), 0);
    native.emit('dropped');
    native.emit('dropped');
    assert.equal(notifications.dropped(), 2);
  });

  it('stops listening when the app is destroyed', () => {
    const native = platform();
    const service = ownedService(Notifications, native);
    void service.value;
    service.stop();
    const removed = native.calls.filter(([name]) => name === 'remove').map(([, kind]) => kind);
    assert.deepEqual(removed.sort(), ['dropped', 'pushToken', 'received', 'response']);
  });

  it('takes nothing before anything has ever arrived', () => {
    // The ordinary case for most of an app's life: no tap has happened yet, launch or otherwise.
    assert.equal(serviceOn(platform()).take(), null);
  });
});

describe('the rest of the module', () => {
  it('reaches every function of the module under its own name, with its arguments', async () => {
    const native = platform();
    const n = serviceOn(native);
    const handler = { handleNotification: async () => ({}) as never };
    const results = {
      schedule: await n.schedule({ content: { title: 'Hi' }, trigger: null }),
      scheduled: await n.scheduled(),
      next: await n.nextTriggerDate({ seconds: 5 } as never),
      presented: await n.presented(),
      badge: await n.badge(),
      channels: await n.channels(),
      channel: await n.channel('alerts'),
      setChannel: await n.setChannel('alerts', { name: 'Alerts', importance: 4 }),
      channelGroups: await n.channelGroups(),
      channelGroup: await n.channelGroup('g1'),
      setChannelGroup: await n.setChannelGroup('g1', { name: 'Group' }),
      categories: await n.categories(),
      setCategory: await n.setCategory('message', [{ identifier: 'reply', buttonTitle: 'Reply' }]),
      deleteCategory: await n.deleteCategory('message'),
    };
    await n.cancel('s1');
    await n.cancelAll();
    await n.dismiss('p1');
    n.dismissAll();
    n.setBadge(2);
    await n.deleteChannel('alerts');
    await n.deleteChannelGroup('g1');
    n.setHandler(handler);
    await n.unregister();
    await n.setAutoServerRegistration(false);
    await n.subscribeToTopic('news');
    await n.unsubscribeFromTopic('news');
    await n.registerTask('notification-task');
    await n.unregisterTask('notification-task');
    await settle();

    assert.deepEqual(results, {
      schedule: 'scheduled-1',
      scheduled: ['s'],
      next: 1_000,
      presented: ['p'],
      badge: 4,
      channels: ['c'],
      channel: 'channel',
      setChannel: 'channel',
      channelGroups: ['g'],
      channelGroup: 'group',
      setChannelGroup: 'group',
      categories: ['k'],
      setCategory: 'category',
      deleteCategory: true,
    });
    const called = (name: string) => native.calls.filter(([one]) => one === name);
    assert.deepEqual(called('scheduleNotificationAsync'), [
      ['scheduleNotificationAsync', { content: { title: 'Hi' }, trigger: null }],
    ]);
    assert.deepEqual(called('cancelScheduledNotificationAsync'), [
      ['cancelScheduledNotificationAsync', 's1'],
    ]);
    assert.deepEqual(called('setNotificationChannelAsync'), [
      ['setNotificationChannelAsync', 'alerts', { name: 'Alerts', importance: 4 }],
    ]);
    assert.deepEqual(called('setNotificationCategoryAsync'), [
      [
        'setNotificationCategoryAsync',
        'message',
        [{ identifier: 'reply', buttonTitle: 'Reply' }],
        undefined,
      ],
    ]);
    assert.deepEqual(called('setBadgeCountAsync'), [['setBadgeCountAsync', 2]]);
    assert.deepEqual(called('setNotificationHandler'), [['setNotificationHandler', handler]]);
    for (const [name, arg] of [
      ['cancelAllScheduledNotificationsAsync'],
      ['dismissNotificationAsync', 'p1'],
      ['dismissAllNotificationsAsync'],
      ['deleteNotificationChannelAsync', 'alerts'],
      ['deleteNotificationChannelGroupAsync', 'g1'],
      ['deleteNotificationCategoryAsync', 'message'],
      ['unregisterForNotificationsAsync'],
      ['setAutoServerRegistrationEnabledAsync', false],
      ['subscribeToTopicAsync', 'news'],
      ['unsubscribeFromTopicAsync', 'news'],
      ['registerTaskAsync', 'notification-task'],
      ['unregisterTaskAsync', 'notification-task'],
    ] as const) {
      assert.deepEqual(called(name), [arg === undefined ? [name] : [name, arg]], name);
    }
  });

  it('asks with iOS s finer options, and the permission follows the answer', async () => {
    const native = platform();
    const n = serviceOn(native);
    assert.equal(await n.requestPermission({ ios: { allowProvisional: true } }), true);
    assert.deepEqual(
      native.calls.find(([name]) => name === 'requestPermissionsAsync'),
      ['requestPermissionsAsync', { ios: { allowProvisional: true } }],
    );
    assert.equal(n.permission.granted(), true);
  });

  it('is inert rather than broken with no module installed', async () => {
    const n = serviceOn(null);
    assert.equal(n.response(), null);
    assert.equal(n.take(), null);
    assert.equal(await n.permission.ensure(), false);
    assert.equal(await n.requestPermission(), false);
    assert.equal(await n.schedule({ content: {}, trigger: null }), null);
    assert.deepEqual(await n.scheduled(), []);
    assert.equal(await n.nextTriggerDate({ seconds: 5 } as never), null);
    assert.deepEqual(await n.presented(), []);
    assert.equal(await n.badge(), 0);
    assert.deepEqual(await n.channels(), []);
    assert.equal(await n.channel('alerts'), null);
    assert.equal(await n.setChannel('alerts', { name: 'Alerts', importance: 4 }), null);
    assert.deepEqual(await n.channelGroups(), []);
    assert.equal(await n.channelGroup('g'), null);
    assert.deepEqual(await n.categories(), []);
    assert.equal(await n.setCategory('message', []), null);
    assert.equal(await n.deleteCategory('message'), false);
    n.dismissAll();
    n.setBadge(0);
    n.setHandler(null);
    await n.cancel('s');
    await n.cancelAll();
    await n.clearResponse();
    await n.registerTask('task');
    assert.equal(n.dropped(), 0);
    assert.equal(n.devicePushToken(), null);
  });
});

describe('trigger types', () => {
  it('are the module s own enum, so a schedule can be written without loading the module', () => {
    // The enum lives in a file Node cannot load, so its compiled lines are read as text.
    const require = createRequire(import.meta.url);
    const types = readFileSync(
      require.resolve('expo-notifications/build/Notifications.types.js'),
      'utf8',
    );
    const expo = Object.fromEntries(
      [...types.matchAll(/SchedulableTriggerInputTypes\["(\w+)"\] = "(\w+)"/g)].map(
        ([, key, value]) => [key, value],
      ),
    );
    assert.ok(Object.keys(expo).length > 0, 'found the enum');
    assert.deepEqual({ ...TriggerType }, expo);
  });
});

describe('push tokens', () => {
  it('hands back the Expo push token', async () => {
    const n = serviceOn(platform(null, { expoToken: 'ExponentPushToken[xyz]' }));
    assert.equal(await n.getExpoPushToken(), 'ExponentPushToken[xyz]');
  });

  it('passes a projectId through to the module', async () => {
    const native = platform();
    await serviceOn(native).getExpoPushToken('my-project');
    assert.deepEqual(
      native.calls.find(([name]) => name === 'getExpoPushTokenAsync'),
      ['getExpoPushTokenAsync', { projectId: 'my-project' }],
    );
  });

  it('hands back the native device token, for a backend that talks to APNs/FCM directly', async () => {
    const n = serviceOn(platform(null, { deviceToken: { type: 'android', data: 'fcm-token' } }));
    assert.deepEqual(await n.getDevicePushToken(), { type: 'android', data: 'fcm-token' });
  });

  it('is null when the permission was refused, without asking for a token', async () => {
    const native = platform(null, { permission: false });
    const n = serviceOn(native);
    assert.equal(await n.getExpoPushToken(), null);
    assert.equal(await n.getDevicePushToken(), null);
    assert.ok(!native.calls.some(([name]) => String(name).endsWith('PushTokenAsync')));
  });

  it('is null with no module installed, for both kinds of token', async () => {
    const n = serviceOn(null);
    assert.equal(await n.getExpoPushToken(), null);
    assert.equal(await n.getDevicePushToken(), null);
  });

  it('observes the device token changing while the app runs', () => {
    const native = platform();
    const n = serviceOn(native);
    assert.equal(n.devicePushToken(), null, 'nothing has rolled yet');

    native.emit('pushToken', { type: 'ios', data: 'rolled-token' });
    assert.deepEqual(n.devicePushToken(), { type: 'ios', data: 'rolled-token' });
  });
});
