import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';
import { Permission, type PermissionResponse } from './permissions.ts';

export interface NativeTracking {
  getTrackingPermissionsAsync(): Promise<PermissionResponse>;
  requestTrackingPermissionsAsync(): Promise<PermissionResponse>;
  isAvailable(): boolean;
  getAdvertisingId(): string | null;
}
export interface Tracking {
  readonly permission: Permission;
  available(): boolean;
  advertisingId(): string | null;
}
const UNAVAILABLE: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
export const Tracking = sourcedService<Tracking, NativeTracking | null>(
  'expo.tracking',
  () =>
    expoModule(
      'expo-tracking-transparency',
      () => require('expo-tracking-transparency') as NativeTracking,
    ),
  (native) => {
    const requests = ownedRequests();
    return {
      permission: Permission.of(
        () => native?.getTrackingPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
        () => native?.requestTrackingPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
      ),
      available: () => requests.active() && (native?.isAvailable() ?? false),
      advertisingId: () => (requests.active() ? (native?.getAdvertisingId() ?? null) : null),
    };
  },
);
