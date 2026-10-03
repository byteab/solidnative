import type { NativeRoute } from '@solidnative/router/solid';
/** Real original route subtree, for composition into the complete canary. */
export const browseRoutes: readonly NativeRoute[] = [
  { path: 'browse', lazy: () => import('./browse.solid.tsx').then((module) => module.Browse) },
];
