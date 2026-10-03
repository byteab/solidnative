import { batch, createEffect, createMemo, createSignal, onCleanup, untrack } from 'solid-js';
import { createServiceToken, useService } from '@solid-native/device/solid';
import { Network } from '@solid-native/expo/solid/network';
import { Storage } from '@solid-native/expo/solid/store';
import { NotesServer, type Change, type ServerNote } from './notes-server.solid.ts';

export interface Note {
  readonly id: string;
  readonly text: string;
  readonly base: number;
  readonly pending: boolean;
}
/** Persist attempted identity too: a lost reply may already have changed the server. */
export interface PendingChange extends Change {
  readonly attempted?: boolean;
}
const newId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const BACKOFF = [1000, 2000, 5000, 15000, 30000];

export function createFieldNotes(
  store: Storage,
  network: Network,
  server: Pick<NotesServer, 'send'>,
) {
  const notes = store.signal<Note[]>('field-notes', []);
  const outbox = store.signal<PendingChange[]>('field-outbox', []);
  const [airplane, setAirplane] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [lastError, setLastError] = createSignal<string | null>(null);
  const [backingOff, setBackingOff] = createSignal(false);
  const online = createMemo(
    () => network.connected() && network.reachable() !== false && !airplane(),
  );
  let active = true,
    attempt = 0;
  let retry: ReturnType<typeof setTimeout> | null = null;
  const api = {
    notes,
    outbox,
    airplane,
    setAirplane,
    sending,
    lastError,
    ready: store.ready,
    online,
    backoff: BACKOFF as readonly number[],
    add,
    edit,
    remove,
    retryNow,
  };
  onCleanup(() => {
    active = false;
    if (retry) clearTimeout(retry);
    retry = null;
  });
  createEffect(() => {
    const idle = !sending() && !backingOff();
    if (online() && store.ready() && outbox().length && idle)
      untrack(() => {
        void send();
      });
  });
  createEffect(() => {
    if (online()) untrack(retryNow);
  });

  function add(text: string) {
    if (!active || !store.ready()) return;
    const note = { id: newId(), text, base: 0, pending: true };
    batch(() => {
      notes.update((all) => [note, ...all]);
      if (active) queue({ kind: 'save', id: note.id, text, base: 0 });
    });
  }
  function edit(id: string, text: string) {
    if (!active || !store.ready()) return;
    const note = notes().find((each) => each.id === id);
    if (!note) return;
    batch(() => {
      notes.update((all) =>
        all.map((each) => (each.id === id ? { ...each, text, pending: true } : each)),
      );
      if (active) queue({ kind: 'save', id, text, base: note.base });
    });
  }
  function remove(id: string) {
    if (!active || !store.ready()) return;
    const note = notes().find((each) => each.id === id);
    if (!note) return;
    batch(() => {
      notes.update((all) => all.filter((each) => each.id !== id));
      if (active) queue({ kind: 'delete', id, text: '', base: note.base });
    });
  }
  function retryNow() {
    if (!active) return;
    if (retry) clearTimeout(retry);
    retry = null;
    attempt = 0;
    setBackingOff(false);
  }
  function queue(change: Omit<Change, 'op'>) {
    if (!active) return;
    outbox.update((all) => {
      const waiting = all.findIndex((each) => each.id === change.id && !each.attempted);
      const op = `${change.id}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
      if (waiting === -1) return [...all, { ...change, op }];
      const first = all[waiting]!;
      if (
        first.base === 0 &&
        change.kind === 'delete' &&
        !all.some((each) => each.id === change.id && each.attempted)
      )
        return all.filter((_, at) => at !== waiting);
      return all.map((each, at) => (at === waiting ? { ...change, base: first.base, op } : each));
    });
  }
  async function send() {
    if (!active || sending()) return;
    setSending(true);
    try {
      while (active && online()) {
        const change = outbox()[0];
        if (!change) break;
        outbox.update((all) =>
          all.map((each) => (each.op === change.op ? { ...each, attempted: true } : each)),
        );
        if (!active || !online()) break;
        const answer = await server.send(change);
        if (!active) return;
        batch(() => {
          if (answer.ok) settle(change, answer.note?.version ?? null);
          else keepBoth(change, answer.conflict);
          if (active) {
            attempt = 0;
            setLastError(null);
          }
        });
      }
    } catch (error) {
      if (active)
        batch(() => {
          setLastError(error instanceof Error ? error.message : String(error));
          if (active) scheduleRetry();
        });
    } finally {
      if (active) setSending(false);
    }
  }
  function settle(change: Change, version: number | null) {
    outbox.update((all) =>
      all
        .filter((each) => each.op !== change.op)
        .map((each) =>
          each.id === change.id && version !== null ? { ...each, base: version } : each,
        ),
    );
    if (!active || version === null) return;
    const pending = outbox().some((each) => each.id === change.id);
    notes.update((all) =>
      all.map((note) => (note.id === change.id ? { ...note, base: version, pending } : note)),
    );
  }
  function keepBoth(change: Change, theirs: ServerNote) {
    // All edits behind the conflicted request describe the user's newest intended value.
    const latest =
      outbox()
        .filter((each) => each.id === change.id)
        .at(-1) ?? change;
    const copy: Note = {
      id: newId(),
      text: `${latest.text} (conflict copy)`,
      base: 0,
      pending: true,
    };
    outbox.update((all) => all.filter((each) => each.id !== change.id));
    if (!active) return;
    notes.update((all) => [
      ...(latest.kind === 'delete' ? [] : [copy]),
      ...all.map((note) =>
        note.id === theirs.id
          ? { ...note, text: theirs.text, base: theirs.version, pending: false }
          : note,
      ),
      ...(!all.some((note) => note.id === theirs.id)
        ? [{ id: theirs.id, text: theirs.text, base: theirs.version, pending: false }]
        : []),
    ]);
    if (active && latest.kind !== 'delete')
      queue({ kind: 'save', id: copy.id, text: copy.text, base: 0 });
  }
  function scheduleRetry() {
    if (!active) return;
    const wait = api.backoff[Math.min(attempt++, api.backoff.length - 1)] ?? 1000;
    setBackingOff(true);
    if (!active) return;
    if (retry) clearTimeout(retry);
    retry = setTimeout(() => {
      retry = null;
      if (active) setBackingOff(false);
    }, wait);
  }
  return api;
}
export type FieldNotes = ReturnType<typeof createFieldNotes>;
export const FieldNotes = createServiceToken('canary.field-notes', () =>
  createFieldNotes(useService(Storage), useService(Network), useService(NotesServer)),
);
