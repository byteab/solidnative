import type { NativeRoute } from '@solid-native/router/solid';
export const stressRoutes: readonly NativeRoute[] = [
  { path: 'stress', lazy: () => import('./stress-list.solid.tsx').then((m) => m.StressList) },
];
