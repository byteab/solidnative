import { database, type Migration } from '@solid-native/expo/solid/database';

/**
 * The notes cache and its write queue, as [Working offline](/guide/offline) describes: `note` is
 * what is on screen, `pending_write` is what has not reached the server yet. `seq` is the ordering
 * column the queue flushes by - a table's row order is not guaranteed, so an explicit column to
 * sort on is what keeps writes going out in the order they were made.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    to: 1,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE note (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE pending_write (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          pinned INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0
        );
      `),
  },
];

/** Opened by the owning sync service, so its handle closes with that service's owner. */
export const notesDatabase = () => database('notes.db', MIGRATIONS);
export type NotesDatabase = ReturnType<typeof notesDatabase>;
