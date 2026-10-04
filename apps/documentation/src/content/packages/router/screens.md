---
title: Screens and navigation
summary: Declaring native routes, then pushing, replacing, presenting and resetting a native stack.
---

# Screens and navigation

<!-- api: NativeStackOutlet -->

`createNativeNavigation(routes)` turns a route table into a navigation that owns a real native
stack; `<NativeStackOutlet>` renders it. Screens below the top stay mounted, keeping native state.

<!-- api: createNativeNavigation -->

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { SafeAreaProvider } from '@solidnative/components/solid';
import { DeepLinks, HardwareBack, useService } from '@solidnative/device/solid';
import {
  NativeStackOutlet,
  bindNativeNavigation,
  createNativeNavigation,
  type NativeRoute,
} from '@solidnative/router/solid';

const routes: readonly NativeRoute[] = [
  { path: '', lazy: () => import('./home.solid.tsx').then((m) => m.Home) },
  { path: 'notes/:id', lazy: () => import('./note.solid.tsx').then((m) => m.Note) },
  { path: 'filters', lazy: () => import('./filters.solid.tsx').then((m) => m.Filters) },
];

export function App() {
  const navigation = createNativeNavigation(routes, { onError: console.error });
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

A route has a `path` (`:name` segments become `params`), a `component` or `lazy` loader, and
optionally static `data`, a `guard` (returns `true`, `false` or a redirect path), a `resolve` merged
in before the screen is created, a default `presentation`, `redirectTo`/`pathMatch: 'full'`, and
`children` with an `outlet` of `'stack'` (default) or `'tabs'`. Guards, resolvers and loaders get a
`NavigationContext` whose `AbortSignal` fires when a newer navigation supersedes them.
`useNavigation()` returns the root navigation; `useRoute()` the screen's `RouteMatch`, whose
`inputs` merge query, path params, static data and resolved data.

<!-- api: useNavigation -->

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, Text } from '@solidnative/components/solid';
import { useNavigation } from '@solidnative/router/solid';

export function Editor() {
  const nav = useNavigation();
  const presentSheet = () =>
    void nav.present('/filters', {
      as: 'formSheet',
      presentation: { sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true },
    });
  // reset() destroys every screen below - there is nothing left to go back to.
  const finishOnboarding = () => void nav.reset('/');
  return (
    <>
      <Pressable onPress={() => void nav.push('/notes/42')}>
        <Text>Open note</Text>
      </Pressable>
      <Pressable onPress={presentSheet}>
        <Text>Filters</Text>
      </Pressable>
      <Pressable onPress={finishOnboarding}>
        <Text>Done</Text>
      </Pressable>
      <Pressable onPress={() => void nav.back()}>
        <Text>Back</Text>
      </Pressable>
    </>
  );
}
```

`push()`, `present()`, `replace()` and `reset()` run guards, resolvers and lazy imports first, then
resolve `true` once staged or `false` if refused or overtaken; `pending()` is true meanwhile. An
optional `state`, separate from the URL, is read from `useRoute().state`.

`bindNativeNavigation` opens the launch URL from `DeepLinks`, else `initialPath`, else `/`; `ready`
resolves once it is staged. Links arriving mid-transition are followed when the stack settles.

## Every url is its own screen

A push always creates a new screen, whether from `push()`, a deep link or a tab: `/notes/1` then
`/notes/2` stacks two `Note` screens and back returns to `/notes/1`. A `push()` or `replace()` that changes only the top
screen's query or fragment (`/user/1` to `/user/1?tab=posts`) updates it in place, and its
`route.query`, `route.fragment` and `route.inputs` update.

A route whose parameter selects what one screen shows (a pager, a list step) sets
`reuseScreen: true`: a `push()` or `replace()` to it while its screen is on top updates that screen
in place, with no transition, and back leaves in one step. `useRoute()` (and `props.route`) fields
are reactive, so `params`, `inputs`, `query` and `state` update. In both cases `present()`,
`reset()` and (for `reuseScreen`) a push from another screen still create a fresh screen.
`reuseScreen` applies to leaf routes.

```ts
import type { NativeRoute } from '@solidnative/router/solid';
import { Photo } from './photo.solid.tsx';
import { User } from './user.solid.tsx';

export const routes: readonly NativeRoute[] = [
  { path: 'user/:id', component: User }, // /user/1 then /user/2: two screens
  { path: 'photo/:index', component: Photo, reuseScreen: true }, // one screen, its route updated
];
```

## Popping several screens

`popTo(path)` pops back to the existing screen at that url, like `popToViewController`.
`popToRoot()` pops the front stack to its first screen (a tab's first screen inside a tab), and
`pop(count)` removes that many. The innermost front stack answers; each resolves false and does
nothing when there is nothing to pop to.

A popped screen's page is torn down once the native transition has finished and the commit that
removes its screen has gone out, so that commit is not held up by the teardown; its `onCleanup`s
run then, or before any new screen or list row is set up, whichever comes first. Its effects no
longer run from the moment it is removed.

## Deep links into nested screens

`bindNativeNavigation`'s `parentOf` names the page a deep link belongs under, recursively, so a
link five levels deep opens all five and Back retraces them, staged in one `pushStack()`
transition. A launch link waits for the first navigation, so the root screen is beneath it.

## A page that fails to render

A page that throws on first render, or whose `lazy` import or `resolve` fails, fails the
navigation: `push()` resolves `false`, `error()` holds the cause, `createNativeNavigation`'s
`onError` is called, and the url is unchanged. The page's owner is disposed and its screen never
reaches the stack; a failed replace or reset keeps the screens it would have removed, and a page
that was the first screen of its own stack takes that stack with it.

## Refusing a dismissal

`useNativeDismissGuard` lets a presented page refuse a swipe-away while it has unsaved changes,
and hear the attempt so it can ask. It binds to the page's own screen, so call it once from the page
component:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { useNativeDismissGuard } from '@solidnative/router/solid';

export function Editor() {
  const [dirty, setDirty] = createSignal(false);
  useNativeDismissGuard(dirty, () => {
    // Ask, then useNavigation().back() to leave.
  });
  // ...
}
```

## Presented screens have no header

A presented screen is shown outside the stack's navigation controller, like `expo-router`'s and
`react-navigation`'s modals, so it has no native header and no automatic safe-area insets. It
provides its own way out and its own `<SafeAreaView>`:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, SafeAreaProvider, SafeAreaView, Text } from '@solidnative/components/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import { useNavigation } from '@solidnative/router/solid';
import sheet from './sheet.native.css'; // .fill { flex: 1; }

export function Sheet() {
  const nav = useNavigation();
  return withNativeStyles(sheet, () => (
    <SafeAreaProvider reportInsets={false} class="fill">
      <SafeAreaView class="fill" edges={['top', 'bottom']}>
        <Pressable onPress={() => void nav.back()}>
          <Text>Close</Text>
        </Pressable>
        {/* ... */}
      </SafeAreaView>
    </SafeAreaProvider>
  ));
}
```

## Pushing from a presented screen

A push from a presented screen is presented over it, and one back closes it: on iOS a push can only
slide in on a navigation controller, which a presented screen is outside of. A presentation named in
the push wins: `stackPresentation: 'fullScreenModal'` covers everything, and
`stackPresentation: 'push'` pushes onto the stack under the modal, hidden until it closes.

To push inside a presented screen with a header and back button, make it a stack: its component
renders `<NativeStackOutlet />` (without `navigation` it takes the route's child navigation), with
the pushed screens as `children`.

```ts
import type { NativeRoute } from '@solidnative/router/solid';
import { Compose, ComposeRecipients, ComposeStart } from './compose.solid.tsx';

export const routes: readonly NativeRoute[] = [
  {
    path: 'compose', // nav.present('/compose')
    component: Compose, // () => <NativeStackOutlet />
    children: [
      { path: '', component: ComposeStart },
      { path: 'recipients', component: ComposeRecipients }, // nav.push('/compose/recipients')
    ],
  },
];
```

A push to one of those children stays in the modal; any other route is presented over it.

## Presentation options

`ScreenPresentation` holds every screen option (stack animation, dismiss gesture, sheet detents,
status and navigation bars), named as `react-native-screens` names its props. A route's
`presentation` is the default, overridden per screen by `push()`'s or `present()`'s `presentation`
option; pushes from a screen inherit the presentation it was opened with.

## Whether a screen is in front

`SCREEN_IN_FRONT` from `@solidnative/device/solid` is a service whose accessor is true while the
screen is showing, false while it is covered, presenting, or in an unselected tab; outside a route
it is always true. Track `useService(SCREEN_IN_FRONT)` in an effect to act while covered.
`<KeyboardDock>` uses it to release the keyboard, and `<NativeHeader>` to freeze a covered bar.

## Above every screen

Sheets and modals cover a toast positioned at the root. `<FullWindowOverlay>` draws above every
screen: on iOS a separate window that passes touches through where empty, so it can stay mounted; on
Android a view filling the window, so put it last in the root component.

```tsx
<SafeAreaProvider>
  <NativeStackOutlet navigation={navigation} />
  <FullWindowOverlay>
    <Show when={toast()}>
      {(message) => (
        <View class="toast">
          <Text>{message()}</Text>
        </View>
      )}
    </Show>
  </FullWindowOverlay>
</SafeAreaProvider>
```

It fills the window and follows rotation. `modal` keeps VoiceOver inside it while it shows, for a
cover that blocks the app.

<!-- api: FullWindowOverlay -->
