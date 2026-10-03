import type { NativeRoute } from '@solidnative/router/solid';
export const photoRoutes: readonly NativeRoute[] = [
  { path: 'photos', lazy: () => import('./gallery.solid.tsx').then((m) => m.Gallery) },
  {
    path: 'photos/:index',
    lazy: () => import('./photo-viewer.solid.tsx').then((m) => m.PhotoViewer),
  },
];
