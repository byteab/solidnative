import type { NativeRoute } from '@solid-native/router/solid';

/** Every screen loads when it is first opened, which is what keeps start-up fast. */
export const routes: readonly NativeRoute[] = [
  {
    path: '',
    outlet: 'tabs',
    lazy: () => import('./tabs.solid.tsx').then((m) => m.Tabs),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'library' },
      {
        // A tab with a stack of its own, so the library gets a native header for its large title
        // and search bar, and album detail has somewhere to push onto.
        path: 'library',
        lazy: () => import('./library/library.solid.tsx').then((m) => m.LibraryStack),
        children: [
          { path: '', lazy: () => import('./library/library.solid.tsx').then((m) => m.Library) },
          {
            path: 'album/:id',
            lazy: () => import('./album/album.solid.tsx').then((m) => m.AlbumDetail),
          },
        ],
      },
      {
        path: 'settings',
        lazy: () => import('./settings/settings.solid.tsx').then((m) => m.Settings),
      },
    ],
  },
  {
    // On the app's own stack, over the tabs, so it can be opened from the mini player on any tab
    // and always presents the same way.
    path: 'now-playing',
    lazy: () => import('./now-playing/now-playing.solid.tsx').then((m) => m.NowPlaying),
  },
];
