/**
 * `Crypto`, over a fake of `expo-crypto` that records every call.
 *
 * Unlike the other Expo services, this one is not inert without its module: an empty identifier
 * or an empty hash is not a harmless answer, it is a wrong one that looks right. So a call without
 * the module throws, and says which package is missing.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  Crypto,
  CryptoDigestAlgorithm,
  CryptoEncoding,
  type NativeCrypto,
} from '@solid-native/expo/crypto';
import { disposeServices, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

function platform() {
  const calls: unknown[][] = [];
  const record =
    <T>(name: string, answer: T) =>
    (...args: unknown[]) => (calls.push([name, ...args]), answer);
  const buffer = new ArrayBuffer(4);
  const native = {
    randomUUID: record('randomUUID', 'uuid-1'),
    digestStringAsync: record('digestStringAsync', Promise.resolve('hash')),
    digest: record('digest', Promise.resolve(buffer)),
    getRandomBytes: record('getRandomBytes', new Uint8Array([1, 2])),
    getRandomBytesAsync: record('getRandomBytesAsync', Promise.resolve(new Uint8Array([3]))),
    getRandomValues: (array: Uint8Array) => (calls.push(['getRandomValues', array]), array.fill(7)),
  } as unknown as NativeCrypto;
  return Object.assign(native, { calls, buffer });
}

const serviceOn = (native: NativeCrypto | null) => serviceWith(Crypto, native);

describe('crypto', () => {
  it('reaches every function of the module under its own name, with its arguments', async () => {
    const native = platform();
    const crypto = serviceOn(native);
    const data = new Uint8Array([9]);
    const values = new Uint8Array(2);

    assert.equal(crypto.randomUUID(), 'uuid-1');
    assert.equal(
      await crypto.digestString(CryptoDigestAlgorithm.SHA256, 'hello', {
        encoding: CryptoEncoding.BASE64,
      }),
      'hash',
    );
    assert.equal(await crypto.digest(CryptoDigestAlgorithm.SHA1, data), native.buffer);
    assert.deepEqual(crypto.randomBytes(2), new Uint8Array([1, 2]));
    assert.deepEqual(await crypto.randomBytesAsync(1), new Uint8Array([3]));
    assert.equal(crypto.randomValues(values), values);
    assert.deepEqual(values, new Uint8Array([7, 7]));

    assert.deepEqual(native.calls, [
      ['randomUUID'],
      ['digestStringAsync', 'SHA-256', 'hello', { encoding: 'base64' }],
      ['digest', 'SHA-1', data],
      ['getRandomBytes', 2],
      ['getRandomBytesAsync', 1],
      ['getRandomValues', values],
    ]);
  });

  it('refuses rather than answering with an empty identifier or hash when the module is missing', async () => {
    const crypto = serviceOn(null);
    assert.throws(() => crypto.randomUUID(), /expo-crypto/);
    assert.throws(() => crypto.randomBytes(4), /expo-crypto/);
    assert.throws(() => crypto.randomValues(new Uint8Array(1)), /expo-crypto/);
    await assert.rejects(crypto.digestString(CryptoDigestAlgorithm.SHA256, 'x'), /expo-crypto/);
    await assert.rejects(
      crypto.digest(CryptoDigestAlgorithm.SHA256, new Uint8Array()),
      /expo-crypto/,
    );
    await assert.rejects(crypto.randomBytesAsync(4), /expo-crypto/);
  });
});

describe('digest algorithms and encodings', () => {
  it('are the module s own enums, so a hash can be asked for without loading the module', () => {
    // The enums live in a file Node cannot load, so their compiled lines are read as text.
    const require = createRequire(import.meta.url);
    const types = readFileSync(require.resolve('expo-crypto/build/Crypto.types.js'), 'utf8');
    const read = (name: string) =>
      Object.fromEntries(
        [...types.matchAll(new RegExp(`${name}\\["(\\w+)"\\] = "([\\w-]+)"`, 'g'))].map(
          ([, key, value]) => [key, value],
        ),
      );
    assert.ok(Object.keys(read('CryptoDigestAlgorithm')).length > 0, 'found the enum');
    assert.deepEqual({ ...CryptoDigestAlgorithm }, read('CryptoDigestAlgorithm'));
    assert.deepEqual({ ...CryptoEncoding }, read('CryptoEncoding'));
  });
});
