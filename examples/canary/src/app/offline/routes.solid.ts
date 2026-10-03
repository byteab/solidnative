import type { NativeRoute } from '@solidnative/router/solid';
export const offlineRoutes: readonly NativeRoute[] = [
  {
    path: 'field-notes',
    lazy: () => import('./offline-notes.solid.tsx').then((m) => m.OfflineNotes),
  },
];
