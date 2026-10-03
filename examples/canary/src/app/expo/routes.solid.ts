import type { NativeRoute } from '@solid-native/router/solid';

/** The converted native-module screens; other Expo routes remain explicit migration work. */
export const expoRoutes: readonly NativeRoute[] = [
  {
    path: 'expo',
    lazy: () => import('./expo.solid.tsx').then((module) => module.ExpoPage),
  },
  {
    path: 'native-views',
    lazy: () => import('./native-views.solid.tsx').then((module) => module.NativeViewsPage),
  },
  {
    path: 'expo-ui',
    lazy: () => import('./expo-ui.solid.tsx').then((module) => module.ExpoUiPage),
  },
  { path: 'maps', lazy: () => import('./maps.solid.tsx').then((module) => module.MapsPage) },
  {
    path: 'language-model',
    lazy: () => import('./language-model.solid.tsx').then((module) => module.LanguageModelPage),
  },
];
