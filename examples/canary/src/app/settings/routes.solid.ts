import type { NativeRoute } from '@solidnative/router/solid';
export const settingsRoutes: readonly NativeRoute[] = [
  { path: 'settings', lazy: () => import('./settings-page.solid.tsx').then((m) => m.SettingsPage) },
  {
    path: 'settings/:section',
    lazy: () => import('./settings-detail.solid.tsx').then((m) => m.SettingsDetail),
  },
];
