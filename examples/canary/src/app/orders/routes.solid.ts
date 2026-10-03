import type { NativeRoute } from '@solidnative/router/solid';
import { signedIn, type Session } from '../auth/session.solid.ts';

/** The original public and protected order routes, with lazy session binding. */
export function orderRoutes(session: () => Session): readonly NativeRoute[] {
  return [
    { path: 'orders', lazy: () => import('./orders-page.solid.tsx').then((m) => m.OrdersPage) },
    { path: 'orders/:id', lazy: () => import('./order-page.solid.tsx').then((m) => m.OrderPage) },
    {
      path: 'account/orders',
      guard: (context) => signedIn(session())(context),
      lazy: () => import('./orders-page.solid.tsx').then((m) => m.OrdersPage),
    },
  ];
}
