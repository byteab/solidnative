import type { NativeRoute } from '@solid-native/router/solid';
export const walletRoutes: readonly NativeRoute[] = [
  { path: 'wallet', lazy: () => import('./wallet-page.solid.tsx').then((m) => m.WalletPage) },
];
