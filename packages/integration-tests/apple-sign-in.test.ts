/**
 * `AppleSignIn`, over a fake of `expo-apple-authentication` that records every call: each method
 * reaching the module under its own name, a cancelled sheet answering null rather than throwing,
 * revocations counted, and nothing broken without the module. The enums are the module's own,
 * read from its compiled output because Node cannot load the module.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, describe, it } from 'node:test';
import {
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
  AppleAuthenticationCredentialState,
  AppleAuthenticationScope,
  AppleSignIn,
  type NativeAppleAuthentication,
} from '@solidnative/expo/apple-sign-in';
import { disposeServices, ownedService, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

const credential = { user: 'u1', identityToken: 'jwt', email: 'a@b.c' };

function platform(options: { available?: boolean; signIn?: () => Promise<unknown> } = {}) {
  const calls: unknown[][] = [];
  let revoke: (() => void) | undefined;
  const record =
    (name: string, answer?: unknown) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args]);
      return answer;
    };
  const native = {
    isAvailableAsync: record('isAvailableAsync', options.available ?? true),
    signInAsync: async (...args: unknown[]) => {
      calls.push(['signInAsync', ...args]);
      return options.signIn ? options.signIn() : credential;
    },
    refreshAsync: record('refreshAsync', credential),
    signOutAsync: record('signOutAsync', credential),
    getCredentialStateAsync: record('getCredentialStateAsync', 1),
    formatFullName: (...args: unknown[]) => (
      calls.push(['formatFullName', ...args]),
      'Ada Lovelace'
    ),
    addRevokeListener: (listener: () => void) => {
      revoke = listener;
      return { remove: () => void calls.push(['remove']) };
    },
  } as unknown as NativeAppleAuthentication;
  return Object.assign(native, { calls, revoke: () => revoke?.() });
}

const serviceOn = (native: NativeAppleAuthentication | null) => serviceWith(AppleSignIn, native);

describe('Sign in with Apple', () => {
  it('signs in with the scopes asked for, and hands the credential back', async () => {
    const native = platform();
    const apple = serviceOn(native);
    const scopes = [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL];
    assert.deepEqual(await apple.signIn({ requestedScopes: scopes }), credential);
    assert.deepEqual(native.calls, [['signInAsync', { requestedScopes: [0, 1] }]]);
  });

  it('answers null when the user cancels the sheet, and throws anything else', async () => {
    const cancelled = Object.assign(new Error('The user canceled'), {
      code: 'ERR_REQUEST_CANCELED',
    });
    const apple = serviceOn(platform({ signIn: () => Promise.reject(cancelled) }));
    assert.equal(await apple.signIn(), null);

    const broken = serviceOn(platform({ signIn: () => Promise.reject(new Error('no network')) }));
    await assert.rejects(broken.signIn(), /no network/);
  });

  it('reaches the rest of the module under its own names', async () => {
    const native = platform();
    const apple = serviceOn(native);
    assert.equal(await apple.available(), true);
    assert.deepEqual(await apple.refresh({ user: 'u1' }), credential);
    assert.deepEqual(await apple.signOut({ user: 'u1' }), credential);
    assert.equal(await apple.credentialState('u1'), AppleAuthenticationCredentialState.AUTHORIZED);
    assert.equal(
      apple.formatName({ givenName: 'Ada', familyName: 'Lovelace' } as never),
      'Ada Lovelace',
    );
    const names = native.calls.map(([name]) => name);
    assert.deepEqual(names, [
      'isAvailableAsync',
      'refreshAsync',
      'signOutAsync',
      'getCredentialStateAsync',
      'formatFullName',
    ]);
    assert.deepEqual(native.calls[3], ['getCredentialStateAsync', 'u1']);
  });

  it('counts revocations, and stops listening when the app is destroyed', () => {
    const native = platform();
    const service = ownedService(AppleSignIn, native);
    const apple = service.value;
    assert.equal(apple.revoked(), 0);
    native.revoke();
    assert.equal(apple.revoked(), 1);
    service.stop();
    assert.ok(native.calls.some(([name]) => name === 'remove'));
  });

  it('is inert rather than broken with no module installed', async () => {
    const apple = serviceOn(null);
    assert.equal(await apple.available(), false);
    assert.equal(await apple.signIn(), null);
    assert.equal(await apple.refresh({ user: 'u1' }), null);
    assert.equal(await apple.signOut({ user: 'u1' }), null);
    assert.equal(await apple.credentialState('u1'), null);
    assert.equal(apple.formatName({} as never), '');
    assert.equal(apple.revoked(), 0);
  });
});

describe('the Apple enums', () => {
  it('are the module s own, so a template or a test can use them without loading it', () => {
    const require = createRequire(import.meta.url);
    const types = readFileSync(
      require.resolve('expo-apple-authentication/build/AppleAuthentication.types.js'),
      'utf8',
    );
    const read = (name: string) =>
      Object.fromEntries(
        [...types.matchAll(new RegExp(`${name}\\[${name}\\["(\\w+)"\\] = (\\d+)\\]`, 'g'))].map(
          ([, key, value]) => [key, Number(value)],
        ),
      );
    for (const [name, mirror] of [
      ['AppleAuthenticationScope', AppleAuthenticationScope],
      ['AppleAuthenticationCredentialState', AppleAuthenticationCredentialState],
      ['AppleAuthenticationButtonType', AppleAuthenticationButtonType],
      ['AppleAuthenticationButtonStyle', AppleAuthenticationButtonStyle],
    ] as const) {
      const expo = read(name);
      assert.ok(Object.keys(expo).length > 0, `found ${name}`);
      assert.deepEqual({ ...mirror }, expo, name);
    }
  });
});
