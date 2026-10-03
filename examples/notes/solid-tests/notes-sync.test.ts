import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createRoot, createSignal } from 'solid-js';
import { Store } from '@solid-native/expo/solid/store';
import type { Network } from '@solid-native/expo/solid/network';
import type { NoteWrite, NotesApi } from '../src/app/api/notes-api.solid.ts';
import type { Note } from '../src/app/data/note.ts';
import type { NotesDatabase } from '../src/app/data/notes-database.solid.ts';
import { NotesSync } from '../src/app/sync/notes.solid.ts';

/** A note or two the fake server already has, distinct from the seeded local notes. */
const REMOTE: readonly Note[] = [
  {
    id: 'remote-1',
    title: 'From the server',
    body: 'Already synced.',
    pinned: false,
    updatedAt: 1,
  },
];

/** A `NotesApi` a test can see inside: every push recorded, and failures switched on to order. */
class RecordingApi implements NotesApi {
  readonly pushCalls: NoteWrite[] = [];
  private failNextCalls = 0;
  remote: Note[] = [...REMOTE];

  async list(): Promise<readonly Note[]> {
    return this.remote;
  }

  async push(write: NoteWrite): Promise<void> {
    if (this.failNextCalls > 0) {
      this.failNextCalls--;
      throw new Error('the fake server rejected the write');
    }
    this.pushCalls.push(write);
    if (write.deleted) this.remote = this.remote.filter((note) => note.id !== write.id);
    else {
      const { deleted: _deleted, ...note } = write;
      this.remote = [...this.remote.filter((n) => n.id !== note.id), note];
    }
  }

  failNextPush(times = 1): void {
    this.failNextCalls = times;
  }
}

/** No SQLite under Node: the in-memory queue is the whole truth, as the service documents. */
const noDatabase = {
  ready: () => Promise.reject(new Error('No SQLite under Node.')),
} as unknown as NotesDatabase;

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let api: RecordingApi;
let disposers: (() => void)[] = [];

beforeEach(() => {
  api = new RecordingApi();
  for (const dispose of disposers) dispose();
  disposers = [];
});

function buildNotes(options: { connected?: boolean } = {}) {
  return createRoot((dispose) => {
    disposers.push(dispose);
    const [connected] = createSignal(options.connected ?? true);
    const network: Network = {
      connected,
      reachable: connected,
      type: () => (connected() ? 'wifi' : 'none'),
      status: () => ({
        connected: connected(),
        type: connected() ? 'wifi' : 'none',
        reachable: connected(),
      }),
    };
    return new NotesSync(api, network, new Store(null), noDatabase);
  });
}

test('a write made offline is queued, and reaches the server once back online', async () => {
  const notes = buildNotes({ connected: false });
  await settle();

  await notes.add('Shopping', 'Milk and eggs');
  assert.equal(notes.pendingCount(), 1);
  assert.equal(api.pushCalls.length, 0);

  await notes.refresh();
  assert.equal(api.pushCalls.length, 1);
  assert.equal(api.pushCalls[0]?.title, 'Shopping');
  assert.equal(notes.pendingCount(), 0);
});

test('a failed flush leaves the write queued rather than dropping it', async () => {
  const notes = buildNotes({ connected: false });
  await settle();

  await notes.add('Shopping', 'Milk and eggs');
  assert.equal(notes.pendingCount(), 1);

  api.failNextPush();
  await notes.refresh(); // tries to flush, and fails once
  assert.equal(notes.pendingCount(), 1);
  assert.equal(api.pushCalls.length, 0);
  assert.equal(notes.find(notes.notes()[0]!.id)?.title, 'Shopping');

  await notes.refresh(); // tries again, and this time it lands
  assert.equal(notes.pendingCount(), 0);
  assert.equal(api.pushCalls.length, 1);
});

test('the queue flushes oldest first', async () => {
  const notes = buildNotes({ connected: false });
  await settle();

  await notes.add('First', 'one');
  await notes.add('Second', 'two');
  await notes.add('Third', 'three');

  await notes.refresh();
  assert.deepEqual(
    api.pushCalls.map((write) => write.title),
    ['First', 'Second', 'Third'],
  );
});

test('a flush already running is not started again', async () => {
  const notes = buildNotes({ connected: false });
  await settle();
  await notes.add('First', 'one');
  await notes.add('Second', 'two');

  await Promise.all([notes.refresh(), notes.refresh()]);

  assert.equal(api.pushCalls.length, 2);
  assert.equal(notes.pendingCount(), 0);
});

test('a merge keeps a note the server has not confirmed yet', async () => {
  const notes = buildNotes({ connected: false });
  await settle();

  await notes.add('Not synced yet', 'still local');
  assert.equal(notes.pendingCount(), 1);

  api.failNextPush(); // the refresh below tries to flush it and fails once more
  await notes.refresh();

  const titles = notes.notes().map((note) => note.title);
  assert.equal(titles.includes('Not synced yet'), true);
  assert.equal(titles.includes('From the server'), true);
  assert.equal(notes.pendingCount(), 1);
});

test('the sync toggle keeps writes queued even with a connection', async () => {
  const notes = buildNotes({ connected: true });
  await settle();
  notes.syncEnabled.set(false);

  await notes.add('Draft', 'kept local for now');
  await settle();

  assert.equal(notes.status(), 'offline');
  assert.equal(api.pushCalls.length, 0);

  notes.syncEnabled.set(true);
  await notes.refresh();
  assert.equal(api.pushCalls.length, 1);
});

test('clearing local data empties both the list and the queue', async () => {
  const notes = buildNotes({ connected: false });
  await settle();
  await notes.add('Throwaway', 'gone soon');
  assert.equal(notes.pendingCount(), 1);

  await notes.clearLocalData();

  assert.equal(notes.notes().length, 0);
  assert.equal(notes.pendingCount(), 0);
});

test('a refresh started by connectivity does not rerun on every queued write', async () => {
  let lists = 0;
  const counting = new RecordingApi();
  const list = counting.list.bind(counting);
  counting.list = () => {
    lists++;
    return list();
  };
  api = counting;
  const notes = buildNotes({ connected: true });
  await settle();
  assert.equal(lists, 1);
  await notes.add('One', 'body');
  await notes.add('Two', 'body');
  await settle();
  assert.equal(lists, 1);
  assert.equal(notes.status(), 'synced');
});
