import type { NativeRoute } from '@solid-native/router/solid';

/** Every screen loads when it is first opened, which is what keeps start-up fast. */
export const routes: readonly NativeRoute[] = [
  {
    path: '',
    outlet: 'tabs',
    lazy: () => import('./tabs.solid.tsx').then((m) => m.Tabs),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      {
        // A tab with a stack of its own, for the native header and its large title.
        path: 'today',
        lazy: () => import('./today/today.solid.tsx').then((m) => m.TodayStack),
        children: [
          { path: '', lazy: () => import('./today/today.solid.tsx').then((m) => m.Today) },
        ],
      },
      {
        path: 'settings',
        lazy: () => import('./settings/settings.solid.tsx').then((m) => m.Settings),
      },
    ],
  },
  {
    // A new habit and editing one share a form; presented as a modal either way. Both are listed
    // before the plain `:id` route below, so `new` and `:id/edit` are never read as ids.
    path: 'habit/new',
    lazy: () => import('./habit-form/habit-form.solid.tsx').then((m) => m.HabitForm),
  },
  {
    path: 'habit/:id/edit',
    lazy: () => import('./habit-form/habit-form.solid.tsx').then((m) => m.HabitForm),
  },
  {
    // On the app's stack, over the tabs, so a habit opened from Today pushes a real screen with a
    // back button and its own header.
    path: 'habit/:id',
    lazy: () => import('./habit-detail/habit-detail.solid.tsx').then((m) => m.HabitDetail),
  },
];
