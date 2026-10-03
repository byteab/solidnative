import type { NativeRoute } from '@solidnative/router/solid';

/** Migrated tab subtree for eventual composition into the complete application route table. */
export const tabRoute: NativeRoute = {
  path: 'tabs',
  outlet: 'tabs',
  lazy: () => import('./tabs.solid.tsx').then((m) => m.TabsPage),
  children: [
    { path: '', pathMatch: 'full', redirectTo: 'library' },
    {
      path: 'library',
      lazy: () => import('./tab-library.solid.tsx').then((m) => m.TabLibrary),
      children: [
        { path: '', lazy: () => import('./tab-library.solid.tsx').then((m) => m.LibraryList) },
        {
          path: ':album',
          lazy: () => import('./tab-library.solid.tsx').then((m) => m.LibraryAlbum),
        },
      ],
    },
    { path: 'search', lazy: () => import('./tab-plain.solid.tsx').then((m) => m.TabSearch) },
    { path: 'profile', lazy: () => import('./tab-plain.solid.tsx').then((m) => m.TabProfile) },
  ],
};
