import type { NativeRoute } from '@solidnative/router/solid';
/** Real original route subtree, for composition into the complete canary. */
export const inboxRoutes: readonly NativeRoute[] = [
  { path: 'inbox', lazy: () => import('./inbox.solid.tsx').then((module) => module.InboxPage) },
];
