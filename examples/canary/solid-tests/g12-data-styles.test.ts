import { test } from 'node:test';
import { assertNativeSheets } from './native-sheets.ts';

test('all nine data-screen styles compile on iOS and Android', () => {
  assertNativeSheets([
    'feed/feed',
    'feed/feed-gallery',
    'feed/feed-post',
    'chat/chat',
    'chat/chat-bubble',
    'browse/browse',
    'browse/browse-shelf',
    'inbox/inbox',
    'inbox/inbox-row',
  ]);
});
