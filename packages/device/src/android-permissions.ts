/**
 * Android's runtime permissions, in the shape the rest of the permissions here take.
 *
 * `PermissionsAndroid` predates the pattern every Expo module settled on - it returns a string
 * where they return a record, and has no notion of "the platform will not ask again" beyond a
 * third status. This adapts it, so a camera permission from `expo-camera` and a
 * `POST_NOTIFICATIONS` from Android read the same way at the call site.
 *
 * On iOS every one of these is granted: the permissions Android asks about at runtime are ones
 * iOS either grants at install or does not have.
 */

import { reactNative } from './react-native.ts';

export interface AndroidPermissions {
  check(permission: string): Promise<boolean>;
  request(permission: string, rationale?: object): Promise<string>;
}

/** What every permission call here answers with, matching Expo's own shape. */
export interface PermissionAnswer {
  readonly status: 'granted' | 'denied' | 'undetermined';
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}

const GRANTED: PermissionAnswer = { status: 'granted', granted: true, canAskAgain: false };

/**
 * The pair of functions `Permission.of` takes, for one Android permission.
 *
 * ```ts
 * const notify = Permission.of(...androidPermission('android.permission.POST_NOTIFICATIONS'));
 * ```
 */
export function androidPermission(
  permission: string,
): [() => Promise<PermissionAnswer>, () => Promise<PermissionAnswer>] {
  const native = reactNative();
  // `PermissionsAndroid` is the same module object on every platform - it is not absent on iOS,
  // it is a stub that warns and resolves `false`/`'denied'`. Left ungated, this would read an iOS
  // permission the platform never asked about as refused, rather than the `granted` promised above.
  const android = native?.Platform.OS === 'android' ? (native.PermissionsAndroid ?? null) : null;
  return androidPermissionOf(android, permission);
}

/** The same, against a stated platform. Separated so a test can drive it without a device. */
export function androidPermissionOf(
  native: AndroidPermissions | null,
  permission: string,
): [() => Promise<PermissionAnswer>, () => Promise<PermissionAnswer>] {
  if (!native) return [async () => GRANTED, async () => GRANTED];

  return [
    async () => {
      // `check` cannot tell "denied" from "not yet asked", and only the second is worth a dialog.
      // Undetermined is the honest answer, and `ensure()` will ask.
      const granted = await native.check(permission);
      return granted ? GRANTED : { status: 'undetermined', granted: false, canAskAgain: true };
    },
    async () => {
      const result = await native.request(permission);
      if (result === 'granted') return GRANTED;
      // `never_ask_again` is Android's way of saying the dialog is over. Anything else is a no
      // the user can still change their mind about.
      const canAskAgain = result !== 'never_ask_again';
      return { status: 'denied', granted: false, canAskAgain };
    },
  ];
}
