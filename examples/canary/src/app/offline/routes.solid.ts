import type { NativeRoute } from '@solid-native/router/solid';
export const offlineRoutes: readonly NativeRoute[] = [
  {
    path: 'field-notes',
    lazy: () => import('./offline-notes.solid.tsx').then((m) => m.OfflineNotes),
  },
];
