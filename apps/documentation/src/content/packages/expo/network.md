---
title: Network
summary: Connection type and a reachability estimate, as Solid accessors - not proof a request will land.
---

# Network

`Network` exposes the platform's connection and reachability estimates. `reachable` forwards the
platform's `isInternetReachable` - on iOS the same value as `connected`, never a probe of your
server. Use it for an offline banner; only a `try`/`catch` around the request knows whether it
succeeds.

## Install

```sh
npx expo install expo-network
```

```ts
import { Network } from '@solidnative/expo/solid/network';
```

## The smallest useful example

```tsx
import { createMemo } from 'solid-js';
import { useService } from '@solidnative/device/solid';
import { Text } from '@solidnative/components/solid';
import { Show } from '@solidnative/platform/solid';
import { Network } from '@solidnative/expo/solid/network';

export function Banner() {
  const network = useService(Network);
  const offline = createMemo(() => network.reachable() === false);
  return (
    <Show when={offline()}>
      <Text>You're offline</Text>
    </Show>
  );
}
```

## What it reports

- **`status`** - the full `{ connected, type, reachable }` object.
- **`connected`** - whether there is a connection of any kind; not reachability.
- **`type`** - `'wifi'`, `'cellular'`, `'ethernet'`, `'bluetooth'`, `'vpn'`, `'other'`, `'none'` or
  `'unknown'`, e.g. to wait for wifi before a large download.
- **`reachable`** - `boolean | null`. Null means not yet known, **not** offline: a banner treating
  null as false flashes on every cold start.

## Without the module

On iOS and Android, a missing or not-yet-rebuilt `expo-network` throws a `MissingModuleError` naming
the fix the first time `useService(Network)` uses it; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake `Network.SOURCE`, it reads the exported `OFFLINE` status:
`connected` is `false`, `type` is `'unknown'`, `reachable` is `null`.

## Working offline

For showing cached data, refreshing when `connected` goes true and queuing offline writes, see
[Working offline](/guide/offline).

## Reference

`Network` is exported from `@solidnative/expo/solid/network`, with the `NetworkStatus` and
`ConnectionType` types.

<!-- api: Network -->
