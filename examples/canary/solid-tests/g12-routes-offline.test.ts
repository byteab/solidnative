import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, createSignal } from 'solid-js';
import { provideService } from '@solidnative/device/solid';
import { Network, type NetworkStatus } from '@solidnative/expo/solid/network';
import { Store, Storage, type NativeStore } from '@solidnative/expo/solid/store';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import { createFieldNotes, type FieldNotes } from '../src/app/offline/field-notes.solid.ts';
import { NotesBackend, NotesServer } from '../src/app/offline/notes-server.solid.ts';
import { offlineRoutes } from '../src/app/offline/routes.solid.ts';
function disk(): NativeStore {
  const data = new Map<string, string>();
  return {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
}
async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.ok(predicate(), 'offline state did not settle');
}
async function open(
  options: { native?: NativeStore; online?: boolean; server?: NotesBackend } = {},
) {
  const native = options.native ?? disk(),
    server = options.server ?? new NotesBackend();
  server.latency = 1;
  let dispose!: () => void, notes!: FieldNotes, online!: (value: boolean) => void, store!: Store;
  createRoot((cleanup) => {
    dispose = cleanup;
    const [connected, setConnected] = createSignal(options.online ?? true);
    online = setConnected;
    store = new Store(native);
    notes = createFieldNotes(
      store,
      {
        connected,
        reachable: connected,
        type: () => 'wifi',
        status: () => ({ connected: connected(), reachable: connected(), type: 'wifi' }),
      },
      server,
    );
    notes.backoff = [2];
  });
  await waitFor(notes.ready);
  return { native, server, notes, online, store, dispose };
}
test('offline add/edit/delete fold unsent work and send upon reconnect', async (t) => {
  const h = await open({ online: false });
  t.after(h.dispose);
  h.notes.add('Birds at the lake');
  h.notes.add('Heron');
  const [heron, birds] = h.notes.notes();
  h.notes.edit(heron!.id, 'Grey heron');
  h.notes.remove(birds!.id);
  assert.deepEqual(
    h.notes.notes().map((note) => note.text),
    ['Grey heron'],
  );
  assert.equal(h.notes.outbox().length, 1);
  assert.equal(h.server.received, 0);
  h.online(true);
  await waitFor(() => !h.notes.sending() && !h.notes.outbox().length);
  assert.deepEqual(
    h.server.all().map((note) => note.text),
    ['Grey heron'],
  );
  assert.equal(h.notes.notes()[0]!.pending, false);
});
test('offline disk retains notes and outbox after close and reopening', async (t) => {
  const native = disk(),
    server = new NotesBackend(),
    first = await open({ native, server, online: false });
  first.notes.add('Otter');
  await first.store.flush();
  first.dispose();
  const second = await open({ native, server, online: false });
  t.after(second.dispose);
  assert.equal(second.notes.notes()[0]!.text, 'Otter');
  assert.equal(second.notes.outbox().length, 1);
  second.online(true);
  await waitFor(() => !second.notes.outbox().length);
  assert.deepEqual(
    server.all().map((note) => note.text),
    ['Otter'],
  );
});
test('offline retries failures and preserves idempotent operation after a lost reply', async (t) => {
  const server = new NotesBackend();
  server.failNext = 2;
  server.dropNext = 1;
  const h = await open({ server });
  t.after(h.dispose);
  h.notes.add('Coot');
  await waitFor(() => !h.notes.sending() && !h.notes.outbox().length);
  assert.equal(server.received, 2);
  assert.equal(server.all().length, 1);
  assert.equal(server.all()[0]!.version, 1);
  assert.equal(h.notes.lastError(), null);
});
test('offline conflict keeps the server text and latest local edit as a copy', async (t) => {
  const h = await open();
  t.after(h.dispose);
  h.notes.add('Moorhen');
  await waitFor(() => !h.notes.outbox().length);
  const id = h.notes.notes()[0]!.id;
  h.server.editElsewhere(id, 'Moorhen (edited elsewhere)');
  h.online(false);
  h.notes.edit(id, 'Two moorhens');
  h.online(true);
  await waitFor(() => !h.notes.sending() && !h.notes.outbox().length);
  assert.deepEqual(
    h.notes
      .notes()
      .map((note) => note.text)
      .sort(),
    ['Moorhen (edited elsewhere)', 'Two moorhens (conflict copy)'],
  );
  assert.deepEqual(
    h.server
      .all()
      .map((note) => note.text)
      .sort(),
    ['Moorhen (edited elsewhere)', 'Two moorhens (conflict copy)'],
  );
});
test('airplane mode suppresses sends and cleanup prevents a delayed answer from publishing', async (t) => {
  const h = await open();
  t.after(h.dispose);
  h.notes.setAirplane(true);
  h.notes.add('Grebe');
  assert.equal(h.server.received, 0);
  assert.equal(h.notes.online(), false);
  h.server.latency = 20;
  h.notes.setAirplane(false);
  const before = JSON.stringify(h.notes.notes());
  h.dispose();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(JSON.stringify(h.notes.notes()), before);
  assert.equal(h.notes.outbox().length, 1);
});
for (const platform of ['ios', 'android'] as const)
  test(`actual ${platform} field-notes route retains controlled editing and uses the airplane switch`, async (t) => {
    const server = new NotesBackend();
    server.latency = 1;
    let status: NetworkStatus = { connected: false, reachable: false, type: 'none' };
    let listener: ((value: NetworkStatus) => void) | undefined;
    const fixture = consumerFixture(
      () => offlineRoutes,
      [
        provideService(Storage.SOURCE, disk),
        provideService(Network.SOURCE, () => ({
          current: () => status,
          subscribe(fn) {
            listener = fn;
            return () => {
              listener = undefined;
            };
          },
        })),
        provideService(NotesServer, () => server),
      ],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/field-notes');
    h.finish();
    await h.waitFor(() => !h.renderedText().includes('Reading your notes'));
    h.input('New note', 'Heron');
    h.press('Add');
    assert.match(h.renderedText(), /Offline, 1 change waiting/);
    h.press('Edit');
    h.input('Edit note', 'Grey heron');
    const tag = h.nodes().find((node) => node.props['accessibilityLabel'] === 'Edit note')!.tag;
    h.input('Edit note', 'Two herons', 2);
    assert.equal(
      h.nodes().find((node) => node.props['accessibilityLabel'] === 'Edit note')!.tag,
      tag,
    );
    h.press('Done');
    assert.match(h.renderedText(), /Two herons/);
    status = { connected: true, reachable: true, type: 'wifi' };
    listener!(status);
    await h.waitFor(() => h.renderedText().includes('All changes saved'));
    assert.equal(server.all()[0]!.text, 'Two herons');
    const toggle = h.nodes().find((node) => node.props['accessibilityLabel'] === 'Airplane mode')!;
    h.fabric.emit(toggle, 'topChange', { value: true });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Offline/);
    h.input('New note', 'Grebe', 2);
    h.press('Add');
    assert.match(h.renderedText(), /Offline, 1 change waiting/);
    h.fabric.emit(toggle, 'topChange', { value: false });
    await h.waitFor(() => h.renderedText().includes('All changes saved'));
    assert.equal(server.all().length, 2);
    assert.deepEqual(fixture.errors, []);
  });
