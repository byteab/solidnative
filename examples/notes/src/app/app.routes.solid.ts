import type { NativeRoute } from '@solid-native/router/solid';

/** Every screen loads when it is first opened, which is what keeps start-up fast. */
export const routes: readonly NativeRoute[] = [
  {
    path: '',
    outlet: 'tabs',
    lazy: () => import('./tabs.solid.tsx').then((m) => m.Tabs),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'notes' },
      {
        // A tab with a stack of its own, for the native header, its large title and search bar.
        path: 'notes',
        lazy: () => import('./notes/notes-list.solid.tsx').then((m) => m.NotesStack),
        children: [
          {
            path: '',
            lazy: () => import('./notes/notes-list.solid.tsx').then((m) => m.NotesList),
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
    // Matched before the plain `:id` route below, or "new" would be read as an id.
    path: 'note/new',
    lazy: () => import('./editor/editor.solid.tsx').then((m) => m.Editor),
  },
  {
    // On the app's stack, over the tabs, so a note opened from the list pushes a real screen with
    // a back button and its own header.
    path: 'note/:id',
    lazy: () => import('./editor/editor.solid.tsx').then((m) => m.Editor),
  },
];
