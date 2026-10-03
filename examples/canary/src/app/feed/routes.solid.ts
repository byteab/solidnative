import type { NativeRoute } from '@solid-native/router/solid';
/** Real original route subtree, for composition into the complete canary. */
export const feedRoutes: readonly NativeRoute[] = [
  { path: 'feed', lazy: () => import('./feed.solid.tsx').then((module) => module.FeedPage) },
];
