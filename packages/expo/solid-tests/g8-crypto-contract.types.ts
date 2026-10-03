import type * as InstalledCrypto from 'expo-crypto';
import type { NativeCrypto } from '../src/solid/crypto.ts';

// Compile against the pinned native package without exposing its declarations publicly.
export function acceptInstalledCrypto(module: typeof InstalledCrypto): NativeCrypto {
  return module;
}
