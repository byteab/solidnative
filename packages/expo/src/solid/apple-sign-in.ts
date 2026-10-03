import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { ownedRequests, silence, sourcedService } from './owned.ts';

export const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 } as const;
export type AppleAuthenticationScope =
  (typeof AppleAuthenticationScope)[keyof typeof AppleAuthenticationScope];
export const AppleAuthenticationCredentialState = {
  REVOKED: 0,
  AUTHORIZED: 1,
  NOT_FOUND: 2,
  TRANSFERRED: 3,
} as const;
export type AppleAuthenticationCredentialState =
  (typeof AppleAuthenticationCredentialState)[keyof typeof AppleAuthenticationCredentialState];
export const AppleAuthenticationButtonType = { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 } as const;
export const AppleAuthenticationButtonStyle = { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 } as const;
export interface AppleAuthenticationFullName {
  namePrefix: string | null;
  givenName: string | null;
  middleName: string | null;
  familyName: string | null;
  nameSuffix: string | null;
  nickname: string | null;
}
export type AppleAuthenticationFullNameFormatStyle =
  'default' | 'short' | 'medium' | 'long' | 'abbreviated';
export interface AppleAuthenticationCredential {
  user: string;
  state: string | null;
  fullName: AppleAuthenticationFullName | null;
  email: string | null;
  realUserStatus: 0 | 1 | 2;
  identityToken: string | null;
  authorizationCode: string | null;
}
export interface AppleAuthenticationSignInOptions {
  requestedScopes?: AppleAuthenticationScope[];
  state?: string;
  nonce?: string;
}
export interface AppleAuthenticationRefreshOptions {
  user: string;
  requestedScopes?: AppleAuthenticationScope[];
  state?: string;
}
export interface AppleAuthenticationSignOutOptions {
  user: string;
  state?: string;
}
export interface NativeAppleAuthentication {
  isAvailableAsync(): Promise<boolean>;
  signInAsync(options?: AppleAuthenticationSignInOptions): Promise<AppleAuthenticationCredential>;
  refreshAsync(options: AppleAuthenticationRefreshOptions): Promise<AppleAuthenticationCredential>;
  signOutAsync(options: AppleAuthenticationSignOutOptions): Promise<AppleAuthenticationCredential>;
  getCredentialStateAsync(user: string): Promise<AppleAuthenticationCredentialState>;
  formatFullName(
    fullName: AppleAuthenticationFullName,
    formatStyle?: AppleAuthenticationFullNameFormatStyle,
  ): string;
  addRevokeListener(listener: () => void): { remove(): void };
}
export interface AppleSignIn {
  readonly revoked: Accessor<number>;
  available(): Promise<boolean>;
  signIn(options?: AppleAuthenticationSignInOptions): Promise<AppleAuthenticationCredential | null>;
  refresh(
    options: AppleAuthenticationRefreshOptions,
  ): Promise<AppleAuthenticationCredential | null>;
  signOut(
    options: AppleAuthenticationSignOutOptions,
  ): Promise<AppleAuthenticationCredential | null>;
  credentialState(user: string): Promise<AppleAuthenticationCredentialState | null>;
  formatName(
    fullName: AppleAuthenticationFullName,
    formatStyle?: AppleAuthenticationFullNameFormatStyle,
  ): string;
}

export const AppleSignIn = sourcedService<AppleSignIn, NativeAppleAuthentication | null>(
  'expo.appleSignIn',
  () =>
    expoModule(
      'expo-apple-authentication',
      () => require('expo-apple-authentication') as NativeAppleAuthentication,
      ['ios'],
    ),
  (native) => {
    const requests = ownedRequests();
    const [revoked, setRevoked] = createSignal(0);
    let live = true;
    let subscription: { remove(): void } | undefined;
    onCleanup(() => {
      live = false;
      const held = subscription;
      subscription = undefined;
      if (held) silence(() => held.remove());
    });
    if (native) {
      const held = native.addRevokeListener(() => {
        if (live) setRevoked((value) => value + 1);
      });
      if (live) subscription = held;
      else silence(() => held.remove());
    }
    return {
      revoked,
      available: () => requests.run(false, () => native?.isAvailableAsync() ?? false),
      signIn: (options) =>
        requests.run(null, async () => {
          try {
            return (await native?.signInAsync(options)) ?? null;
          } catch (error) {
            if ((error as { code?: unknown } | null)?.code === 'ERR_REQUEST_CANCELED') return null;
            throw error;
          }
        }),
      refresh: (options) => requests.run(null, () => native?.refreshAsync(options) ?? null),
      signOut: (options) => requests.run(null, () => native?.signOutAsync(options) ?? null),
      credentialState: (user) =>
        requests.run(null, () => native?.getCredentialStateAsync(user) ?? null),
      formatName: (name, style) => (live ? (native?.formatFullName(name, style) ?? '') : ''),
    };
  },
);

export {
  AppleSignInButton,
  type AppleSignInButtonProps,
  type AppleButtonStyle,
  type AppleButtonType,
} from './apple-sign-in-button.ts';
