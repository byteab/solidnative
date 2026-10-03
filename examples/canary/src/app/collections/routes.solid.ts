import type { NativeRoute } from '@solidnative/router/solid';
export const collectionRoutes: readonly NativeRoute[] = [
  { path: 'queue', lazy: () => import('./playlist.solid.tsx').then((m) => m.Playlist) },
];
