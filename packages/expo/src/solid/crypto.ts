import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';

/** Native algorithm values without an optional-module declaration dependency. */
export const CryptoDigestAlgorithm = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA384: 'SHA-384',
  SHA512: 'SHA-512',
  MD2: 'MD2',
  MD4: 'MD4',
  MD5: 'MD5',
} as const;
export type CryptoDigestAlgorithm =
  (typeof CryptoDigestAlgorithm)[keyof typeof CryptoDigestAlgorithm];

/** How `digestString` writes its hash: hex unless asked otherwise. */
export const CryptoEncoding = {
  HEX: 'hex',
  BASE64: 'base64',
} as const;
export type CryptoEncoding = (typeof CryptoEncoding)[keyof typeof CryptoEncoding];
export interface CryptoDigestOptions {
  encoding: CryptoEncoding;
}
export type CryptoIntegerArray =
  Int8Array | Int16Array | Int32Array | Uint8Array | Uint8ClampedArray | Uint16Array | Uint32Array;

/** The installed native module's secure operations, also implemented by injected sources. */
export interface NativeCrypto {
  randomUUID(): string;
  digestStringAsync(
    algorithm: CryptoDigestAlgorithm,
    data: string,
    options?: CryptoDigestOptions,
  ): Promise<string>;
  digest(
    algorithm: CryptoDigestAlgorithm,
    data: ArrayBuffer | ArrayBufferView<ArrayBuffer>,
  ): Promise<ArrayBuffer>;
  getRandomBytes(count: number): Uint8Array;
  getRandomBytesAsync(count: number): Promise<Uint8Array>;
  getRandomValues<T extends CryptoIntegerArray>(array: T): T;
}

type Args<K extends keyof NativeCrypto> = Parameters<NativeCrypto[K]>;

export interface Crypto {
  randomUUID(): string;
  digestString(...args: Args<'digestStringAsync'>): Promise<string>;
  digest(...args: Args<'digest'>): Promise<ArrayBuffer>;
  randomBytes(count: number): Uint8Array;
  randomBytesAsync(count: number): Promise<Uint8Array>;
  randomValues<T extends Args<'getRandomValues'>[0]>(array: T): T;
}
export const Crypto = sourcedService<Crypto, NativeCrypto | null>(
  'expo.crypto',
  () => expoModule('expo-crypto', () => require('expo-crypto') as NativeCrypto),
  (native) => {
    const requests = ownedRequests();
    const module = () => {
      if (!requests.active()) throw new Error('Crypto service has been disposed.');
      if (!native) throw new Error('Crypto needs expo-crypto: npx expo install expo-crypto');
      return native;
    };
    // Crypto has no meaningful empty success value. Cancelled answers reject explicitly.
    const perform = <T>(start: () => Promise<T>): Promise<T> =>
      requests.run<T | null>(null, start).then((value) => {
        if (value === null) throw new Error('Crypto request was cancelled.');
        return value;
      });
    return {
      randomUUID: () => module().randomUUID(),
      digestString: (...args) => perform(() => module().digestStringAsync(...args)),
      digest: (...args) => perform(() => module().digest(...args)),
      randomBytes: (count) => module().getRandomBytes(count),
      randomBytesAsync: (count) => perform(() => module().getRandomBytesAsync(count)),
      randomValues: (array) => module().getRandomValues(array),
    };
  },
);
