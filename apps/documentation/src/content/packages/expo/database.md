---
title: Database
summary: A SQLite database, opened on first use, migrated before the first query sees it.
---

# Database

`database(name, migrations)` replaces `expo-sqlite`'s React-only `SQLiteProvider` and
`useSQLiteContext`. The database is the module's own object, `getAllAsync` and all; this adds the
lifecycle: opened once, migrated before anything queries it, closed on request.

## Install

```sh
npx expo install expo-sqlite
```

```ts
import { database } from '@solidnative/expo/solid/database';
```

## The smallest useful example

It is a value rather than a service, since a schema belongs to a feature and an app usually has
one. Created at a module's top level, outside any Solid owner, it lives as long as the app:

```ts
import { database } from '@solidnative/expo/solid/database';

export const notes = database('notes.db', [
  { to: 1, up: (db) => db.execAsync('CREATE TABLE note (id INTEGER PRIMARY KEY, body TEXT)') },
]);
```

```tsx
import { createSignal, onMount } from 'solid-js';
import { Text } from '@solidnative/components/solid';
import { notes } from './notes-db.ts';

export function NoteList() {
  const [count, setCount] = createSignal(0);

  onMount(async () => {
    const db = await notes.ready();
    const rows = await db.getAllAsync('SELECT * FROM note');
    setCount(rows.length);
  });

  return <Text>{count()} notes</Text>;
}
```

Called inside a component, `database()` belongs to it: it reads its source with
`useService(Database.SOURCE)`, so a test can swap it with
`provideService(Database.SOURCE, () => ({ open }))` in a `ServiceScope`, and the connection is
closed (`dispose()`) with the component. After that, `ready()` rejects.

## Opening

Nothing opens until `ready()` is called, so an app that never reads pays for no file handle or WAL
journal. Every caller can call `ready()`: the first opens the database, and anyone arriving while it
opens gets the same promise, so one file never gets two connections.

## Migrations

Each migration names the version it produces (`to`) and a function that gets there (`up`). They
run in order, each in its own transaction, and the version is recorded in SQLite's
`PRAGMA user_version`, not a table. Migrations at or below the recorded version are skipped, so the
same list can be passed on every launch and only new ones run.

```ts
export const notes = database('notes.db', [
  { to: 1, up: (db) => db.execAsync('CREATE TABLE note (id, body)') },
  { to: 2, up: (db) => db.execAsync('ALTER TABLE note ADD COLUMN created_at INTEGER') },
]);
```

`user_version` is set in the migration's own transaction, so the schema change and the version bump
commit or roll back together: a migration that fails part-way leaves both unchanged, and the next
launch runs it again from the start.

### When a migration fails

`ready()` rejects with the migration's error, after closing the connection it opened. The failed
open is forgotten, so the next `ready()` reopens and retries the outstanding migrations. `close()`
after a failed open resolves without doing anything.

## Closing

`close()` releases the connection, and resolves even if opening had failed. The next `ready()`
reopens it; most apps can leave it open. It does not delete data: to remove data on sign-out,
delete the rows or the database file.

## Without the module

`ready()` rejects with a `MissingModuleError` naming the fix when `expo-sqlite` is missing (never
installed, or not rebuilt since), on iOS, Android and the web alike; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed). There is
no fallback value for a query, so a database fails loudly rather than pretending to hold data.

## Working offline

Use `Database` to cache a list (a feed, search results, anything queried, filtered or sorted) where
`Storage`'s single-value model does not fit. [Working offline](/guide/offline) walks through caching
a feed here, refreshing it when [`Network`](/packages/expo/network) reports a connection, and
queuing offline writes in their own table.
