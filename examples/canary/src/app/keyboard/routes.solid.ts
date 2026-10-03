import type { NativeRoute } from '@solid-native/router/solid';

/** Real original keyboard paths, for later complete app composition. */
export const keyboardRoutes: readonly NativeRoute[] = [
  {
    path: 'keyboard',
    lazy: () => import('./keyboard-lab.solid.tsx').then((module) => module.KeyboardLab),
  },
  {
    path: 'keyboard/sheet',
    lazy: () => import('./note-sheet.solid.tsx').then((module) => module.NoteSheet),
  },
];
