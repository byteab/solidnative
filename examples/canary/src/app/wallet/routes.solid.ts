import type { NativeRoute } from '@solidnative/router/solid';
export const walletRoutes: readonly NativeRoute[] = [
  { path: 'wallet', lazy: () => import('./wallet-page.solid.tsx').then((m) => m.WalletPage) },
];
