import type { NativeRoute } from '@solidnative/router/solid';
export const regressionRoutes: readonly NativeRoute[] = [
  { path: 'regressions', lazy: () => import('./regressions.solid.tsx').then((m) => m.Regressions) },
  {
    path: 'regressions/header',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionHeader),
  },
  {
    path: 'regressions/item/:id',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionItem),
  },
  {
    path: 'regressions/modal',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionModal),
  },
  {
    path: 'regressions/broken',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionBroken),
  },
  {
    path: 'regressions/text',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionText),
  },
  {
    path: 'regressions/rtl',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionRtl),
  },
  {
    path: 'regressions/dates',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionDates),
  },
  {
    path: 'regressions/defer',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionDefer),
  },
  {
    path: 'regressions/hidden-modal',
    lazy: () => import('./regressions.solid.tsx').then((m) => m.RegressionHiddenModal),
  },
];
