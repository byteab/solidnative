import type { NativeRoute } from '@solidnative/router/solid';
export const storyRoutes: readonly NativeRoute[] = [
  { path: 'stories', lazy: () => import('./stories-page.solid.tsx').then((m) => m.StoriesPage) },
  {
    path: 'stories/view',
    lazy: () => import('./story-viewer.solid.tsx').then((m) => m.StoryViewer),
  },
];
