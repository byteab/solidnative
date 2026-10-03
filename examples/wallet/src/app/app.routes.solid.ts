import type { NativeRoute } from '@solid-native/router/solid';

/** Every screen loads when it is first opened, which is what keeps start-up fast. */
export const routes: readonly NativeRoute[] = [
  {
    path: '',
    outlet: 'tabs',
    lazy: () => import('./tabs.solid.tsx').then((m) => m.Tabs),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', lazy: () => import('./home/home.solid.tsx').then((m) => m.Home) },
      {
        // A tab with a stack of its own, which is what gives it a native header to put the
        // large title and the search bar in.
        path: 'activity',
        lazy: () => import('./activity/activity.solid.tsx').then((m) => m.ActivityStack),
        children: [
          {
            path: '',
            lazy: () => import('./activity/activity.solid.tsx').then((m) => m.Activity),
          },
        ],
      },
      {
        path: 'settings',
        lazy: () => import('./settings/settings.solid.tsx').then((m) => m.Settings),
      },
    ],
  },
  {
    // On the app's stack, over the tabs, so home and activity both open it the same way. Inside
    // the activity tab's stack, opening one from home would land in that stack with nothing under
    // it to go back to.
    path: 'payment/:id',
    lazy: () => import('./payments/payment-detail.solid.tsx').then((m) => m.PaymentDetail),
  },
  { path: 'send', lazy: () => import('./send/send.solid.tsx').then((m) => m.Send) },
];
