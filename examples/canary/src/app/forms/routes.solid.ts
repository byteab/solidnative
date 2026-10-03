import type { NativeRoute } from '@solid-native/router/solid';

/** Real original forms paths; the complete app is composed only after all subtrees migrate. */
export const formRoutes: readonly NativeRoute[] = [
  { path: 'forms', lazy: () => import('./forms.solid.tsx').then((module) => module.FormsPage) },
  {
    path: 'application',
    lazy: () => import('./application.solid.tsx').then((module) => module.ApplicationPage),
  },
];
