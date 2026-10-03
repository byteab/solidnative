---
title: Tabs
summary: NativeTabsOutlet renders a real tab bar, with each tab declared by the page that shows it.
---

# Tabs

`<NativeTabsOutlet>` renders a real `UITabBarController` on iOS and a bottom navigation bar on
Android. The page showing the bar declares the tabs, since badges change, titles get translated and
tabs may hang on feature flags:

<!-- api: NativeTabsOutlet -->

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { NativeHeader, NativeTabsOutlet } from '@solidnative/router/solid';

export function TabsPage() {
  const [unread] = createSignal(3);
  const tabs = [
    { path: 'library', title: 'Library', sfSymbol: 'books.vertical.fill' },
    {
      path: 'inbox',
      title: 'Inbox',
      sfSymbol: 'tray',
      get badge() {
        return unread() > 0 ? String(unread()) : undefined;
      },
    },
  ];
  return (
    <>
      <NativeHeader hidden />
      <NativeTabsOutlet tabs={tabs} />
    </>
  );
}
```

The rendering route has `outlet: 'tabs'` and one child route per tab, matched by `path`; a
`{ path: '', pathMatch: 'full', redirectTo: 'library' }` child picks the tab a bare `/tabs` opens.
The tab list is read once when the outlet is created, but each tab's fields are reactive, so a
getter like `badge` above follows its signal. `sfSymbol` (iOS) and `drawable` (Android) are
shorthand for `icon`/`selectedIcon`, a `TabIcon` that also takes an `xcasset` name or a
`require()`d image drawn as authored (`image`) or as a tinted mask (`template`). `icon` and
`selectedIcon` must be the same kind, since native carries one icon type for both states.

```ts
import type { NativeRoute } from '@solidnative/router/solid';

export const routes: readonly NativeRoute[] = [
  {
    path: 'tabs',
    outlet: 'tabs',
    lazy: () => import('./tabs.solid.tsx').then((m) => m.TabsPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'library' },
      { path: 'library', lazy: () => import('./library.solid.tsx').then((m) => m.Library) },
      { path: 'inbox', lazy: () => import('./inbox.solid.tsx').then((m) => m.Inbox) },
    ],
  },
];
```

A bar item is not a view: `UITabBarItem` and Android's bottom-navigation item are model objects
(title, image, badge string). So a tab is a plain object, unlike `<NativeHeaderItem>`, and
customization goes in the `standardAppearance`/`scrollEdgeAppearance` fields, not markup.

## Defaults for every tab bar

`<NativeBarDefaults>` also takes a `tabs` default: the outlet's `tintColor`, `backgroundColor` and
`colorScheme`, and each tab's `standardAppearance` and `scrollEdgeAppearance`. As with headers it
takes an object or a function of the color scheme, and anything an outlet or tab sets wins.

<!-- api: NativeBarDefaults -->

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { NativeBarDefaults } from '@solidnative/router/solid';
import { Shell } from './shell.solid.tsx'; // calls createNativeNavigation(routes)

export function App() {
  return (
    <NativeBarDefaults
      tabs={(scheme) => ({
        tintColor: '#3b6ef5',
        backgroundColor: scheme === 'dark' ? '#101014' : '#f4f4f7',
      })}
    >
      <Shell />
    </NativeBarDefaults>
  );
}
```

Call `createNativeNavigation` inside `<NativeBarDefaults>`, as above: the root navigation creates
screens under its own Solid owner, which is where they look up defaults. A tab's own
`standardAppearance` replaces the default whole rather than merging.

Native holds the selection; taps go through `selectTab()`, so URL and bar agree. Visited tabs stay
mounted with their stacks, so returning resumes where you left.

## Content above the tab bar

The bar is drawn over the tab's screen (floating on iOS 26, translucent before, on top on Android),
so anything pinned to the bottom must be lifted clear by a device-specific amount.
`<SafeAreaView>` cannot: its root provider sits above the bar, so its bottom inset is only the home
indicator. `<TabSafeAreaView>` asks the tab screen (on iOS its safe area, extended by the bar; on
Android the larger of the bar and system bars) and follows the bar as it resizes or hides.

<!-- api: TabSafeAreaView -->

The inset is applied as **margin**, so what is behind shows through. For a panel whose background
must reach the screen bottom (so the bar floats over the panel), give the background to a parent
and put `<TabSafeAreaView>` inside; the parent grows by the margin:

```tsx
<View class="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white px-5 pt-4">
  <TabSafeAreaView edges={['bottom']} class="pb-4">
    {/* controls, which now end 16 points above the bar */}
  </TabSafeAreaView>
</View>
```

Content floating with nothing behind it, such as a mini player, needs no parent:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { NativeStackOutlet } from '@solidnative/router/solid';
import { MiniPlayer } from './mini-player.solid.tsx';

export function LibraryStack() {
  return (
    <>
      <NativeStackOutlet />
      <MiniPlayer class="absolute bottom-0 left-0 right-0" />
    </>
  );
}
```

with a `<TabSafeAreaView edges={['bottom']}>` inside the mini player. It must be inside a tab to
know about the bar, so put shared content in each tab; in a tab's stack component, beside its
`<NativeStackOutlet>`, it stays put as pages are pushed. Beside `<NativeTabsOutlet>` it is outside
every tab screen, and on iOS insets by nothing.

A scroll view filling the tab usually needs none: on iOS,
`contentInsetAdjustmentBehavior="automatic"` insets its content by the safe area, bar included.
Android has no equivalent, so pad the content or the last rows scroll under the bar.

## Going back

Android's back button (`bindNativeNavigation`'s `back` option) pops the stack in the front tab,
never a tab behind it; it is a pop, not a step back through history. A screen pushed over the whole
bar, on the app's own stack, is popped first.

At the front stack's root, or in a tab with no stack, back goes to the first tab as it was left; on
the first tab the system backgrounds the app. Visit order is not retraced, matching standard bottom
navigation. `back()` does the same but never leaves the app: on the first tab's root it resolves
`false`; `canGoBack()` tells you in advance.

A tab screen with no stack has no header to clear the status bar. iOS scroll views inset by the
safe area, but Android draws edge to edge, so the first line lands under the clock. Wrap such a page
in `<SafeAreaView edges={['top']}>`; on iOS the inset is then not doubled.
