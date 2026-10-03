---
title: Testing network requests
summary: Answering a fetch from the test instead of the network, with node:test's mocks or a service stand-in.
---

# Testing network requests

Continues from [Writing a test](/packages/testing/writing-a-test). `@solid-native/testing` has no
request mocking; Node does. Replace `fetch` for the test's duration with `t.mock.method`:

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { createResource } from 'solid-js';
import { Text } from '@solid-native/components/solid';

export function Profile() {
  const [me] = createResource(() =>
    fetch('/api/me').then((response) => response.json() as Promise<{ name: string }>),
  );
  return <Text>{me()?.name ?? '...'}</Text>;
}
```

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen } from '@solid-native/testing';
import { Profile } from './profile.solid.tsx';

afterEach(cleanup);

test('answers a request from the test', async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    requests.push(url);
    return Response.json({ name: 'Ada' });
  });

  render(Profile);

  assert.ok(await screen.findByText('Ada'));
  assert.deepEqual(requests, ['/api/me']);
});
```

`t.mock` restores `fetch` when the test ends. With several requests, put them behind a service and
replace it with `provideService`, as [Testing with services](/packages/testing/testing-services)
shows.
