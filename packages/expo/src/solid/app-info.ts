import { expoModule } from '../native.ts';
import { sourcedService } from './owned.ts';

export type DeviceKind = 'phone' | 'tablet' | 'desktop' | 'tv' | 'unknown';

/** Expo's `DeviceType` enum, whose values are these numbers. */
const KINDS: Record<number, DeviceKind> = {
  0: 'unknown',
  1: 'phone',
  2: 'tablet',
  3: 'desktop',
  4: 'tv',
};

/** The constants this reads, from each module. */
export interface NativeAppInfo {
  readonly application: {
    readonly nativeApplicationVersion: string | null;
    readonly nativeBuildVersion: string | null;
    readonly applicationId: string | null;
    readonly applicationName: string | null;
  } | null;
  readonly device: {
    readonly modelName: string | null;
    readonly brand: string | null;
    readonly osName: string | null;
    readonly osVersion: string | null;
    readonly isDevice: boolean;
    readonly deviceType: number | null;
  } | null;
}

export interface AppInfo {
  readonly version: string | null;
  readonly build: string | null;
  readonly id: string | null;
  readonly name: string | null;
  readonly device: {
    readonly model: string | null;
    readonly brand: string | null;
    readonly os: string | null;
    readonly osVersion: string | null;
    readonly physical: boolean | null;
    readonly type: DeviceKind | null;
  };
}

/** Constants captured once per service scope; native modules load only on first use. */
export const AppInfo = sourcedService<AppInfo, NativeAppInfo>(
  'expo.appInfo',
  () => ({
    application: expoModule(
      'expo-application',
      () => require('expo-application') as NonNullable<NativeAppInfo['application']>,
    ),
    device: expoModule(
      'expo-device',
      () => require('expo-device') as NonNullable<NativeAppInfo['device']>,
    ),
  }),
  (native) => ({
    version: native.application?.nativeApplicationVersion ?? null,
    build: native.application?.nativeBuildVersion ?? null,
    id: native.application?.applicationId ?? null,
    name: native.application?.applicationName ?? null,
    device: deviceOf(native.device),
  }),
);

/** What a device reads as without `expo-device`: nothing known. */
const UNKNOWN_DEVICE = {
  modelName: null,
  brand: null,
  osName: null,
  osVersion: null,
  isDevice: null,
  deviceType: null,
};

function deviceOf(native: NativeAppInfo['device']) {
  const device = native ?? UNKNOWN_DEVICE;
  return {
    /** `iPhone 17 Pro`, `Pixel 9`. */
    model: device.modelName,
    brand: device.brand,
    /** `iOS`, `iPadOS`, `Android`. */
    os: device.osName,
    osVersion: device.osVersion,
    /** False in a simulator or emulator. */
    physical: device.isDevice,
    type: device.deviceType === null ? null : (KINDS[device.deviceType] ?? 'unknown'),
  } as const;
}
