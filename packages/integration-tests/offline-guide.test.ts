/**
 * The offline guide's worked example (`apps/documentation/src/content/guide/offline.md`), pulled
 * straight out of the guide's markdown and run for real - not copied here by hand, so an edit to
 * the guide that breaks the pattern breaks this test rather than shipping quietly.
 *
 * What the guide used to get wrong: `loadFromCache()` and `add()` awaited `notesDb.ready()` with
 * no `try`/`catch`, and `Database` rejects rather than standing in quietly without `expo-sqlite` -
 * exactly the platform this test runs on. The old `add()` never resolved, so its queue write was
 * lost with an unhandled rejection; the fixed one keeps the queue in memory and treats every
 * SQLite call as best-effort, so it works whether or not `expo-sqlite` is there to ask.
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRoot } from 'solid-js';

interface Note {
  readonly id: string;
  readonly body: string;
  readonly updatedAt: number;
}

interface GuideNotes {
  readonly notes: () => readonly Note[];
  add(body: string): Promise<void>;
  refresh(): Promise<void>;
}

type CreateNotes = (network: { connected: () => boolean }) => GuideNotes;

/** Pulls a fenced ```ts block out of the guide by the `// <file>` comment its first line carries. */
function extractBlock(markdown: string, file: string): string {
  const marker = `// ${file}\n`;
  const start = markdown.indexOf(marker);
  assert.ok(start !== -1, `${file} not found in the offline guide`);
  const end = markdown.indexOf('\n```', start);
  assert.ok(end !== -1, `${file}'s closing fence not found in the offline guide`);
  return markdown.slice(start, end);
}

/** A fake server behind the global `fetch` the guide's `send()` calls. */
function fakeServer(handlers: { get?: () => Note[]; post?: (body: unknown) => void }) {
  globalThis.fetch = (async (_url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'POST') handlers.post?.(JSON.parse(init.body ?? 'null'));
    const list = init?.method === 'GET' ? (handlers.get?.() ?? []) : undefined;
    return { ok: true, status: 200, json: async () => list } as Response;
  }) as typeof fetch;
}

/** Lets every promise the service started settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("the offline guide's worked example, extracted and compiled for real", () => {
  const realFetch = globalThis.fetch;
  let createNotes: CreateNotes;
  let directory: string;
  const disposers: (() => void)[] = [];

  before(async () => {
    const guidePath = fileURLToPath(
      new URL('../../apps/documentation/src/content/guide/offline.md', import.meta.url),
    );
    const markdown = readFileSync(guidePath, 'utf8');
    // Inside this package, not the system tmp directory: Node resolves a bare specifier
    // ('solid-js', '@solidnative/expo/solid/database', ...) by walking up from the importing file
    // looking for node_modules, which a directory outside the workspace has none of.
    const here = fileURLToPath(new URL('.', import.meta.url));
    directory = mkdtempSync(path.join(here, '.offline-guide-'));
    writeFileSync(path.join(directory, 'notes-db.ts'), extractBlock(markdown, 'notes-db.ts'));
    writeFileSync(path.join(directory, 'notes.ts'), extractBlock(markdown, 'notes.ts'));

    const mod = (await import(pathToFileURL(path.join(directory, 'notes.ts')).href)) as {
      createNotes: CreateNotes;
      Notes: unknown;
    };
    assert.ok(mod.Notes, 'the guide still exports its service token');
    createNotes = mod.createNotes;
  });

  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
    globalThis.fetch = realFetch;
  });
  after(() => rmSync(directory, { recursive: true, force: true }));

  /** The service in its own reactive owner, as a service scope gives it one in an app. */
  function build(connected: boolean): GuideNotes {
    return createRoot((dispose) => {
      disposers.push(dispose);
      return createNotes({ connected: () => connected });
    });
  }

  it('queues a note added with no connection and no expo-sqlite, rather than losing it', async () => {
    fakeServer({});
    const notes = build(false);
    await assert.doesNotReject(() => notes.add('Milk and eggs'));
    assert.equal(notes.notes().length, 1);
    assert.equal(notes.notes()[0]?.body, 'Milk and eggs');
  });

  it('flushes the queued note once refresh runs, with no expo-sqlite to persist it through', async () => {
    const posted: unknown[] = [];
    fakeServer({ post: (body) => posted.push(body) });
    const notes = build(true);
    await settle();

    await notes.add('Milk and eggs');
    await notes.refresh();
    await settle();

    assert.equal(posted.length, 1, 'the queued write reached the fake server, once');
    assert.equal((posted[0] as { body?: string }).body, 'Milk and eggs');
  });

  it("keeps a note still queued when the server's list does not include it yet", async () => {
    fakeServer({
      get: () => [{ id: 'server-1', body: 'From the server', updatedAt: 1 }],
      post: () => {
        throw new Error('the fake server rejected the write');
      },
    });
    const notes = build(true);
    await settle();

    await notes.add('Milk and eggs');
    await notes.refresh();

    const bodies = notes.notes().map((note) => note.body);
    assert.ok(bodies.includes('Milk and eggs'), 'the pending note was not dropped by the merge');
    assert.ok(bodies.includes('From the server'), "the server's note is in the merged list");
  });
});
