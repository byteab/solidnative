import type { NativeRoute } from '@solidnative/router/solid';

/** Every screen loads when it is first opened, which is what keeps start-up fast. */
export const routes: readonly NativeRoute[] = [
  {
    path: '',
    outlet: 'tabs',
    lazy: () => import('./tabs.solid.tsx').then((m) => m.Tabs),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'run' },
      { path: 'run', lazy: () => import('./run/run.solid.tsx').then((m) => m.Run) },
      {
        // A tab with a stack of its own, for the native header and its large title.
        path: 'history',
        lazy: () => import('./history/history.solid.tsx').then((m) => m.HistoryStack),
        children: [
          { path: '', lazy: () => import('./history/history.solid.tsx').then((m) => m.History) },
        ],
      },
      {
        path: 'settings',
        lazy: () => import('./settings/settings.solid.tsx').then((m) => m.Settings),
      },
    ],
  },
  {
    // On the app's own stack, over the tabs, so a run opened from History pushes a real screen
    // with a back button and its own header.
    path: 'runs/:id',
    lazy: () => import('./run-detail/run-detail.solid.tsx').then((m) => m.RunDetail),
  },
];
