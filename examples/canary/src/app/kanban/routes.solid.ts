import type { NativeRoute } from '@solid-native/router/solid';
export const kanbanRoutes: readonly NativeRoute[] = [
  { path: 'kanban', lazy: () => import('./kanban-page.solid.tsx').then((m) => m.KanbanPage) },
];
