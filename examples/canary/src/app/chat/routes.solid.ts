import type { NativeRoute } from '@solid-native/router/solid';
/** Real original route subtree, for composition into the complete canary. */
export const chatRoutes: readonly NativeRoute[] = [
  { path: 'chat', lazy: () => import('./chat.solid.tsx').then((module) => module.ChatPage) },
];
