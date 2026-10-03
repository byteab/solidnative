import type { NativeRoute } from '@solidnative/router/solid';
export const noteRoutes: readonly NativeRoute[] = [
  { path: 'notes', lazy: () => import('./notes-page.solid.tsx').then((m) => m.NotesPage) },
  { path: 'notes/:id', lazy: () => import('./note-editor.solid.tsx').then((m) => m.NoteEditor) },
];
