import { test } from 'node:test';
import { assertNativeSheets } from './native-sheets.ts';

test('all seven route styles compile on iOS and Android', () => {
  assertNativeSheets([
    'calendar/calendar-page',
    'collections/playlist',
    'kanban/kanban-card',
    'kanban/kanban-page',
    'notes/notes-page',
    'notes/note-editor',
    'offline/offline-notes',
  ]);
});
