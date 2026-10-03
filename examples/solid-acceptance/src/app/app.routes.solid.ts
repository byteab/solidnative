import type { NativeRoute } from '@solid-native/router';

/** Every screen loads when it is first opened, which keeps start-up fast. */
export const routes: readonly NativeRoute[] = [
  {
    path: '',
    outlet: 'tabs',
    lazy: () => import('./tabs.solid.tsx').then((m) => m.Tabs),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', lazy: () => import('./home/home.solid.tsx').then((m) => m.Home) },
      { path: 'list', lazy: () => import('./list/list.solid.tsx').then((m) => m.List) },
      { path: 'motion', lazy: () => import('./motion/motion.solid.tsx').then((m) => m.Motion) },
    ],
  },
  // On the app's stack, over the tabs, so every tab pushes them the same way.
  { path: 'detail/:id', lazy: () => import('./detail/detail.solid.tsx').then((m) => m.Detail) },
  { path: 'form', lazy: () => import('./form/form.solid.tsx').then((m) => m.Form) },
];
