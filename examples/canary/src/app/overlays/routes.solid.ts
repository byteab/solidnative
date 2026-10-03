import type { NativeRoute } from '@solidnative/router/solid';
export const overlayRoutes: readonly NativeRoute[] = [
  { path: 'overlays', lazy: () => import('./overlays-page.solid.tsx').then((m) => m.OverlaysPage) },
  {
    path: 'overlays/sheet',
    data: { sheet: true },
    lazy: () => import('./overlays-page.solid.tsx').then((m) => m.OverlaysPage),
  },
];
