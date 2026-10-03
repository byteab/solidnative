import type { NativeRoute } from '@solid-native/router/solid';
export const listRoutes: readonly NativeRoute[] = [
  { path: 'list', lazy: () => import('./list.solid.tsx').then((m) => m.ListPage) },
  { path: 'scrolling', lazy: () => import('./scrolling.solid.tsx').then((m) => m.ScrollingPage) },
];
