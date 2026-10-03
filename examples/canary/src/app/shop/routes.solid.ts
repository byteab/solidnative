import type { NativeRoute } from '@solidnative/router/solid';
export const shopRoutes: readonly NativeRoute[] = [
  { path: 'shop', lazy: () => import('./shop-page.solid.tsx').then((m) => m.ShopPage) },
  {
    path: 'shop/basket',
    lazy: () => import('./basket-sheet.solid.tsx').then((m) => m.BasketSheet),
  },
  { path: 'shop/:id', lazy: () => import('./product-page.solid.tsx').then((m) => m.ProductPage) },
];
