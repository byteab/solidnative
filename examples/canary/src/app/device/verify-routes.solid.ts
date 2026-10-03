import type { NativeRoute } from '@solidnative/router/solid';
export const verifyRoutes: readonly NativeRoute[] = [
  { path: 'verify', lazy: () => import('./verify.solid.tsx').then((m) => m.VerifyPage) },
];
