import { test } from 'node:test';
import { assertNativeSheets } from './native-sheets.ts';

test('all eleven media sheets, shared shop CSS included, compile on iOS and Android', () => {
  assertNativeSheets([
    'player/player-page',
    'player/now-playing',
    'ride/ride-page',
    'ride/ride-sheet',
    'shop/shop-page',
    'shop/product-page',
    'shop/basket-sheet',
    'stories/stories-page',
    'stories/story-viewer',
    'viewer/gallery',
    'viewer/photo-viewer',
  ]);
});
