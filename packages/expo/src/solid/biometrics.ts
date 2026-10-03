import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';

export type BiometricKind = 'fingerprint' | 'face' | 'iris';
export type AuthenticationResult =
  { success: true } | { success: false; error: string; warning?: string };
export interface AuthenticateOptions {
  promptSubtitle?: string;
  promptDescription?: string;
  cancelLabel?: string;
  disableDeviceFallback?: boolean;
  requireConfirmation?: boolean;
  biometricsSecurityLevel?: 'weak' | 'strong';
  fallbackLabel?: string;
}
export interface NativeBiometrics {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  supportedAuthenticationTypesAsync(): Promise<number[]>;
  authenticateAsync(
    options?: AuthenticateOptions & { promptMessage?: string },
  ): Promise<AuthenticationResult>;
}
export interface Biometrics {
  available(): Promise<boolean>;
  kinds(): Promise<BiometricKind[]>;
  authenticate(message: string, options?: AuthenticateOptions): Promise<AuthenticationResult>;
}
const KINDS: Record<number, BiometricKind> = { 1: 'fingerprint', 2: 'face', 3: 'iris' };
export const Biometrics = sourcedService<Biometrics, NativeBiometrics | null>(
  'expo.biometrics',
  () =>
    expoModule(
      'expo-local-authentication',
      () => require('expo-local-authentication') as NativeBiometrics,
    ),
  (native) => {
    const requests = ownedRequests();
    return {
      available: () =>
        requests.run(false, async (active) => {
          if (!native) return false;
          const hardware = native.hasHardwareAsync();
          if (!active()) {
            void hardware.catch(() => {});
            return false;
          }
          const result = await Promise.all([hardware, native.isEnrolledAsync()]);
          return result.every(Boolean);
        }),
      kinds: () =>
        requests.run<BiometricKind[]>([], async () =>
          ((await native?.supportedAuthenticationTypesAsync()) ?? []).flatMap(
            (kind) => KINDS[kind] ?? [],
          ),
        ),
      authenticate: (message, options = {}) =>
        requests.run<AuthenticationResult>(
          { success: false, error: 'app_cancel' },
          () =>
            native?.authenticateAsync({ promptMessage: message, ...options }) ?? {
              success: false,
              error: 'not_available',
            },
        ),
    };
  },
);
