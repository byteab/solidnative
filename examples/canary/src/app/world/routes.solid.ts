import type { NativeRoute } from '@solid-native/router/solid';
export const worldRoutes: readonly NativeRoute[] = [
  { path: 'world', lazy: () => import('./world-page.solid.tsx').then((m) => m.WorldPage) },
];
