import { createServiceToken } from '@solid-native/device/solid';
import type { Note } from '../data/note.ts';
import { SEED_NOTES } from '../data/seed-notes.ts';

/** One queued write, on its way to the server. `deleted` stands in for a removed note. */
export interface NoteWrite extends Note {
  readonly deleted: boolean;
}

/** The shape a real backend would offer: list the feed, push one write. No real backend exists. */
export interface NotesApi {
  list(): Promise<readonly Note[]>;
  push(write: NoteWrite): Promise<void>;
}

export interface FakeNotesApiOptions {
  /** How long a call takes, in ms. */
  readonly latencyMs?: number;
  /** The chance, 0 to 1, that a call rejects as if the server or the connection failed. */
  readonly failureRate?: number;
}

/**
 * An in-process stand-in for a server: latency and occasional failure, so the sync engine has
 * something realistic to queue writes against. Going offline for a demo is the settings screen's
 * sync toggle, which stops the app calling this at all - see `Notes.status()`.
 */
export class FakeNotesApi implements NotesApi {
  private readonly latencyMs: number;
  private readonly failureRate: number;
  private readonly remote = new Map<string, Note>();

  constructor(seed: readonly Note[], options: FakeNotesApiOptions = {}) {
    this.latencyMs = options.latencyMs ?? 120;
    this.failureRate = options.failureRate ?? 0;
    for (const note of seed) this.remote.set(note.id, note);
  }

  async list(): Promise<readonly Note[]> {
    await this.attempt();
    return [...this.remote.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async push(write: NoteWrite): Promise<void> {
    await this.attempt();
    if (write.deleted) this.remote.delete(write.id);
    else {
      const { deleted: _deleted, ...note } = write;
      this.remote.set(write.id, note);
    }
  }

  /** Waits out the simulated latency, then fails for bad luck. */
  private async attempt(): Promise<void> {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    if (Math.random() < this.failureRate) throw new Error('The server rejected the request.');
  }
}

/**
 * The server's own copy of the local seed, plus one note it has that the device does not - the
 * first online launch merges this straight back over the seed rather than deleting it, since a
 * note the fresh list confirms is never treated as missing.
 */
function seedRemoteNotes(): readonly Note[] {
  return [
    ...SEED_NOTES,
    {
      id: 'seed-welcome',
      title: 'Welcome to Notes',
      body: 'This one came from the server. Pull down to refresh and it would arrive the same way on a real device.',
      pinned: false,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    },
  ];
}

/** Overridden in a test to drive the sync engine against a fake with a queue it can inspect. */
export const NOTES_API = createServiceToken<NotesApi>(
  'notes.api',
  () => new FakeNotesApi(seedRemoteNotes(), { latencyMs: 300, failureRate: 0.15 }),
);
