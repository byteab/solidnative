/**
 * A persisted value as a signal.
 *
 * The stores underneath are already plain promises, so what is worth testing is the binding: when
 * the value arrives, what happens if the app writes before it does, and what a store written by
 * an older version of the app does to a screen.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRoot } from 'solid-js';
import { Store, type NativeStore } from '@solidnative/expo/solid/store';

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});
function ownedStore(native: NativeStore | null): Store {
  return createRoot((dispose) => {
    disposers.push(dispose);
    return new Store(native);
  });
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function memory(
  initial: Record<string, string> = {},
  sync = false,
): NativeStore & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    get: async (key) => data[key] ?? null,
    set: async (key, value) => void (data[key] = value),
    remove: async (key) => void delete data[key],
    ...(sync ? { getSync: (key: string) => data[key] ?? null } : {}),
  };
}

/** A store whose reads come back only when the test says so. */
function slow(): NativeStore & { answer(key: string, raw: string | null): void } {
  const waiting = new Map<string, (raw: string | null) => void>();
  return {
    get: (key) => new Promise((resolve) => waiting.set(key, resolve)),
    set: async () => {},
    remove: async () => {},
    answer: (key, raw) => waiting.get(key)?.(raw),
  };
}

describe('a stored value', () => {
  it('starts at the default and arrives a turn later', async () => {
    const store = ownedStore(memory({ theme: '"dark"' }));
    const theme = store.signal('theme', 'light');

    assert.equal(theme(), 'light', 'nothing can be read synchronously from an async store');
    await settle();
    assert.equal(theme(), 'dark');
  });

  it('never shows the default when the platform can answer at once', () => {
    // SecureStore can; AsyncStorage cannot. Where it can, a screen should not flash the default.
    const store = ownedStore(memory({ token: '"abc"' }, true));
    assert.equal(store.signal('token', '')(), 'abc');
  });

  it('writes through when set', async () => {
    const native = memory();
    const store = ownedStore(native);
    store.signal('count', 0).set(7);

    await settle();
    assert.equal(native.data['count'], '7');
  });

  it('writes through when updated, the same as when set', async () => {
    // `update()` is the other way a signal changes, and it has its own write-through wiring -
    // sharing none of it with `set()` would be a second place for the persistence to be wrong.
    const native = memory();
    const store = ownedStore(native);
    store.signal('count', 0).update((n) => n + 1);

    await settle();
    assert.equal(native.data['count'], '1');
  });

  it('forgets a key, in the store, when removed', async () => {
    const native = memory({ theme: '"dark"' });
    const store = ownedStore(native);
    await store.remove('theme');

    assert.equal('theme' in native.data, false);
  });

  it('does not let a slow read undo a write that beat it', async () => {
    // The race that makes this worth having as a class. A screen that writes a preference during
    // startup would otherwise have it silently replaced by whatever was there before.
    const store = ownedStore(memory({ theme: '"dark"' }));
    const theme = store.signal('theme', 'light');
    theme.set('system');

    await settle();
    assert.equal(theme(), 'system');
  });

  it('applies an update that beat the read to what was stored, not to the default', async () => {
    // An update is a change to the stored value, not a replacement for it. Applied to the default
    // and written through, a note added while the notes were still being read replaced every note
    // on the disk with that one.
    const native = memory({ notes: '["a","b"]' });
    const store = ownedStore(native);
    const notes = store.signal<string[]>('notes', []);
    notes.update((list) => [...list, 'c']);
    assert.deepEqual(notes(), ['c'], 'shown at once, on what is known so far');

    await settle();
    await store.flush();
    assert.deepEqual(notes(), ['a', 'b', 'c']);
    assert.equal(native.data['notes'], '["a","b","c"]', 'and stored so');
  });

  it('keeps a set that beat the read, and the updates made after it', async () => {
    const store = ownedStore(memory({ notes: '["a"]' }));
    const notes = store.signal<string[]>('notes', []);
    notes.update((list) => [...list, 'lost']);
    notes.set(['x']);
    notes.update((list) => [...list, 'y']);

    await settle();
    assert.deepEqual(notes(), ['x', 'y']);
  });

  it('never writes the default over what was stored, while an update waits for the read', async () => {
    const native = slow();
    const writes: string[] = [];
    native.set = async (_key, value) => void writes.push(value);
    const store = ownedStore(native);
    const notes = store.signal<string[]>('notes', []);
    notes.update((list) => [...list, 'c']);
    await settle();
    assert.deepEqual(writes, [], 'nothing written before the stored value is known');
    native.answer('notes', '["a"]');
    await settle();
    assert.deepEqual(writes, ['["a","c"]']);
  });

  it('hands the same signal to everyone asking for the key', () => {
    const store = ownedStore(memory());
    const a = store.signal('theme', 'light');
    const b = store.signal('theme', 'light');
    a.set('dark');
    assert.equal(b(), 'dark', 'two components binding one preference stay in step');
  });

  it('treats a value it cannot read as absent, not as a crash', async () => {
    // A store written by an older version of the app. The default the caller supplied is a better
    // answer than an exception during startup.
    const store = ownedStore(memory({ theme: 'not json' }));
    const theme = store.signal('theme', 'light');
    await settle();
    assert.equal(theme(), 'light');
  });

  it('works with no store at all, so a test or a web build does not have to fake one', async () => {
    const store = ownedStore(null);
    const theme = store.signal('theme', 'light');
    theme.set('dark');
    await settle();
    assert.equal(theme(), 'dark');
  });

  it('says when everything asked for has been read back', async () => {
    const store = ownedStore(memory({ theme: '"dark"' }));
    store.signal('theme', 'light');
    assert.equal(store.ready(), false);
    await settle();
    assert.equal(store.ready(), true);
  });

  it('is not ready while any key asked for is still being read', async () => {
    // One read coming back says nothing about another: a loading screen held on `ready` would
    // otherwise drop while half its preferences were still their defaults.
    const reads = slow();
    const store = ownedStore(reads);
    store.signal('a', 'A');
    store.signal('b', 'B');

    reads.answer('a', '"stored A"');
    await settle();
    assert.equal(store.ready(), false, 'b has not come back yet');

    reads.answer('b', '"stored B"');
    await settle();
    assert.equal(store.ready(), true);

    store.signal('c', 'C');
    assert.equal(store.ready(), false, 'a new key is a new read to wait for');
    reads.answer('c', null);
    await settle();
    assert.equal(store.ready(), true);
  });

  it('puts the bound signal back to its default when the key is removed', async () => {
    const native = memory();
    const store = ownedStore(native);
    const token = store.signal('token', 'none');
    await settle();
    token.set('secret');
    await store.remove('token');

    assert.equal('token' in native.data, false);
    assert.equal(token(), 'none', 'a signed-out screen must not keep showing the old value');
    assert.equal(store.signal('token', 'other')(), 'none', 'still the one signal for the key');
  });

  it('removes a key set to undefined rather than storing the word', async () => {
    const native = memory();
    const store = ownedStore(native);
    const token = store.signal<string | undefined>('token', 'none');
    await settle();
    token.set('secret');
    await settle();
    token.set(undefined);
    await settle();
    assert.equal('token' in native.data, false);
  });

  it('does not let a read that was in flight bring a removed key back', async () => {
    const reads = slow();
    const store = ownedStore(reads);
    const token = store.signal('token', 'none');
    await store.remove('token');
    reads.answer('token', '"old"');
    await settle();
    assert.equal(token(), 'none');
  });

  it('round-trips a stored null rather than mistaking it for a value it cannot read', async () => {
    // `null` is valid JSON and a valid member of a nullable signal's type. Only a value that
    // fails to parse falls back to the default.
    const store = ownedStore(memory({ choice: 'null' }));
    const choice = store.signal<string | null>('choice', 'fallback');
    await settle();
    assert.equal(choice(), null);
  });

  it('round-trips a stored null read synchronously too', () => {
    const store = ownedStore(memory({ choice: 'null', broken: '{' }, true));
    assert.equal(store.signal<string | null>('choice', 'fallback')(), null);
    assert.equal(store.signal('broken', 'fallback')(), 'fallback');
  });
});

describe('a store that fails', () => {
  const failing = (): NativeStore => ({
    get: async () => {
      throw new Error('read denied');
    },
    set: async () => {
      throw new Error('disk full');
    },
    remove: async () => {
      throw new Error('locked');
    },
  });

  it('never lets a failed read or write become an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', record);
    try {
      const store = ownedStore(failing());
      store.signal('x', 'initial').set('new');
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.deepEqual(unhandled, []);
    } finally {
      process.off('unhandledRejection', record);
    }
  });

  it('says what went wrong on the error signal, and still settles ready', async () => {
    const store = ownedStore(failing());
    const value = store.signal('x', 'initial');
    assert.equal(store.error(), null);
    await settle();

    assert.equal(store.ready(), true, 'the read has finished, even though it failed');
    assert.equal((store.error() as Error).message, 'read denied');
    assert.equal(value(), 'initial', 'a failed read leaves the default in place');

    value.set('new');
    await settle();
    assert.equal(value(), 'new', 'the signal holds what the app set, persisted or not');
    assert.equal((store.error() as Error).message, 'disk full');
  });

  it('rejects flush() with a write that failed, and resolves it once writes succeed', async () => {
    const store = ownedStore(failing());
    store.signal('x', 'initial').set('new');
    await assert.rejects(store.flush(), /disk full/);

    const healthy = ownedStore(memory());
    healthy.signal('x', 0).set(1);
    await healthy.flush();
  });

  it('rejects flush() with a write that failed before flush() was called', async () => {
    const store = ownedStore(failing());
    store.signal('x', 'initial').set('new');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await assert.rejects(store.flush(), /disk full/);
  });

  it('reports each failed write to one flush() only', async () => {
    const store = ownedStore(failing());
    store.signal('x', 'initial').set('new');
    await assert.rejects(store.flush(), /disk full/);
    await store.flush();
  });

  it('rejects remove() with the failure, and says so on the error signal', async () => {
    const store = ownedStore(failing());
    await assert.rejects(store.remove('x'), /locked/);
    assert.equal((store.error() as Error).message, 'locked');
  });
});
