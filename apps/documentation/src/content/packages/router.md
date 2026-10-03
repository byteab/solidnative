---
title: Router
summary: A Solid route table driving a real native stack, native tabs and a native header.
---

# Router

`@solidnative/router/solid` routes native screens, not URLs. Routes are a plain array that the
outlets render into `react-native-screens`, so a push is a real native transition with the
platform's animation and swipe-back over a real `UINavigationController`/`Fragment`.

## Setting it up

```sh
npm install @solidnative/router
npx expo install react-native-screens
```

`react-native-screens` provides every stack, screen, header and tab bar. Expo Go bundles it, but
other builds only link native modules in the app's `package.json`; without it they render
`Unimplemented component`. The router registers the view names on first navigation.

Routes are `NativeRoute` objects. A route names a `component` or a `lazy` loader (one chunk per
screen), and may add `guard`, `resolve`, `data`, `presentation`, `redirectTo` and `children`:

```ts
// src/app/app.routes.ts
import type { NativeRoute } from '@solidnative/router/solid';

export const routes: readonly NativeRoute[] = [
  { path: '', lazy: () => import('./home/home.solid.tsx').then((m) => m.Home) },
  { path: 'notes/:id', lazy: () => import('./notes/note.solid.tsx').then((m) => m.Note) },
];
```

A route component receives `{ route, navigation }`: `route.params` holds the `:id` segment, and
`route.inputs` merges query params, path params, static `data` and resolved data. `useRoute()` and
`useNavigation()` return the same values anywhere inside the screen.

## The shell

`createNativeNavigation(routes)` creates the navigation state and must run inside a Solid owner
(a component). `NativeStackOutlet` renders it as a native stack, and `bindNativeNavigation`
connects it to `@solidnative/device`'s `DeepLinks` and `HardwareBack` so Android's back button
and incoming links drive the stack:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { SafeAreaProvider } from '@solidnative/components/solid';
import { DeepLinks, HardwareBack, useService } from '@solidnative/device/solid';
import {
  bindNativeNavigation,
  createNativeNavigation,
  NativeStackOutlet,
} from '@solidnative/router/solid';
import { routes } from './app.routes.ts';

export function App() {
  const navigation = createNativeNavigation(routes);
  bindNativeNavigation(navigation, {
    links: useService(DeepLinks),
    back: useService(HardwareBack),
  });
  return (
    <SafeAreaProvider class="screen">
      <NativeStackOutlet navigation={navigation} />
    </SafeAreaProvider>
  );
}
```

`App` must render inside a [`ServiceScope`](/packages/device) for `useService` to resolve.
`bindNativeNavigation` also takes `initialPath` and `parentOf`, which decides what a deep link
lands on top of. `NativeBarDefaults` wraps the tree to set the default look of every
[header](/packages/router/header) and [tab bar](/packages/router/tabs).

Each screen has its own owner, and screens below the top stay mounted with their scroll offset,
cursor and focus. Swipe-back and Android back pops are reported, so `navigation.url()` always
matches the stack.

Navigation is imperative and returns a promise that resolves once the transition is staged:

```tsx
const navigation = useNavigation();

<Pressable onPress={() => navigation.push(`/notes/${note.id}`)}>
  <Text>Open</Text>
</Pressable>;
```

**Screens and navigation** covers `NativeNavigation`'s `replace`, `present`, `reset` and `pop`
(modals, sheets, stack resets). **The native header** covers `NativeHeader` and
`NativeHeaderItem`. **Tabs** covers `NativeTabsOutlet` and declaring a bar as content rather than
config.
