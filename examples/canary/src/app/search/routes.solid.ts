import type { NativeRoute } from '@solidnative/router/solid';
export const searchRoutes: readonly NativeRoute[] = [
  {
    path: 'search-demo',
    lazy: () => import('./music-search.solid.tsx').then((m) => m.MusicSearch),
  },
  {
    path: 'search-demo/:id',
    lazy: () => import('./search-result.solid.tsx').then((m) => m.SearchResult),
  },
];
