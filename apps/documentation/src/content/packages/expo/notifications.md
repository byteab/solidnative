---
title: Notifications
summary: The notification that launched the app, the one just tapped, and a push token for your server.
---

# Notifications

`Notifications` is all of `expo-notifications` as one Solid service. Received notifications, taps
and the response that launched the app are accessors; the permission, scheduling, the badge,
Android's channels, action buttons, the foreground handler, push tokens and background tasks are
methods that take and return the module's own types.

The accessors separate a notification _arriving_ while the app is in front from a user _tapping_
one - a navigation instruction that must not be missed, including the one that launched the app
before anything was listening. A test provides a fake module with
`provideService(Notifications.SOURCE, () => fake)` inside a `ServiceScope` (both from
`@solid-native/device/solid`).

## Install

```sh
npx expo install expo-notifications
```

```ts
import { Notifications } from '@solid-native/expo/solid/notifications';
```

## The smallest useful example

```tsx
import { createEffect } from 'solid-js';
import { useService } from '@solid-native/device/solid';
import { useNavigation } from '@solid-native/router/solid';
import { Notifications } from '@solid-native/expo/solid/notifications';

/** Rendered once inside the root route, so it has navigation. */
export function NotificationRouting() {
  const inbox = useService(Notifications);
  const navigation = useNavigation();

  // `take()` reads an accessor, and the response that launched the app arrives asynchronously -
  // an effect re-runs when it does, where a one-off read in the component body would miss it.
  createEffect(() => {
    const tapped = inbox.take();
    if (tapped) void navigation.push('/notification/' + tapped.notification.request.identifier);
  });
  return null;
}
```

The permission is `notifications.permission`, a [`Permission`](/packages/expo/permissions):
`ensure()` asks only if unanswered, and `blocked()` says when the user must go to Settings.
`requestPermission(options)` asks with iOS's finer options, such as provisional authorization.

## What it reports and does

- **`latest`** - accessor: the most recent notification that arrived while the app was in front.
- **`response`** - accessor: the most recent notification tapped, including the one that launched
  the app. It stays set, so an effect reading it fires again each time its component is recreated.
- **`take()`** - the response, once. Prefer it over `response` for routing. Responses are keyed by
  notification identifier plus action identifier; each is returned once, then `null` for the
  lifetime of the service.
- **`dismissAll()`** - clears every displayed notification.
- **`setBadge(count)`** - sets the app icon's badge (on Android, where the launcher supports it).
- **`getExpoPushToken(projectId?)`** and **`getDevicePushToken()`** - the two push tokens, below.
- **`devicePushToken`** - accessor: the device token each time the platform rolls it while the app
  runs. Null until a roll happens.

## The response that launched the app

A cold-launch response happened before any listener existed, so it has to be asked for.
`Notifications` asks when first used, and sets `response` from it only if nothing else has arrived.
An app that only listens for new taps does nothing on a cold start from a notification - the most
common notification-routing bug.

## Without the module

On iOS and Android, a missing `expo-notifications` (never installed, or not rebuilt since) throws a
`MissingModuleError` when the service first reaches for it, naming the module and the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, `latest` and `response` stay `null`, `take()` returns
`null`, `dismissAll()` and `setBadge()` do nothing, and both push token methods resolve to `null`.

## Push notifications from your server

A push from your backend needs a token identifying the device to a push service, sending it to your
server, and your server calling the push service. Expo's service is the easy route; a device token
lets you talk to APNs/FCM yourself.

### App configuration

All of this is `app.json`/`app.config.ts` and native project settings, not this package:

- **An EAS project.** `getExpoPushTokenAsync()` needs a `projectId`. `eas init` (or
  `eas build:configure`) writes `extra.eas.projectId` into your app config, and
  `Notifications.getExpoPushToken()` picks it up. Pass `projectId` explicitly only for a bare
  workflow app or one without EAS Build.
- **iOS: the Push Notifications capability**, plus the `remote-notification` background mode for a
  background handler. EAS Build adds the capability once `expo-notifications` is installed; a bare
  app enables it in Xcode under **Signing & Capabilities**. Expo's service also needs your APNs key
  uploaded (`eas credentials`). Not verified on a device.
- **Android: Firebase Cloud Messaging** - a `google-services.json` referenced from `app.json`'s
  `android.googleServicesFile`. Expo's service then holds Firebase's server key for you; a device
  push token (FCM directly) needs only the file. Not verified on a device.

Nothing is checked at build time: a missing `projectId` makes `getExpoPushToken()` reject, and a
missing FCM config means an Android token that silently never arrives.

### Getting the token

`getExpoPushToken()` asks the notification permission for you:

```tsx
import { useService } from '@solid-native/device/solid';
import { Notifications } from '@solid-native/expo/solid/notifications';

export function PushSetup() {
  const notifications = useService(Notifications);

  const registerForPush = async () => {
    const token = await notifications.getExpoPushToken();
    if (!token) return; // permission refused
    // send `token` to your server - see below
  };
  // ...call registerForPush() from a button, or once on sign-in
}
```

It resolves to `null` when the [permission](/packages/expo/permissions) is refused. That is the
only thing it swallows: no EAS project or being offline still rejects, so wrap it in `try`/`catch`
to retry.

If your backend talks to APNs or FCM directly, `getDevicePushToken()` gives the raw native token:

```ts
const native = await notifications.getDevicePushToken();
// { type: 'ios', data: '<hex APNs token>' } or { type: 'android', data: '<FCM token>' }
```

Same permission and missing-module rules. Most apps want the Expo token.

The platform can roll a token while the app runs, and the old one then fails silently.
`devicePushToken` updates when that happens, so an effect on it re-registers:

```tsx
createEffect(() => {
  const rolled = notifications.devicePushToken();
  if (rolled) void registerWithServer(rolled);
});
```

### Sending the token to your server

The global `fetch` is enough:

```ts
export async function registerPushToken(userId: string, expoPushToken: string): Promise<void> {
  const response = await fetch('https://example.com/push-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, expoPushToken }),
  });
  if (!response.ok) throw new Error(`Push registration failed: ${response.status}`);
}
```

Call it after `getExpoPushToken()` resolves, and again from the `devicePushToken` effect when the
token rolls - a server holding the old token never delivers.

### Receiving a push

A push arriving while the app is in front is `latest`, same as a local notification:

```tsx
createEffect(() => {
  const notification = notifications.latest();
  if (notification) showInAppBanner(notification);
});
```

With the app backgrounded or killed, iOS and Android decide whether to show it in the system tray
from the payload's priority/`content-available` flags - between your server and the push service,
not this package. _Unverified on a device in this change_: confirm your payload shows a system
notification with the app backgrounded, using [Expo's push notification tool](https://expo.dev/notifications)
or the `curl` example below.

### Handling the tap

A tapped notification - foreground, background or cold launch - is `response`; most routing wants
`take()`:

```tsx
const notifications = useService(Notifications);
const navigation = useNavigation();

createEffect(() => {
  const response = notifications.take();
  if (!response) return;
  const content = response.notification.request.content as { data?: { url?: string } };
  if (content.data?.url) void navigation.push(content.data.url);
});
```

Put the route in the payload's `data` on the server - `{ to: '/push', body: { data: { url:
'/notes/42' } } }` for Expo's push API - and read it from `response.notification.request.content`.
`take()` still returns the cold-launch response once, though it arrived before this effect.

### Sending a test push

With an Expo push token, [Expo's push notification tool](https://expo.dev/notifications) sends one
without server code. From a terminal:

```sh
curl -H "Content-Type: application/json" -X POST "https://exp.host/--/api/v2/push/send" \
  -d '{
    "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "title": "Test",
    "body": "Hello from curl",
    "data": { "url": "/notes/42" }
  }'
```

A device push token goes through APNs or FCM's own HTTP API instead. _Neither the curl example nor a
real send has been run against a device for this change; verify the token format and response shape
first._

## Everything else

Each method is the module's function of the same purpose, with its own arguments and types.

| Method                                                                                        | What it does                                                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `schedule(request)`                                                                           | Schedules a local notification, or shows one now with a `null` trigger; the identifier, or null without the module                    |
| `cancel(id)`, `cancelAll()`                                                                   | Cancels one scheduled notification, or all of them                                                                                    |
| `scheduled()`                                                                                 | Every local notification still waiting for its trigger                                                                                |
| `nextTriggerDate(trigger)`                                                                    | When a trigger would next fire, in milliseconds since the epoch                                                                       |
| `presented()`, `dismiss(id)`, `dismissAll()`                                                  | The app's notifications in the notification center, and clearing them                                                                 |
| `badge()`, `setBadge(count)`                                                                  | The app icon's badge                                                                                                                  |
| `channels()`, `channel(id)`, `setChannel(id, channel)`, `deleteChannel(id)`                   | Android's notification channels, which a notification on Android 8 and later needs                                                    |
| `channelGroups()`, `channelGroup(id)`, `setChannelGroup(id, group)`, `deleteChannelGroup(id)` | Android's channel groups                                                                                                              |
| `categories()`, `setCategory(id, actions, options)`, `deleteCategory(id)`                     | Action buttons, below                                                                                                                 |
| `setHandler(handler)`                                                                         | What a notification arriving while the app is in front does; without one it is not shown. Undone when the service's scope is disposed |
| `clearResponse()`                                                                             | Forgets the last tap, here and in the module                                                                                          |
| `dropped`                                                                                     | An accessor: how many times Android reported notifications dropped                                                                    |
| `unregister()`, `setAutoServerRegistration(enabled)`                                          | Stops push delivery; whether Expo re-registers the token itself                                                                       |
| `subscribeToTopic(topic)`, `unsubscribeFromTopic(topic)`                                      | Android: FCM topics                                                                                                                   |
| `registerTask(name)`, `unregisterTask(name)`                                                  | A background notification task, below                                                                                                 |

`TriggerType`, exported beside the service, is the module's `SchedulableTriggerInputTypes` without
loading the module, so scheduling code runs in a test:

```ts
import { Notifications, TriggerType } from '@solid-native/expo/solid/notifications';

const notifications = useService(Notifications); // in a component
await notifications.schedule({
  content: { title: 'Time to stretch' },
  trigger: { type: TriggerType.DAILY, hour: 9, minute: 0 },
});
```

## Action buttons and replies

Buttons are a category, set once with `setCategory`; a notification opts in with
`categoryIdentifier`. A button tap arrives as a response with the button's `identifier` as
`actionIdentifier`, and a `textInput` button carries the typed text as `userText`:

```ts
const notifications = useService(Notifications); // in a component
await notifications.setCategory('message', [
  {
    identifier: 'reply',
    buttonTitle: 'Reply',
    textInput: { submitButtonTitle: 'Send', placeholder: 'Message' },
  },
  {
    identifier: 'mark-read',
    buttonTitle: 'Mark as read',
    options: { opensAppToForeground: false },
  },
]);
```

```ts
const tapped = notifications.take();
if (tapped?.actionIdentifier === 'reply' && tapped.userText) {
  chat.send(tapped.notification.request.identifier, tapped.userText);
}
```

Since `take()` keys by notification and action, a body tap and a button tap on the same
notification are two responses, each handed over once.

## Background notifications

A task handling a notification while the app is backgrounded or not running goes through
`expo-task-manager`. It evaluates the entry module but does not run the app, so no Solid root
exists (only a launch with a screen runs the `AppRegistry.registerRunnable` registration). Define
the task at the top level of the entry module (`main.solid.ts`), without components or
`useService()`:

```ts
// main.solid.ts
import * as TaskManager from 'expo-task-manager';
import * as Expo from 'expo-notifications';

TaskManager.defineTask<Expo.NotificationTaskPayload>('notification-task', async ({ data }) => {
  // Plain functions and modules only: store the payload, sync, update the badge.
  return Expo.BackgroundNotificationResult.NewData;
});
void Expo.registerTaskAsync('notification-task');

AppRegistry.registerRunnable('main', ({ rootTag }) => {
  // mount(...) as before
});
```

The entry module has no service scope, so it registers with the module's `registerTaskAsync`; from
inside the app, `notifications.registerTask(name)` does the same. `@solid-native/*` imports have no
native side effects, so the task can share plain modules (a storage wrapper, an API client) that do
not need `useService()`. Remote pushes need APNs/FCM credentials and a development build; Expo Go
cannot receive them on Android.

## Custom notification UI

Custom expanded layouts and modifying a push before display (attaching an image, decrypting) are
native extensions on iOS - Notification Content and Notification Service Extensions - and custom
layouts on Android. They run in their own process without Solid or React Native, so they are
written in Swift or Kotlin and added with an Expo config plugin. Everything the app itself does
with notifications is the module and this service.

## Reference

`Notifications` is exported from `@solid-native/expo/solid/notifications`.

<!-- api: Notifications -->
