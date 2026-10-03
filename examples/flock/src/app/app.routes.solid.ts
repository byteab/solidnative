import type { NativeRoute } from '@solid-native/router/solid';

/** Every tab is a stack of its own, so a post or a profile pushes inside the tab it came from. */
const detail: NativeRoute[] = [
  { path: 'post/:id', lazy: () => import('./post/post.solid.tsx').then((m) => m.PostDetail) },
  {
    path: 'user/:handle',
    lazy: () => import('./profile/profile.solid.tsx').then((m) => m.Profile),
  },
];
const stack = () => import('./tabs.solid.tsx').then((m) => m.TabStack);

export const routes: readonly NativeRoute[] = [
  {
    path: '',
    outlet: 'tabs',
    lazy: () => import('./tabs.solid.tsx').then((m) => m.Tabs),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        lazy: () => import('./home/home.solid.tsx').then((m) => m.HomeStack),
        children: [
          { path: '', lazy: () => import('./home/home.solid.tsx').then((m) => m.Home) },
          ...detail,
        ],
      },
      {
        path: 'explore',
        lazy: stack,
        children: [
          { path: '', lazy: () => import('./explore/explore.solid.tsx').then((m) => m.Explore) },
          ...detail,
        ],
      },
      {
        path: 'notifications',
        lazy: stack,
        children: [
          {
            path: '',
            lazy: () =>
              import('./notifications/notifications.solid.tsx').then((m) => m.Notifications),
          },
          ...detail,
        ],
      },
      {
        path: 'profile',
        lazy: stack,
        children: [
          { path: '', lazy: () => import('./profile/profile.solid.tsx').then((m) => m.Profile) },
          ...detail,
        ],
      },
    ],
  },
  // Presented over the tabs as sheets, from anywhere.
  { path: 'compose', lazy: () => import('./compose/compose.solid.tsx').then((m) => m.Compose) },
  { path: 'settings', lazy: () => import('./settings/settings.solid.tsx').then((m) => m.Settings) },
];
