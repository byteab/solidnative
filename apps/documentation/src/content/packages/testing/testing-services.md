---
title: Testing with services
summary: Replacing a service a component reads with useService by a stand-in, inside render().
---

# Testing with services

Continues from [Writing a test](/packages/testing/writing-a-test). `useService` reads from the
nearest `ServiceScope`, and `provideService` replaces a token's factory in a scope, so a test wraps
the component with `withServiceScope`. An app service declared with `createServiceToken`:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { createResource } from 'solid-js';
import { createServiceToken, useService } from '@solid-native/device/solid';
import { Text } from '@solid-native/components/solid';

export const Weather = createServiceToken('weather', () => ({
  today: (): Promise<string> =>
    fetch('https://example.com/weather').then((response) => response.text()),
}));

export function Forecast() {
  const weather = useService(Weather);
  const [forecast] = createResource(() => weather.today());
  return <Text>{forecast() ?? '...'}</Text>;
}
```

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { provideService, withServiceScope } from '@solid-native/device/solid';
import { createComponent } from '@solid-native/platform/solid';
import { cleanup, render, screen } from '@solid-native/testing';
import { Forecast, Weather } from './forecast.solid.tsx';

afterEach(cleanup);

test('replaces a service with a stand-in', async () => {
  render(() =>
    withServiceScope([provideService(Weather, () => ({ today: async () => 'Sunny' }))], () =>
      createComponent(Forecast, {}),
    ),
  );

  assert.ok(await screen.findByText('Sunny'));
});
```

`render()` takes any function returning native children, so the scope wraps the component inline.
To boot a whole app with all its services and providers, use
`renderWith(({ fabric, rootTag, clock }) => mountApp({ fabric, rootTag, clock }))`, where `mountApp`
is the app's function that calls `createNativeRoot` and returns something with `dispose()`.

Device services such as `Dialogs`, `Keyboard` or `ColorScheme` read their native module through a
`SOURCE` token, so a test replaces only the native side and keeps the real service:
`provideService(Dialogs.SOURCE, () => ({ platform: 'ios', alert: (title) => alerts.push(title) }))`.
The example apps' tests provide haptics, dialogs, colour scheme and database this way.
