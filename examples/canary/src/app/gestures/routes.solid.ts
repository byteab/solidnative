import type { NativeRoute } from '@solid-native/router/solid';

/** Original canary paths; compose only after every remaining subtree is migrated. */
export const motionRoutes: readonly NativeRoute[] = [
  {
    path: 'animation',
    lazy: () => import('../components/animation.solid.tsx').then((module) => module.AnimationPage),
  },
  {
    path: 'gestures',
    lazy: () => import('./gestures.solid.tsx').then((module) => module.Gestures),
  },
  {
    path: 'native-gestures',
    lazy: () => import('./native-gestures.solid.tsx').then((module) => module.NativeGesturesPage),
  },
  {
    path: 'worklets',
    lazy: () => import('./worklets.solid.tsx').then((module) => module.WorkletsPage),
  },
];
