import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { ownedRequests, silence, sourcedService } from './owned.ts';
import { Permission, type PermissionResponse } from './permissions.ts';

// Local public shapes follow the installed SDK 57 declarations; importing this entry loads no native module.

export type PushNotificationTrigger = {
  type: 'push';
  payload?: Record<string, unknown>;
  remoteMessage?: FirebaseRemoteMessage;
};
export interface CalendarNotificationTrigger {
  type: 'calendar';
  repeats: boolean;
  dateComponents: {
    era?: number;
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
    second?: number;
    weekday?: number;
    weekdayOrdinal?: number;
    quarter?: number;
    weekOfMonth?: number;
    weekOfYear?: number;
    yearForWeekOfYear?: number;
    nanosecond?: number;
    isLeapMonth: boolean;
    isRepeatedDay: boolean;
    timeZone?: string;
    calendar?: string;
  };
}
export interface Region {
  type: string;
  identifier: string;
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
}
export interface CircularRegion extends Region {
  type: 'circular';
  radius: number;
  center: {
    latitude: number;
    longitude: number;
  };
}
export interface BeaconRegion extends Region {
  type: 'beacon';
  notifyEntryStateOnDisplay: boolean;
  major: number | null;
  minor: number | null;
  uuid?: string;
  beaconIdentityConstraint?: {
    uuid: string;
    major: number | null;
    minor: number | null;
  };
}
export interface LocationNotificationTrigger {
  type: 'location';
  repeats: boolean;
  region: CircularRegion | BeaconRegion;
}
export interface TimeIntervalNotificationTrigger {
  type: 'timeInterval';
  repeats: boolean;
  seconds: number;
}
export interface DailyNotificationTrigger {
  type: 'daily';
  hour: number;
  minute: number;
}
export interface WeeklyNotificationTrigger {
  type: 'weekly';
  weekday: number;
  hour: number;
  minute: number;
}
export interface MonthlyNotificationTrigger {
  type: 'monthly';
  day: number;
  hour: number;
  minute: number;
}
export interface YearlyNotificationTrigger {
  type: 'yearly';
  day: number;
  month: number;
  hour: number;
  minute: number;
}
export interface FirebaseRemoteMessage {
  collapseKey: string | null;
  data: Record<string, string>;
  from: string | null;
  messageId: string | null;
  messageType: string | null;
  originalPriority: number;
  priority: number;
  sentTime: number;
  to: string | null;
  ttl: number;
  notification: null | FirebaseRemoteMessageNotification;
}
export interface FirebaseRemoteMessageNotification {
  body: string | null;
  bodyLocalizationArgs: string[] | null;
  bodyLocalizationKey: string | null;
  channelId: string | null;
  clickAction: string | null;
  color: string | null;
  usesDefaultLightSettings: boolean;
  usesDefaultSound: boolean;
  usesDefaultVibrateSettings: boolean;
  eventTime: number | null;
  icon: string | null;
  imageUrl: string | null;
  lightSettings: number[] | null;
  link: string | null;
  localOnly: boolean;
  notificationCount: number | null;
  notificationPriority: number | null;
  sound: string | null;
  sticky: boolean;
  tag: string | null;
  ticker: string | null;
  title: string | null;
  titleLocalizationArgs: string[] | null;
  titleLocalizationKey: string | null;
  vibrateTimings: number[] | null;
  visibility: number | null;
}
export interface UnknownNotificationTrigger {
  type: 'unknown';
}
export type NotificationTrigger =
  | PushNotificationTrigger
  | LocationNotificationTrigger
  | NotificationTriggerInput
  | UnknownNotificationTrigger;
export type ChannelAwareTriggerInput = {
  channelId: string;
};
export const TriggerType = {
  CALENDAR: 'calendar',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
} as const;
export type SchedulableTriggerInputTypes = (typeof TriggerType)[keyof typeof TriggerType];
export type CalendarTriggerInput = {
  type: typeof TriggerType.CALENDAR;
  channelId?: string;
  repeats?: boolean;
  seconds?: number;
  timezone?: string;
  year?: number;
  month?: number;
  weekday?: number;
  weekOfMonth?: number;
  weekOfYear?: number;
  weekdayOrdinal?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
};
export type DailyTriggerInput = {
  type: typeof TriggerType.DAILY;
  channelId?: string;
  hour: number;
  minute: number;
};
export type WeeklyTriggerInput = {
  type: typeof TriggerType.WEEKLY;
  channelId?: string;
  weekday: number;
  hour: number;
  minute: number;
};
export type MonthlyTriggerInput = {
  type: typeof TriggerType.MONTHLY;
  channelId?: string;
  day: number;
  hour: number;
  minute: number;
};
export type YearlyTriggerInput = {
  type: typeof TriggerType.YEARLY;
  channelId?: string;
  day: number;
  month: number;
  hour: number;
  minute: number;
};
export type DateTriggerInput = {
  type: typeof TriggerType.DATE;
  date: Date | number;
  channelId?: string;
};
export type TimeIntervalTriggerInput = {
  type: typeof TriggerType.TIME_INTERVAL;
  channelId?: string;
  repeats?: boolean;
  seconds: number;
};
export type SchedulableNotificationTriggerInput =
  | CalendarTriggerInput
  | TimeIntervalTriggerInput
  | DailyTriggerInput
  | WeeklyTriggerInput
  | MonthlyTriggerInput
  | YearlyTriggerInput
  | DateTriggerInput;
export type NotificationTriggerInput =
  null | ChannelAwareTriggerInput | SchedulableNotificationTriggerInput;
export const AndroidNotificationPriority = {
  MIN: 'min',
  LOW: 'low',
  DEFAULT: 'default',
  HIGH: 'high',
  MAX: 'max',
} as const;
export type AndroidNotificationPriority =
  (typeof AndroidNotificationPriority)[keyof typeof AndroidNotificationPriority];
export type NotificationContent = {
  title: string | null;
  subtitle: string | null;
  body: string | null;
  data?: Record<string, unknown>;
  categoryIdentifier: string | null;
  sound: 'default' | 'defaultCritical' | 'custom' | 'defaultRingtone' | null;
} & (NotificationContentIos | NotificationContentAndroid);
export type InterruptionLevel = 'passive' | 'active' | 'timeSensitive' | 'critical';
export type NotificationContentIos = {
  launchImageName: string | null;
  badge: number | null;
  attachments: NotificationContentAttachmentIos[];
  summaryArgument?: string | null;
  summaryArgumentCount?: number;
  threadIdentifier: string | null;
  targetContentIdentifier?: string;
  interruptionLevel?: InterruptionLevel;
};
export type NotificationContentAttachmentIos = {
  identifier: string | null;
  url: string | null;
  type: string | null;
  typeHint?: string;
  hideThumbnail?: boolean;
  thumbnailClipArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  thumbnailTime?: number;
};
export type NotificationContentAndroid = {
  badge?: number;
  color?: string;
  priority?: AndroidNotificationPriority;
  vibrationPattern?: number[];
};
export interface NotificationRequest {
  identifier: string;
  content: NotificationContent;
  trigger: NotificationTrigger;
}
export type NotificationContentInput = {
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: boolean | 'default' | 'defaultCritical' | 'defaultRingtone' | (string & {});
  launchImageName?: string;
  vibrate?: number[];
  priority?: string;
  color?: string;
  autoDismiss?: boolean;
  categoryIdentifier?: string;
  sticky?: boolean;
  attachments?: NotificationContentAttachmentIos[];
  interruptionLevel?: InterruptionLevel;
};
export interface NotificationRequestInput {
  identifier?: string;
  content: NotificationContentInput;
  trigger: NotificationTriggerInput;
}
export interface Notification {
  date: number;
  request: NotificationRequest;
}
export interface NotificationResponse {
  notification: Notification;
  actionIdentifier: string;
  userText?: string;
}
export interface NotificationBehavior {
  shouldShowAlert?: boolean;
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
  priority?: AndroidNotificationPriority;
}
export interface NotificationAction {
  identifier: string;
  buttonTitle: string;
  textInput?: {
    submitButtonTitle: string;
    placeholder: string;
  };
  options?: {
    isDestructive?: boolean;
    isAuthenticationRequired?: boolean;
    opensAppToForeground?: boolean;
  };
}
export interface NotificationCategory {
  identifier: string;
  actions: NotificationAction[];
  options?: NotificationCategoryOptions;
}
export type NotificationCategoryOptions = {
  previewPlaceholder?: string;
  intentIdentifiers?: string[];
  categorySummaryFormat?: string;
  customDismissAction?: boolean;
  allowInCarPlay?: boolean;
  showTitle?: boolean;
  showSubtitle?: boolean;
  allowAnnouncement?: boolean;
};
export type MaybeNotificationResponse = NotificationResponse | null | undefined;
export type NotificationTaskPayload =
  | NotificationResponse
  | {
      notification: Record<string, unknown> | null;
      data: {
        dataString?: string;
        [key: string]: unknown;
      };
      aps?: Record<string, unknown>;
    };

export const AndroidNotificationVisibility = {
  UNKNOWN: 0,
  PUBLIC: 1,
  PRIVATE: 2,
  SECRET: 3,
} as const;
export type AndroidNotificationVisibility =
  (typeof AndroidNotificationVisibility)[keyof typeof AndroidNotificationVisibility];
export const AndroidAudioContentType = {
  UNKNOWN: 0,
  SPEECH: 1,
  MUSIC: 2,
  MOVIE: 3,
  SONIFICATION: 4,
} as const;
export type AndroidAudioContentType =
  (typeof AndroidAudioContentType)[keyof typeof AndroidAudioContentType];
export const AndroidImportance = {
  UNKNOWN: 0,
  UNSPECIFIED: 1,
  NONE: 2,
  MIN: 3,
  LOW: 4,
  DEFAULT: 5,
  HIGH: 6,
  MAX: 7,
} as const;
export type AndroidImportance = (typeof AndroidImportance)[keyof typeof AndroidImportance];
export const AndroidAudioUsage = {
  UNKNOWN: 0,
  MEDIA: 1,
  VOICE_COMMUNICATION: 2,
  VOICE_COMMUNICATION_SIGNALLING: 3,
  ALARM: 4,
  NOTIFICATION: 5,
  NOTIFICATION_RINGTONE: 6,
  NOTIFICATION_COMMUNICATION_REQUEST: 7,
  NOTIFICATION_COMMUNICATION_INSTANT: 8,
  NOTIFICATION_COMMUNICATION_DELAYED: 9,
  NOTIFICATION_EVENT: 10,
  ASSISTANCE_ACCESSIBILITY: 11,
  ASSISTANCE_NAVIGATION_GUIDANCE: 12,
  ASSISTANCE_SONIFICATION: 13,
  GAME: 14,
} as const;
export type AndroidAudioUsage = (typeof AndroidAudioUsage)[keyof typeof AndroidAudioUsage];
export interface AudioAttributes {
  usage: AndroidAudioUsage;
  contentType: AndroidAudioContentType;
  flags: {
    enforceAudibility: boolean;
    requestHardwareAudioVideoSynchronization: boolean;
  };
}
export type AudioAttributesInput = Partial<AudioAttributes>;
export interface NotificationChannel {
  id: string;
  name: string | null;
  importance: AndroidImportance;
  bypassDnd: boolean;
  description: string | null;
  groupId?: string | null;
  lightColor: string;
  lockscreenVisibility: AndroidNotificationVisibility;
  showBadge: boolean;
  sound: 'default' | 'custom' | null;
  audioAttributes: AudioAttributes;
  vibrationPattern: number[] | null;
  enableLights: boolean;
  enableVibrate: boolean;
}
export type RequiredBy<T, K extends keyof T> = Partial<Omit<T, K>> & Required<Pick<T, K>>;
export type NotificationChannelInput = RequiredBy<
  Omit<NotificationChannel, 'id' | 'audioAttributes' | 'sound'> & {
    audioAttributes?: AudioAttributesInput;
    sound?: string | null;
  },
  'name' | 'importance'
>;

export interface NotificationChannelGroup {
  id: string;
  name: string | null;
  description?: string | null;
  isBlocked?: boolean;
  channels: NotificationChannel[];
}
export interface NotificationChannelGroupInput {
  name: string | null;
  description?: string | null;
}

export const IosAlertStyle = {
  NONE: 0,
  BANNER: 1,
  ALERT: 2,
} as const;
export type IosAlertStyle = (typeof IosAlertStyle)[keyof typeof IosAlertStyle];
export const IosAllowsPreviews = {
  NEVER: 0,
  ALWAYS: 1,
  WHEN_AUTHENTICATED: 2,
} as const;
export type IosAllowsPreviews = (typeof IosAllowsPreviews)[keyof typeof IosAllowsPreviews];
export const IosAuthorizationStatus = {
  NOT_DETERMINED: 0,
  DENIED: 1,
  AUTHORIZED: 2,
  PROVISIONAL: 3,
  EPHEMERAL: 4,
} as const;
export type IosAuthorizationStatus =
  (typeof IosAuthorizationStatus)[keyof typeof IosAuthorizationStatus];
export interface NotificationPermissionsStatus extends PermissionResponse {
  android?: {
    importance: number;
    interruptionFilter?: number;
  };
  ios?: {
    status: IosAuthorizationStatus;
    allowsDisplayInNotificationCenter: boolean | null;
    allowsDisplayOnLockScreen: boolean | null;
    allowsDisplayInCarPlay: boolean | null;
    allowsAlert: boolean | null;
    allowsBadge: boolean | null;
    allowsSound: boolean | null;
    allowsCriticalAlerts: boolean | null;
    alertStyle: IosAlertStyle;
    allowsPreviews: IosAllowsPreviews | null;
    providesAppNotificationSettings: boolean | null;
    allowsAnnouncements: boolean | null;
  };
}
export interface IosNotificationPermissionsRequest {
  allowAlert?: boolean;
  allowBadge?: boolean;
  allowSound?: boolean;
  allowDisplayInCarPlay?: boolean;
  allowCriticalAlerts?: boolean;
  provideAppNotificationSettings?: boolean;
  allowProvisional?: boolean;
}
export type NativeNotificationPermissionsRequest = IosNotificationPermissionsRequest | object;
export interface NotificationPermissionsRequest {
  ios?: IosNotificationPermissionsRequest;
  android?: object;
}

export type DevicePushToken =
  { type: 'ios' | 'android'; data: string } | { type: string; data: unknown };
export interface ExpoPushToken {
  type: 'expo';
  data: string;
}
export interface NotificationHandler {
  handleNotification(notification: Notification): Promise<NotificationBehavior>;
  handleSuccess?(identifier: string): void;
  handleError?(identifier: string, error: Error): void;
}
interface Subscription {
  remove(): void;
}
export interface NativeNotifications {
  addNotificationReceivedListener(listener: (event: Notification) => void): Subscription;
  addNotificationResponseReceivedListener(
    listener: (event: NotificationResponse) => void,
  ): Subscription;
  addNotificationsDroppedListener(listener: () => void): Subscription;
  addPushTokenListener(listener: (token: DevicePushToken) => void): Subscription;
  getLastNotificationResponseAsync(): Promise<NotificationResponse | null>;
  clearLastNotificationResponseAsync(): Promise<void>;
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(options?: NotificationPermissionsRequest): Promise<PermissionResponse>;
  scheduleNotificationAsync(request: NotificationRequestInput): Promise<string>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
  cancelAllScheduledNotificationsAsync(): Promise<void>;
  getAllScheduledNotificationsAsync(): Promise<NotificationRequest[]>;
  getNextTriggerDateAsync(trigger: SchedulableNotificationTriggerInput): Promise<number | null>;
  getPresentedNotificationsAsync(): Promise<Notification[]>;
  dismissNotificationAsync(identifier: string): Promise<void>;
  dismissAllNotificationsAsync(): Promise<void>;
  getBadgeCountAsync(): Promise<number>;
  setBadgeCountAsync(count: number): Promise<boolean>;
  getNotificationChannelsAsync(): Promise<NotificationChannel[]>;
  getNotificationChannelAsync(identifier: string): Promise<NotificationChannel | null>;
  setNotificationChannelAsync(
    identifier: string,
    channel: NotificationChannelInput,
  ): Promise<NotificationChannel | null>;
  deleteNotificationChannelAsync(identifier: string): Promise<void>;
  getNotificationChannelGroupsAsync(): Promise<NotificationChannelGroup[]>;
  getNotificationChannelGroupAsync(identifier: string): Promise<NotificationChannelGroup | null>;
  setNotificationChannelGroupAsync(
    identifier: string,
    group: NotificationChannelGroupInput,
  ): Promise<NotificationChannelGroup | null>;
  deleteNotificationChannelGroupAsync(identifier: string): Promise<void>;
  getNotificationCategoriesAsync(): Promise<NotificationCategory[]>;
  setNotificationCategoryAsync(
    identifier: string,
    actions: NotificationAction[],
    options?: NotificationCategoryOptions,
  ): Promise<NotificationCategory>;
  deleteNotificationCategoryAsync(identifier: string): Promise<boolean>;
  setNotificationHandler(handler: NotificationHandler | null): void;
  getExpoPushTokenAsync(options?: { projectId?: string }): Promise<ExpoPushToken>;
  getDevicePushTokenAsync(): Promise<DevicePushToken>;
  unregisterForNotificationsAsync(): Promise<void>;
  setAutoServerRegistrationEnabledAsync(enabled: boolean): Promise<void>;
  subscribeToTopicAsync(topic: string): Promise<unknown>;
  unsubscribeFromTopicAsync(topic: string): Promise<unknown>;
  registerTaskAsync(name: string): Promise<unknown>;
  unregisterTaskAsync(name: string): Promise<unknown>;
}
export interface Notifications {
  readonly permission: Permission;
  readonly latest: Accessor<Notification | null>;
  readonly response: Accessor<NotificationResponse | null>;
  readonly dropped: Accessor<number>;
  readonly devicePushToken: Accessor<DevicePushToken | null>;
  take(): NotificationResponse | null;
  clearResponse(): Promise<void>;
  requestPermission(options?: NotificationPermissionsRequest): Promise<boolean>;
  schedule(request: NotificationRequestInput): Promise<string | null>;
  cancel(identifier: string): Promise<void>;
  cancelAll(): Promise<void>;
  scheduled(): Promise<NotificationRequest[]>;
  nextTriggerDate(trigger: SchedulableNotificationTriggerInput): Promise<number | null>;
  presented(): Promise<Notification[]>;
  dismiss(identifier: string): Promise<void>;
  dismissAll(): void;
  badge(): Promise<number>;
  setBadge(count: number): void;
  channels(): Promise<NotificationChannel[]>;
  channel(identifier: string): Promise<NotificationChannel | null>;
  setChannel(
    identifier: string,
    channel: NotificationChannelInput,
  ): Promise<NotificationChannel | null>;
  deleteChannel(identifier: string): Promise<void>;
  channelGroups(): Promise<NotificationChannelGroup[]>;
  channelGroup(identifier: string): Promise<NotificationChannelGroup | null>;
  setChannelGroup(
    identifier: string,
    group: NotificationChannelGroupInput,
  ): Promise<NotificationChannelGroup | null>;
  deleteChannelGroup(identifier: string): Promise<void>;
  categories(): Promise<NotificationCategory[]>;
  setCategory(
    identifier: string,
    actions: NotificationAction[],
    options?: NotificationCategoryOptions,
  ): Promise<NotificationCategory | null>;
  deleteCategory(identifier: string): Promise<boolean>;
  setHandler(handler: NotificationHandler | null): void;
  getExpoPushToken(projectId?: string): Promise<string | null>;
  getDevicePushToken(): Promise<DevicePushToken | null>;
  unregister(): Promise<void>;
  setAutoServerRegistration(enabled: boolean): Promise<void>;
  subscribeToTopic(topic: string): Promise<void>;
  unsubscribeFromTopic(topic: string): Promise<void>;
  registerTask(name: string): Promise<void>;
  unregisterTask(name: string): Promise<void>;
}
const UNAVAILABLE: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
export const Notifications = sourcedService<Notifications, NativeNotifications | null>(
  'expo.notifications',
  () =>
    expoModule('expo-notifications', () => require('expo-notifications') as NativeNotifications),
  (native) => {
    const requests = ownedRequests();
    const [latest, setLatest] = createSignal<Notification | null>(null);
    const [response, setResponse] = createSignal<NotificationResponse | null>(null);
    const [dropped, setDropped] = createSignal(0);
    const [devicePushToken, setDevicePushToken] = createSignal<DevicePushToken | null>(null);
    const handled = new Set<string>();
    let responseRevision = 0;
    const subscriptions: Subscription[] = [];
    let listening = true;
    const release = () => {
      listening = false;
      for (const subscription of subscriptions.splice(0)) silence(() => subscription.remove());
    };
    const handler = native ? handlerClaim(native) : undefined;
    onCleanup(() => {
      release();
      silence(() => handler?.release());
    });
    const permission = Permission.of(
      () => native?.getPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
      () => native?.requestPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
    );
    const acquire = (start: () => Subscription) => {
      if (!requests.active()) return;
      const subscription = start();
      if (requests.active()) subscriptions.push(subscription);
      else silence(() => subscription.remove());
    };
    try {
      if (native) {
        acquire(() =>
          native.addNotificationReceivedListener((event) => {
            if (listening && requests.active()) setLatest(event);
          }),
        );
        acquire(() =>
          native.addNotificationResponseReceivedListener((event) => {
            if (listening && requests.active()) {
              responseRevision++;
              setResponse(event);
            }
          }),
        );
        acquire(() =>
          native.addNotificationsDroppedListener(() => {
            if (listening && requests.active()) setDropped((count) => count + 1);
          }),
        );
        acquire(() =>
          native.addPushTokenListener((token) => {
            if (listening && requests.active()) setDevicePushToken(token);
          }),
        );
        const revision = responseRevision;
        if (revision === 0)
          silence(() =>
            requests.run<NotificationResponse | null>(
              null,
              () => native.getLastNotificationResponseAsync(),
              (value) => {
                if (value && responseRevision === revision) setResponse(value);
              },
            ),
          );
      }
    } catch (error) {
      release();
      throw error;
    }
    return {
      permission,
      latest,
      response,
      dropped,
      devicePushToken,
      take: () => {
        if (!requests.active()) return null;
        const value = response();
        if (!value) return null;
        const key = JSON.stringify([value.notification.request.identifier, value.actionIdentifier]);
        if (handled.has(key)) return null;
        handled.add(key);
        return value;
      },
      clearResponse: () =>
        requests.run(undefined, (active) => {
          responseRevision++;
          setResponse(null);
          if (active()) return native?.clearLastNotificationResponseAsync();
          return undefined;
        }),
      requestPermission: (options) =>
        requests.run(false, async (active) => {
          if (!native) return false;
          await native.requestPermissionsAsync(options);
          return active() ? permission.check() : false;
        }),
      schedule: (request) =>
        requests.run<string | null>(
          null,
          async () => (await native?.scheduleNotificationAsync(request)) ?? null,
        ),
      cancel: (id) => requests.run(undefined, () => native?.cancelScheduledNotificationAsync(id)),
      cancelAll: () =>
        requests.run(undefined, () => native?.cancelAllScheduledNotificationsAsync()),
      scheduled: () =>
        requests.run<NotificationRequest[]>(
          [],
          async () => (await native?.getAllScheduledNotificationsAsync()) ?? [],
        ),
      nextTriggerDate: (trigger) =>
        requests.run<number | null>(
          null,
          async () => (await native?.getNextTriggerDateAsync(trigger)) ?? null,
        ),
      presented: () =>
        requests.run<Notification[]>(
          [],
          async () => (await native?.getPresentedNotificationsAsync()) ?? [],
        ),
      dismiss: (id) => requests.run(undefined, () => native?.dismissNotificationAsync(id)),
      dismissAll: () => {
        if (requests.active()) silence(() => native?.dismissAllNotificationsAsync());
      },
      badge: () => requests.run(0, async () => (await native?.getBadgeCountAsync()) ?? 0),
      setBadge: (count) => {
        if (requests.active()) silence(() => native?.setBadgeCountAsync(count));
      },
      channels: () =>
        requests.run<NotificationChannel[]>(
          [],
          async () => (await native?.getNotificationChannelsAsync()) ?? [],
        ),
      channel: (id) =>
        requests.run<NotificationChannel | null>(
          null,
          async () => (await native?.getNotificationChannelAsync(id)) ?? null,
        ),
      setChannel: (id, channel) =>
        requests.run<NotificationChannel | null>(
          null,
          async () => (await native?.setNotificationChannelAsync(id, channel)) ?? null,
        ),
      deleteChannel: (id) =>
        requests.run(undefined, () => native?.deleteNotificationChannelAsync(id)),
      channelGroups: () =>
        requests.run<NotificationChannelGroup[]>(
          [],
          async () => (await native?.getNotificationChannelGroupsAsync()) ?? [],
        ),
      channelGroup: (id) =>
        requests.run<NotificationChannelGroup | null>(
          null,
          async () => (await native?.getNotificationChannelGroupAsync(id)) ?? null,
        ),
      setChannelGroup: (id, group) =>
        requests.run<NotificationChannelGroup | null>(
          null,
          async () => (await native?.setNotificationChannelGroupAsync(id, group)) ?? null,
        ),
      deleteChannelGroup: (id) =>
        requests.run(undefined, () => native?.deleteNotificationChannelGroupAsync(id)),
      categories: () =>
        requests.run<NotificationCategory[]>(
          [],
          async () => (await native?.getNotificationCategoriesAsync()) ?? [],
        ),
      setCategory: (id, actions, options) =>
        requests.run<NotificationCategory | null>(
          null,
          async () => (await native?.setNotificationCategoryAsync(id, actions, options)) ?? null,
        ),
      deleteCategory: (id) =>
        requests.run(
          false,
          async () => (await native?.deleteNotificationCategoryAsync(id)) ?? false,
        ),
      // The newest live service policy owns Expo's module-global handler.
      setHandler: (value) => {
        if (requests.active()) handler?.set(value);
      },
      getExpoPushToken: (projectId) =>
        requests.run<string | null>(null, async (active) => {
          if (!native || !(await permission.ensure()) || !active()) return null;
          return (await native.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
        }),
      getDevicePushToken: () =>
        requests.run<DevicePushToken | null>(null, async (active) => {
          if (!native || !(await permission.ensure()) || !active()) return null;
          return native.getDevicePushTokenAsync();
        }),
      unregister: () => requests.run(undefined, () => native?.unregisterForNotificationsAsync()),
      setAutoServerRegistration: (enabled) =>
        requests.run(undefined, () => native?.setAutoServerRegistrationEnabledAsync(enabled)),
      subscribeToTopic: (topic) =>
        requests.run(undefined, async () => {
          await native?.subscribeToTopicAsync(topic);
        }),
      unsubscribeFromTopic: (topic) =>
        requests.run(undefined, async () => {
          await native?.unsubscribeFromTopicAsync(topic);
        }),
      registerTask: (name) =>
        requests.run(undefined, async () => {
          await native?.registerTaskAsync(name);
        }),
      unregisterTask: (name) =>
        requests.run(undefined, async () => {
          await native?.unregisterTaskAsync(name);
        }),
    };
  },
);

interface HandlerClaim {
  handler: NotificationHandler | null;
}
interface HandlerState {
  claims: HandlerClaim[];
  applied: HandlerClaim | null;
  reconciling: boolean;
}
const handlerStates = new WeakMap<NativeNotifications, HandlerState>();
function handlerClaim(native: NativeNotifications) {
  let state = handlerStates.get(native);
  if (!state) {
    state = { claims: [], applied: null, reconciling: false };
    handlerStates.set(native, state);
  }
  const shared = state;
  let own: HandlerClaim | undefined;
  let live = true;
  const reconcile = () => {
    if (shared.reconciling) return;
    shared.reconciling = true;
    try {
      while (shared.applied !== (shared.claims.at(-1) ?? null)) {
        const next = shared.claims.at(-1) ?? null;
        // Publish ownership before a native setter can synchronously reenter another scope.
        const previous = shared.applied;
        shared.applied = next;
        try {
          native.setNotificationHandler(next?.handler ?? null);
        } catch (error) {
          if (shared.applied === next) shared.applied = previous;
          throw error;
        }
      }
    } finally {
      shared.reconciling = false;
    }
  };
  const remove = () => {
    if (!own) return;
    const index = shared.claims.indexOf(own);
    if (index >= 0) shared.claims.splice(index, 1);
    own = undefined;
  };
  return {
    set(handler: NotificationHandler | null) {
      if (!live) return;
      remove();
      own = { handler };
      shared.claims.push(own);
      reconcile();
    },
    release() {
      live = false;
      remove();
      reconcile();
    },
  };
}
