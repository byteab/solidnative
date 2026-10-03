import type { NativeRoute } from '@solid-native/router/solid';

export const styleRoutes: readonly NativeRoute[] = [
  { path: 'text', lazy: () => import('./text.solid.tsx').then((m) => m.TextNesting) },
  { path: 'css', lazy: () => import('./css.solid.tsx').then((m) => m.CssPage) },
  { path: 'layout', lazy: () => import('./layout.solid.tsx').then((m) => m.LayoutPage) },
  {
    path: 'typography',
    lazy: () => import('./typography.solid.tsx').then((m) => m.TypographyPage),
  },
  { path: 'surfaces', lazy: () => import('./surfaces.solid.tsx').then((m) => m.SurfacesPage) },
  { path: 'css-engine', lazy: () => import('./css-engine.solid.tsx').then((m) => m.CssEnginePage) },
  {
    path: 'tailwind',
    lazy: () => import('../tailwind/tailwind-page.solid.tsx').then((m) => m.TailwindPage),
  },
];
