import type { NativeRoute } from '@solid-native/router/solid';
/** Actual original route companions, composed into the full app after all routes migrate. */
export const navigationRoutes: readonly NativeRoute[] = [
  {
    path: 'navigation',
    lazy: () => import('./navigation.solid.tsx').then((m) => m.NavigationPage),
  },
  { path: 'detail', lazy: () => import('./detail.solid.tsx').then((m) => m.Detail) },
  { path: 'sheet', lazy: () => import('./sheet.solid.tsx').then((m) => m.Sheet) },
  { path: 'header', lazy: () => import('./header.solid.tsx').then((m) => m.Header) },
  { path: 'modal', lazy: () => import('./modal.solid.tsx').then((m) => m.ModalPage) },
];
