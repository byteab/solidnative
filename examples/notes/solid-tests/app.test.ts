import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeNotesApi } from '../src/app/api/notes-api.solid.ts';
import { SEED_NOTES } from '../src/app/data/seed-notes.ts';
import { bootNotes, ONLINE } from './harness.tsx';

for (const platform of ['ios', 'android'] as const) {
  test(`${platform}: creates a note offline, and it syncs once back online`, async (t) => {
    const h = bootNotes({ platform });
    t.after(() => h.root.dispose());
    await h.waitFor(() => h.navigation()?.url() === '/notes');
    h.finish();
    await h.waitFor(() => h.text().includes('Offline'));
    // The seed is on screen from the first frame, pinned notes first.
    assert.ok(h.text().indexOf('Grocery list') < h.text().indexOf('Books to read'));
    assert.ok(h.nodes().some((node) => node.props['placeholder'] === 'Search notes'));

    h.press('New note');
    await h.waitFor(() => h.navigation().url() === '/note/new');
    h.finish();
    await h.waitFor(() => !!h.byLabel('Title'));
    assert.match(h.props(), /"title":"New note"/);
    assert.ok(h.text().includes('0 words'));
    assert.equal(h.byLabel('Delete note'), undefined);

    h.input('Title', 'Groceries');
    h.input('Note body', 'Milk, eggs, bread');
    assert.ok(h.text().includes('3 words'));
    assert.ok(h.text().includes('Saving...'));
    await new Promise((resolve) => setTimeout(resolve, 700)); // the autosave debounce
    h.clock.flushMicrotasks();
    assert.ok(h.text().includes('Saved'));
    assert.ok(h.byLabel('Delete note'), 'a saved note can be deleted');

    assert.equal(await h.navigation().back(), true);
    h.finish();
    await h.waitFor(() => h.navigation().url() === '/notes');
    await h.waitFor(() => h.text().includes('Groceries'));
    assert.ok(h.text().includes('Offline'));

    h.goOnline();
    await h.waitFor(() => h.text().includes('Synced'), 'never synced');
    assert.deepEqual(h.errors, []);
  });
}

test('search filters the list and says when nothing matches', async (t) => {
  const h = bootNotes();
  t.after(() => h.root.dispose());
  await h.waitFor(() => h.navigation()?.url() === '/notes');
  h.finish();
  await h.waitFor(() => h.text().includes('Grocery list'));
  const search = h.nodes().find((node) => node.props['placeholder'] === 'Search notes')!;
  h.fabric.emit(search, 'topChangeText', { text: 'pasta' });
  h.clock.flushMicrotasks();
  assert.ok(h.text().includes('Weeknight pasta'));
  assert.ok(!h.text().includes('Grocery list'));
  h.fabric.emit(search, 'topChangeText', { text: 'flowers' });
  h.clock.flushMicrotasks();
  assert.ok(h.text().includes('No matching notes'));
  assert.ok(h.text().includes('Try a different search.'));
  h.fabric.emit(search, 'topChangeText', { text: '' });
  h.clock.flushMicrotasks();
  assert.ok(h.text().includes('Grocery list'));
  assert.deepEqual(h.errors, []);
});

test('a long press pins a note to the top, with a selection haptic', async (t) => {
  const h = bootNotes();
  t.after(() => h.root.dispose());
  await h.waitFor(() => h.navigation()?.url() === '/notes');
  h.finish();
  await h.waitFor(() => h.text().includes('Gift ideas'));
  assert.ok(h.text().indexOf('Gift ideas') > h.text().indexOf('Books to read'));
  await h.longPress('Gift ideas');
  await h.waitFor(() => h.text().indexOf('Gift ideas') < h.text().indexOf('Books to read'));
  assert.deepEqual(h.haptics, ['select']);
  assert.match(h.text(), /1 pending|Offline/);
  assert.deepEqual(h.errors, []);
});

test('opening a note edits it in place, and deleting asks first', async (t) => {
  const h = bootNotes({ answers: [false, true] });
  t.after(() => h.root.dispose());
  await h.waitFor(() => h.navigation()?.url() === '/notes');
  h.finish();
  await h.waitFor(() => h.text().includes('Standup notes'));
  h.press('Standup notes');
  await h.waitFor(() => h.navigation().url() === '/note/seed-standup');
  h.finish();
  await h.waitFor(() => !!h.byLabel('Title'));
  assert.equal(h.byLabel('Title')!.props['text'], 'Standup notes');
  assert.match(h.props(), /"title":"Note"/);
  h.press('Delete note');
  await h.waitFor(() => h.questions.length === 1);
  assert.equal(h.navigation().url(), '/note/seed-standup');
  h.press('Delete note');
  await h.waitFor(() => h.navigation().url() === '/notes');
  h.finish();
  assert.deepEqual(h.questions, ['Delete this note?', 'Delete this note?']);
  assert.deepEqual(h.haptics, ['notify:success']);
  await h.waitFor(() => !h.text().includes('Standup notes'));
  assert.deepEqual(h.errors, []);
});

test('the editor bar drops its home-indicator padding when the keyboard is up', async (t) => {
  const h = bootNotes();
  t.after(() => h.root.dispose());
  await h.waitFor(() => h.navigation()?.url() === '/notes');
  h.finish();
  assert.equal(await h.navigation().push('/note/new'), true);
  h.finish();
  await h.waitFor(() => h.text().includes('0 words'));
  const bar = () =>
    h
      .nodes()
      .find((node) =>
        node.children.some((text) => text.children.some((raw) => raw.props['text'] === '0 words')),
      )!;
  const padding = () => JSON.stringify(bar().props);
  // Clear of the home indicator through the provider's inset token, then flush on the keyboard.
  assert.match(padding(), /"paddingBottom":34\b/);
  h.keyboard(300);
  assert.match(padding(), /"paddingBottom":8\b/);
  h.keyboard(0);
  assert.match(padding(), /"paddingBottom":34\b/);
  assert.deepEqual(h.errors, []);
});

test('settings toggles sync, shows waiting writes, and clears local data after confirming', async (t) => {
  const h = bootNotes({
    network: ONLINE,
    api: new FakeNotesApi(SEED_NOTES, { latencyMs: 0 }),
    answers: [true],
  });
  t.after(() => h.root.dispose());
  await h.waitFor(() => h.navigation()?.url() === '/notes');
  h.finish();
  await h.waitFor(() => h.text().includes('Synced'));
  assert.equal(await h.navigation().push('/settings'), true, 'the settings link opens its tab');
  h.finish();
  await h.waitFor(() => h.navigation().url() === '/settings');
  assert.equal(await h.navigation().back(), true);
  h.finish();
  const tabs = h.navigation().current()!.children!;
  assert.equal(await tabs.selectTab('settings'), true);
  h.finish();
  await h.waitFor(() => h.text().includes('Last synced'));
  assert.ok(h.text().includes('Just now'));
  assert.equal(h.byLabel('Sync notes')!.props['value'], true);

  h.fabric.emit(h.byLabel('Sync notes')!, 'topChange', { value: false });
  h.clock.flushMicrotasks();
  assert.equal(h.byLabel('Sync notes')!.props['value'], false);

  assert.equal(await tabs.selectTab('notes'), true);
  h.finish();
  await h.waitFor(() => h.text().includes('Offline'));
  await h.longPress('Grocery list');
  assert.equal(await tabs.selectTab('settings'), true);
  h.finish();
  await h.waitFor(() => h.text().includes('1 note waiting to sync.'));

  const clear = h
    .nodes()
    .find(
      (node) =>
        node.instanceHandle.name === 'pressable' &&
        node.children.some((text) =>
          text.children.some((raw) => raw.props['text'] === 'Clear local data'),
        ),
    )!;
  const point = { identifier: 1, pageX: 1, pageY: 1 };
  h.fabric.emit(clear, 'topTouchStart', { ...point, changedTouches: [point], touches: [point] });
  h.fabric.emit(clear, 'topTouchEnd', { ...point, changedTouches: [point], touches: [] });
  await h.waitFor(() => h.text().includes('Never'));
  assert.deepEqual(h.questions, ['Clear local data?']);
  assert.ok(!h.text().includes('waiting to sync'));
  assert.equal(await tabs.selectTab('notes'), true);
  h.finish();
  await h.waitFor(() => h.text().includes('No notes yet'));
  assert.ok(h.text().includes('Tap + to write the first one.'));
  assert.deepEqual(h.errors, []);
});

test('pulling the list down fetches what the server has', async (t) => {
  const api = new FakeNotesApi([], { latencyMs: 0 });
  const h = bootNotes({ network: ONLINE, api });
  t.after(() => h.root.dispose());
  await h.waitFor(() => h.navigation()?.url() === '/notes');
  h.finish();
  await h.waitFor(() => h.text().includes('No notes yet'));
  await api.push({
    id: 'remote',
    title: 'From the server',
    body: 'Arrived on refresh.',
    pinned: false,
    updatedAt: Date.now(),
    deleted: false,
  });
  const refresh = h.nodes().find((node) => node.instanceHandle.name === 'refresh-control')!;
  assert.ok(refresh);
  h.fabric.emit(refresh, 'topRefresh');
  await h.waitFor(() => h.text().includes('From the server'));
  assert.equal(refresh.props['refreshing'] ?? false, false);
  assert.deepEqual(h.errors, []);
});
