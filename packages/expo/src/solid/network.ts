import { createMemo, type Accessor } from 'solid-js';
import { createObserved, type ObservedSource } from '@solid-native/device/solid';
import { expoModule } from '../native.ts';
import { observedFrom } from './observed.ts';
import { sourcedService } from './owned.ts';
export type ConnectionType =
  'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'vpn' | 'other' | 'none' | 'unknown';

export interface NetworkStatus {
  readonly connected: boolean;
  readonly type: ConnectionType;
  /** Null while the platform has not established it, which is not the same as false. */
  readonly reachable: boolean | null;
}

export const OFFLINE: NetworkStatus = { connected: false, type: 'unknown', reachable: null };

const TYPES: Record<string, ConnectionType> = {
  NONE: 'none',
  UNKNOWN: 'unknown',
  WIFI: 'wifi',
  CELLULAR: 'cellular',
  BLUETOOTH: 'bluetooth',
  ETHERNET: 'ethernet',
  VPN: 'vpn',
  OTHER: 'other',
};

export interface Network {
  readonly status: Accessor<NetworkStatus>;
  readonly connected: Accessor<boolean>;
  readonly type: Accessor<ConnectionType>;
  readonly reachable: Accessor<boolean | null>;
}
export const Network = sourcedService<Network, ObservedSource<NetworkStatus> | null>(
  'expo.network',
  () => {
    const expo = expoModule(
      'expo-network',
      () => require('expo-network') as typeof import('expo-network'),
    );
    if (!expo) return null;

    const read = (
      state: import('expo-network').NetworkState | import('expo-network').NetworkStateEvent,
    ): NetworkStatus => ({
      connected: state.isConnected ?? false,
      type: TYPES[state.type ?? 'UNKNOWN'] ?? 'unknown',
      // `undefined` means the platform has not established it; `null` is how that is said here,
      // so a consumer cannot confuse "not yet" with "no".
      reachable: state.isInternetReachable ?? null,
    });

    return observedFrom(
      async () => read(await expo.getNetworkStateAsync()),
      (listener) => expo.addNetworkStateListener((event) => listener(read(event))),
    );
  },
  (sources) => {
    const status = createObserved(sources, OFFLINE);
    return {
      status,
      connected: createMemo(() => status().connected),
      type: createMemo(() => status().type),
      reachable: createMemo(() => status().reachable),
    };
  },
);
