import type { NativeRoute } from '@solidnative/router/solid';
export const playerRoutes: readonly NativeRoute[] = [
  { path: 'player', lazy: () => import('./player-page.solid.tsx').then((m) => m.PlayerPage) },
  { path: 'player/now', lazy: () => import('./now-playing.solid.tsx').then((m) => m.NowPlaying) },
];
