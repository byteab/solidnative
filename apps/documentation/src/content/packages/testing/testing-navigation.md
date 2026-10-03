---
title: Testing navigation
summary: Pushing a screen on the native stack, route parameters, and the transition events a test sends.
---

# Testing navigation

Continues from [Writing a test](/packages/testing/writing-a-test). Tests route with the app's own
`createNativeNavigation` and `NativeStackOutlet` from `@solidnative/router/solid`. Routes, and a
root that hands its navigation to the test:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, Text } from '@solidnative/components/solid';
import { ServiceScope } from '@solidnative/device/solid';
import {
  createNativeNavigation,
  NativeStackOutlet,
  type NativeNavigation,
  type NativeRoute,
  type NativeRouteProps,
} from '@solidnative/router/solid';

function Home(props: NativeRouteProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void props.navigation.push('/trip/lisbon')}
    >
      <Text>Lisbon</Text>
    </Pressable>
  );
}

function Trip(props: NativeRouteProps) {
  return <Text>Trip {props.route.params['id']}</Text>;
}

export const routes: NativeRoute[] = [
  { path: '/', component: Home },
  { path: '/trip/:id', component: Trip },
];

export function App(props: { onNavigation: (navigation: NativeNavigation) => void }) {
  return (
    <ServiceScope>
      {(() => {
        const navigation = createNativeNavigation(routes);
        props.onNavigation(navigation);
        return <NativeStackOutlet navigation={navigation} />;
      })()}
    </ServiceScope>
  );
}
```

The app starts with `bindNativeNavigation` and its `initialPath`; a test starts anywhere with
`reset()`. A navigation resolves once the screen is staged, but the outgoing screen is released only
when native sends `topFinishTransitioning` on the `RNSScreenStack` node, so the test sends it with
`fireEvent`. `fabric.find(viewName)` on the render result's fake finds nodes no role or text query
reaches:

```ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { NativeNavigation } from '@solidnative/router/solid';
import { cleanup, fireEvent, render, screen, userEvent } from '@solidnative/testing';
import { App } from './app.solid.tsx';

afterEach(cleanup);

test('pushes a screen when a button is pressed', async () => {
  let navigation!: NativeNavigation;
  const { fabric } = render(App, { props: { onNavigation: (value) => (navigation = value) } });
  const finish = () => fireEvent(fabric.find('RNSScreenStack')!, 'finishTransitioning');

  assert.equal(await navigation.reset('/'), true);
  await finish();

  await userEvent.press(screen.getByRole('button', { name: 'Lisbon' }));
  await finish();

  assert.equal(navigation.url(), '/trip/lisbon');
  assert.ok(screen.getByText('Trip lisbon'));
});
```

A pushed screen stacks on the previous one, so home stays in the tree: assert on what arrived or on
`navigation.url()`, not on what left. A `lazy` import, `guard` or `resolve` delays the screen a few
tasks; `navigation.pending()` is true meanwhile, and a
[`waitFor` or a `findBy*` query](/packages/testing/testing-async) covers it. The platform draws the
stack's animation and navigation bar, which a test cannot see; it sees the
`RNSScreenStackHeaderConfig` node a `NativeHeader` commits, with `title` in its props.

Route parameters arrive on `props.route.params`, the query on `props.route.query`, and `resolve`'s
data on `props.route.inputs`. Import the app's own routes file so guards and redirects are real.
