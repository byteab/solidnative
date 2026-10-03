import type { NativeRoute } from '@solidnative/router/solid';
export const calendarRoutes: readonly NativeRoute[] = [
  { path: 'calendar', lazy: () => import('./calendar-page.solid.tsx').then((m) => m.CalendarPage) },
];
