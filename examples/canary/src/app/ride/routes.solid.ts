import type { NativeRoute } from '@solid-native/router/solid';
export const rideRoutes: readonly NativeRoute[] = [
  { path: 'ride', lazy: () => import('./ride-page.solid.tsx').then((m) => m.RidePage) },
  { path: 'ride/where', lazy: () => import('./ride-sheet.solid.tsx').then((m) => m.RideSheet) },
];
