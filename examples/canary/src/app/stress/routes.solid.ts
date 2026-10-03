import type { NativeRoute } from '@solidnative/router/solid';
export const stressRoutes: readonly NativeRoute[] = [
  { path: 'stress', lazy: () => import('./stress-list.solid.tsx').then((m) => m.StressList) },
];
