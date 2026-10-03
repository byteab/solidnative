import { test } from 'node:test';
import { assertNativeSheets } from './native-sheets.ts';

test('all extracted showcase styles compile on both native platforms', () => {
  assertNativeSheets([
    'example',
    'css/css-demo',
    'css/layout',
    'css/typography',
    'css/surfaces',
    'css/css-engine',
    'css/text',
    'lists/list',
    'lists/scrolling',
  ]);
});
