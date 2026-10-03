import type { NativeRoute } from '@solidnative/router/solid';

/** Actual task manager routes for eventual composition into the complete application. */
export const projectRoutes: readonly NativeRoute[] = [
  { path: 'projects', lazy: () => import('./projects-page.solid.tsx').then((m) => m.ProjectsPage) },
  {
    path: 'projects/:pid',
    lazy: () => import('./project-page.solid.tsx').then((m) => m.ProjectPage),
  },
  {
    path: 'projects/:pid/new',
    lazy: () => import('./task-editor.solid.tsx').then((m) => m.TaskEditor),
  },
  {
    path: 'projects/:pid/tasks/:tid',
    lazy: () => import('./task-page.solid.tsx').then((m) => m.TaskPage),
  },
  {
    path: 'projects/:pid/tasks/:tid/edit',
    lazy: () => import('./task-editor.solid.tsx').then((m) => m.TaskEditor),
  },
  {
    path: 'projects/:pid/tasks/:tid/comments/:cid',
    lazy: () => import('./comment-page.solid.tsx').then((m) => m.CommentPage),
  },
  { path: 'people/:uid', lazy: () => import('./person-page.solid.tsx').then((m) => m.PersonPage) },
];
