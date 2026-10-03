# Notes

An offline-first notes app: write and edit while offline, and every change syncs once there is a
connection again, following the pattern in [Working offline](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/offline.md).

| Screen                                           | What it shows                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Notes (`src/app/notes/notes-list.solid.tsx`)     | A searchable list, pinned notes first, a sync status pill (synced / pending / offline) and pull to refresh   |
| Note (`src/app/editor/editor.solid.tsx`)         | Title and body with a debounced autosave, a keyboard-avoiding layout, a word count and delete with a confirm |
| Settings (`src/app/settings/settings.solid.tsx`) | A sync on/off toggle, when the data last synced, and a "clear local data" that empties the database for real |

Notes and the write queue live in SQLite through `database()` (`src/app/data/notes-database.solid.ts`),
with the same shape as the offline guide: a `pending_write` table ordered by `seq`, a note and its
queue entry written in one transaction, a serialised flush, and a merge that keeps a note the
server has not confirmed yet. `src/app/sync/notes.solid.ts` is the engine; the queue also lives in a
signal in memory, so it works with no SQLite at all - Node under the tests, a browser preview -
the same "inert, not broken" contract `Database` itself follows.

There is no real backend: `src/app/api/notes-api.solid.ts` is a small in-process fake, with latency and
an occasional failure, so a flaky connection is something the app actually has to handle rather
than something to imagine. The sync toggle in Settings stands in for the "offline" a demo cannot
otherwise switch on: turn it off, write a note, turn it back on, and watch the queue drain.

## Run it

From the repository root, after `pnpm install`:

```sh
cd examples/notes
pnpm start     # press i or a, or scan the QR code with Expo Go
pnpm test      # Solid tests in Node against a fake Fabric, no simulator
```

`solid-tests/app.test.ts` drives the list, the editor and settings the way a person would.
`solid-tests/notes-sync.test.ts` covers the sync engine on its own against the fake server:
queued writes surviving a failed flush, flush order, no concurrent flushes, and a merge that keeps
pending local notes. `solid-tests/note.test.ts` covers sorting, search and word count with no
screen in the picture.
