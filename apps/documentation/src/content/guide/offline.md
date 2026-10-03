---
title: Working offline
summary: Show the cache, fetch when online, fall back to the cache offline, queue writes for later.
---

# Working offline

Show the cache at once, refresh it when connected, keep showing it offline, and queue writes
until reconnection. [`Network`](/packages/expo/network), [`Storage`](/packages/expo/storage) or
[`Database`](/packages/expo/database), and React Native's global `fetch` cover it; no new package.

## Pick the cache: `Storage` or `Database`

- **`Storage`** (or `SecureStorage`) holds single values through a stored signal,
  `store.signal('key', initial)`, read like an accessor and written with `set`. It cannot query,
  filter or sort lists.
- **`Database`** (`expo-sqlite`, opened and migrated by `database()`) suits feeds, search results
  and paginated rows that need `SELECT ... WHERE ... ORDER BY`.

The feed below uses `Database`; a value such as a last-synced timestamp belongs in `Storage`.

## The worked example: a note feed

Declare the schema and migrations as a module-level value ([Database](/packages/expo/database)
explains why). Outside a component `database()` opens `expo-sqlite` directly; inside a
`ServiceScope` it uses the scope's `Database.SOURCE`:

```ts
// notes-db.ts
import { database } from '@solidnative/expo/solid/database';

export const notesDb = database('notes.db', [
  {
    to: 1,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE note (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE pending_write (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL,
          body TEXT NOT NULL
        );
      `),
  },
]);
```

`pending_write` holds unsent notes, ordered by `seq` since row order is not guaranteed. The
service below works from an in-memory `queue` that `pending_write` persists across restarts; see
the last pitfall for why every `notesDb` call has its own `try`/`catch`.

```ts
// notes.ts
import { createEffect, createSignal } from 'solid-js';
import { createServiceToken, useService } from '@solidnative/device/solid';
import { Network } from '@solidnative/expo/solid/network';
import { notesDb } from './notes-db.ts';

export interface Note {
  readonly id: string;
  readonly body: string;
  readonly updatedAt: number;
}

/** A queued write not yet sent, kept in memory so the queue works with no SQLite - see above. */
interface PendingWrite {
  readonly seq: number;
  readonly id: string;
  readonly body: string;
}

const API = 'https://example.com/notes';
const nextId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** `fetch` resolves on a 4xx/5xx; treat those as failures too, so nothing is dropped. */
async function send(method: 'GET' | 'POST', body?: unknown): Promise<Response> {
  const response = await fetch(API, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${API}: ${response.status}`);
  return response;
}

export function createNotes(network: Network) {
  const [notes, setNotes] = createSignal<Note[]>([]);
  const [queue, setQueue] = createSignal<PendingWrite[]>([]);
  const [isRefreshing, setRefreshing] = createSignal(false);
  let flushing = false;
  let seq = 0;

  /**
   * Cached rows, and the queue as it stood at the last launch, on screen immediately - this is
   * what a cold, offline start shows. The `catch` keeps a platform with no SQLite starting: no
   * cache and an empty queue is exactly what a genuinely cold start looks like anyway.
   */
  async function loadFromCache(): Promise<void> {
    try {
      const db = await notesDb.ready();
      setNotes(
        await db.getAllAsync<Note>(
          'SELECT id, body, updated_at as updatedAt FROM note ORDER BY updated_at DESC',
        ),
      );
      const pending = await db.getAllAsync<PendingWrite>(
        'SELECT seq, id, body FROM pending_write ORDER BY seq',
      );
      setQueue(pending);
      seq = pending.reduce((max, write) => Math.max(max, write.seq), 0);
    } catch {
      // No SQLite on this platform (Node under a test, a browser preview).
    }
  }

  /**
   * Fresh data when there is a connection; the cache already on screen is the offline fallback.
   * The in-memory `queue` decides which notes are still local creations the server has not seen.
   */
  async function refresh(): Promise<void> {
    setRefreshing(true);
    try {
      await flushPendingWrites();
      const fresh = (await (await send('GET')).json()) as Note[];

      // Drop only notes the server no longer has and that are not still queued to be sent.
      const pendingIds = new Set(queue().map((write) => write.id));
      const freshIds = new Set(fresh.map((note) => note.id));
      const kept = notes().filter((note) => pendingIds.has(note.id) && !freshIds.has(note.id));
      setNotes([...fresh, ...kept]);
      await persistAll();
    } catch {
      // Offline, or the server is unreachable - the cache stays exactly as it was. There is no
      // separate "offline branch" to write; not updating is the fallback.
    } finally {
      setRefreshing(false);
    }
  }

  /** Optimistic: the note is on screen and queued before the server has seen it. */
  async function add(body: string): Promise<void> {
    const note: Note = { id: nextId(), body, updatedAt: Date.now() };
    setNotes((list) => [note, ...list]);
    setQueue((writes) => [...writes, { seq: ++seq, id: note.id, body: note.body }]);
    await persistNote(note);
    if (network.connected()) void flushPendingWrites();
  }

  /**
   * Sends whatever is queued, oldest first by `seq`, and stops at the first failure to try again
   * later. `flushing` serialises this against itself, so a reconnect and a fresh `add()` cannot
   * send the same write twice. `pending_write` mirrors `queue` for the next launch.
   */
  async function flushPendingWrites(): Promise<void> {
    if (flushing) return;
    flushing = true;
    try {
      for (const write of [...queue()].sort((a, b) => a.seq - b.seq)) {
        try {
          await send('POST', write);
          setQueue((writes) => writes.filter((w) => w.seq !== write.seq));
          await deletePendingRow(write.id);
        } catch {
          break; // still offline, or the server rejected it - leave the rest queued
        }
      }
    } finally {
      flushing = false;
    }
  }

  /** The note and its queue entry in one transaction. Best-effort, like every SQLite call here. */
  async function persistNote(note: Note): Promise<void> {
    try {
      const db = await notesDb.ready();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'INSERT INTO note (id, body, updated_at) VALUES (?, ?, ?)',
          note.id,
          note.body,
          note.updatedAt,
        );
        await db.runAsync('INSERT INTO pending_write (id, body) VALUES (?, ?)', note.id, note.body);
      });
    } catch {
      // No SQLite on this platform - the in-memory queue is what actually gets flushed.
    }
  }

  /** Mirrors the merged list into `note`, wholesale. Best-effort, as above. */
  async function persistAll(): Promise<void> {
    try {
      const db = await notesDb.ready();
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM note');
        for (const note of notes()) {
          await db.runAsync(
            'INSERT INTO note (id, body, updated_at) VALUES (?, ?, ?)',
            note.id,
            note.body,
            note.updatedAt,
          );
        }
      });
    } catch {
      // No SQLite on this platform.
    }
  }

  async function deletePendingRow(id: string): Promise<void> {
    try {
      const db = await notesDb.ready();
      await db.runAsync('DELETE FROM pending_write WHERE id = ?', id);
    } catch {
      // No SQLite on this platform.
    }
  }

  void loadFromCache();
  // `connected` flips true the moment there is a network of any kind - see "reachable is not
  // proof" below for why this reads `connected`, not `reachable`.
  createEffect(() => {
    if (network.connected()) void refresh();
  });

  return { notes, isRefreshing, add, refresh };
}

/** One feed per service scope; the effect above is owned by, and stops with, that scope. */
export const Notes = createServiceToken('app.notes', () => createNotes(useService(Network)));
```

The [Notes example](/examples/notes) adds a sync-status pill and a toggle to disable sync. The
component needs no offline logic:

```tsx
/** @jsxImportSource @solidnative/platform/solid */
// note-feed.solid.tsx
import { createSignal } from 'solid-js';
import { Pressable, Text, TextInput, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { For, Show } from '@solidnative/platform/solid';
import { Notes } from './notes.ts';

export function NoteFeed() {
  const notes = useService(Notes);
  const [draft, setDraft] = createSignal('');

  function addNote() {
    const body = draft().trim();
    if (!body) return;
    void notes.add(body);
    setDraft('');
  }

  return (
    <View>
      <Show when={notes.isRefreshing()}>
        <Text>Refreshing…</Text>
      </Show>

      <For each={notes.notes()}>{(note) => <Text>{note.body}</Text>}</For>

      <TextInput placeholder="New note" value={draft()} onValueChange={setDraft} />
      <Pressable accessibilityRole="button" onPress={addNote}>
        <Text>Add</Text>
      </Pressable>
    </View>
  );
}
```

`useService` resolves `Notes` in the nearest `ServiceScope` (from `@solidnative/device/solid`);
a test can override `Network` there with `provideService(Network, ...)`.

## One place for request-wide behaviour

There is no `HttpClient` or interceptor chain. Put request-wide behaviour in `send()`, such as
logging requests that never reached the server:

```ts
async function send(method: 'GET' | 'POST', body?: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(API, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // A network failure rejects with no response at all - distinguish it from a real 4xx/5xx
    // before deciding whether to retry.
    console.warn(`[offline] ${method} ${API} did not reach the server`);
    throw error;
  }
  if (!response.ok) throw new Error(`${method} ${API}: ${response.status}`);
  return response;
}
```

## Pitfalls

### `reachable` is not proof a request will land

[`Network`](/packages/expo/network) separates a connection (`connected`) from the platform's
reachability estimate (`reachable`), which is `null` until known, equals `connected` on iOS, and
never probes your server. A banner checking `reachable === false` must treat `null` as unknown.

`refresh()` runs on `connected` and its `catch` covers an unreachable server; waiting for
`reachable` would skip the cold-start refresh.

### `fetch` does not reject on an error status

`fetch` rejects only when no response arrives; a 500 resolves like a 200. Without the
`response.ok` check, an error body would overwrite the cache or a refused write would leave the
queue. `send()` makes every non-2xx a failure, so it lands in the `catch` blocks that keep both.

### The queue needs an order, a transaction, and a stopping point

`flushPendingWrites()` sends oldest first and stops at the first failure, so the user's order
holds and a stuck write does not retry behind later ones; `flushing` stops two flushes at once.
`add()` writes the note and its queue entry in one transaction, and `refresh()` keeps queued notes
the server has not confirmed yet.

### `Database` is not inert without `expo-sqlite` - the queue has to be

Without native modules `Network`'s `connected()` returns `false` and `Storage` keeps `initial`
values, but `Database` rejects `notesDb.ready()` on purpose (see
[Database](/packages/expo/database)). Unguarded, `add()` would reject before queuing, as unhandled
rejections in Node tests and browser previews. So `queue` is the source of truth and each `notesDb`
call is wrapped: SQLite only adds durability. The [Notes example](/examples/notes) does this in
`sync/notes.solid.ts`, with tests covering the feed, queue and merge in Node without `expo-sqlite`.
