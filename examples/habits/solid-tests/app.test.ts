import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootHabits, stateOf, type BootOptions } from './habits-harness.ts';

async function start(t: { after(fn: () => void): void }, options: BootOptions = {}) {
  const h = bootHabits(options);
  t.after(() => h.root.dispose());
  await h.settle();
  return h;
}

const checked = (h: ReturnType<typeof bootHabits>, name: string) =>
  stateOf(h.one(name, 'checkbox')).checked;

for (const platform of ['ios', 'android'] as const) {
  test(`${platform}: Today opens in the tab bar with its header, progress and checklist`, async (t) => {
    const h = await start(t, { platform });
    const nav = h.navigation();
    assert.equal(nav.url(), '/today');
    const text = h.renderedText();
    for (const part of ['Today', '3 of 4', 'Drink water', '9 days', 'Exercise', '6 days'])
      assert.ok(text.includes(part), part);
    // The root carries the platform class the Tailwind ios:/android: variants match against.
    // `createNativeRoot` puts it on the surface root, the parent of everything the app commits.
    const surface = h.root.engine.root;
    assert.ok(surface.classes?.has(`platform-${platform}`));
    assert.ok(h.nodes().some((node) => node.instanceHandle.parent === surface));
    // Both tabs, by SF Symbol, in a real native tab bar.
    const props = JSON.stringify(h.nodes().map((node) => node.props));
    assert.ok(props.includes('checkmark.circle.fill') || platform === 'android');
    assert.ok(h.nodes().some((node) => node.props['title'] === 'Settings'));
    assert.ok(h.nodes().some((node) => node.props['largeTitle'] === true));
    // The progress fill is the share done: three of four.
    assert.ok(h.nodes().some((node) => node.props['width'] === '75%'));
    assert.deepEqual(h.errors, []);
  });
}

test('checks a habit off, and its streak grows', async (t) => {
  const h = await start(t);
  assert.equal(checked(h, 'Exercise'), false);
  h.press('Exercise', 'checkbox');
  assert.equal(checked(h, 'Exercise'), true);
  assert.ok(h.renderedText().includes('7 days'));
  assert.ok(h.renderedText().includes('4 of 4'));
  await h.settle();
  assert.deepEqual(h.haptics, ['notify:success']);
});

test('unchecking a habit undoes it', async (t) => {
  const h = await start(t);
  assert.equal(checked(h, 'Drink water'), true);
  h.press('Drink water', 'checkbox');
  assert.equal(checked(h, 'Drink water'), false);
  await h.settle();
  assert.deepEqual(h.haptics, ['notify:warning']);
});

test('a long press on the row checks it off as well', async (t) => {
  const h = await start(t);
  const row = h.one('Exercise', 'button');
  h.fabric.emit(row, 'topTouchStart', {
    identifier: 1,
    pageX: 1,
    pageY: 1,
    changedTouches: [{ identifier: 1, pageX: 1, pageY: 1 }],
    touches: [{ identifier: 1, pageX: 1, pageY: 1 }],
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  h.clock.flushMicrotasks();
  h.fabric.emit(row, 'topTouchEnd', {
    identifier: 1,
    pageX: 1,
    pageY: 1,
    changedTouches: [{ identifier: 1, pageX: 1, pageY: 1 }],
    touches: [],
  });
  h.clock.flushMicrotasks();
  assert.equal(checked(h, 'Exercise'), true);
  assert.equal(h.navigation().url(), '/today');
});

test('creates a habit through the form, and it shows up on Today', async (t) => {
  const h = await start(t);
  h.press('New habit');
  await h.waitFor(() => h.byLabel('Habit name').length > 0);
  assert.equal(h.navigation().url(), '/habit/new');
  assert.ok(h.renderedText().includes('New habit'));
  h.type('Habit name', 'Stretch');
  h.press('Colour #0ea5e9');
  assert.equal(stateOf(h.one('Colour #0ea5e9')).selected, true);
  h.press('Save');
  await h.waitFor(() => h.navigation().url() === '/today');
  await h.settle();
  assert.ok(h.renderedText().includes('Stretch'));
  assert.equal(checked(h, 'Stretch'), false);
  assert.ok(h.haptics.includes('select'));
  assert.ok(h.haptics.includes('notify:success'));
});

test('a habit needs a name, and two habits cannot share one', async (t) => {
  const h = await start(t);
  h.press('New habit');
  await h.waitFor(() => h.byLabel('Habit name').length > 0);
  const save = () =>
    h
      .nodes()
      .filter(
        (node) => node.instanceHandle.name === 'pressable' && node.props['accessibilityState'],
      );
  assert.ok(save().some((node) => stateOf(node).disabled === true));
  h.press('Save');
  await h.settle();
  assert.equal(h.navigation().url(), '/habit/new');
  assert.ok(h.haptics.includes('notify:error'));
  h.type('Habit name', 'Exercise');
  assert.ok(h.renderedText().includes('Already tracking a habit with this name'));
  h.type('Habit name', '');
  assert.ok(h.renderedText().includes('Give it a name'));
});

test('a daily reminder offers its times only when switched on', async (t) => {
  const h = await start(t);
  h.press('New habit');
  await h.waitFor(() => h.byLabel('Habit name').length > 0);
  assert.ok(!h.renderedText().includes('21:00'));
  h.toggle('Daily reminder', true);
  assert.ok(h.renderedText().includes('21:00'));
  h.press('21:00');
  h.type('Habit name', 'Journal');
  h.press('Save');
  await h.waitFor(() => h.navigation().url() === '/today');
  await h.settle();
  h.press('Journal', 'button');
  await h.waitFor(() => h.renderedText().includes('Last 10 weeks'));
  h.press('Edit habit');
  await h.waitFor(() => h.renderedText().includes('Edit habit'));
  assert.ok(h.renderedText().includes('21:00'));
  assert.ok(
    h
      .nodes()
      .some(
        (node) =>
          node.props['accessibilityLabel'] === 'Daily reminder' && node.props['value'] === true,
      ),
  );
});

test('opening a habit shows its streak, and back returns to Today', async (t) => {
  const h = await start(t);
  h.press('Read', 'button');
  await h.waitFor(() => h.renderedText().includes('Last 10 weeks'));
  assert.equal(h.navigation().url(), '/habit/seed-read');
  assert.ok(h.nodes().some((node) => node.props['title'] === 'Read'));
  assert.ok(h.renderedText().includes('days in a row'));
  // Seventy days, today marked.
  assert.equal(h.nodes().filter((node) => node.instanceHandle.classes?.has('cell')).length, 70);
  assert.equal(h.nodes().filter((node) => node.instanceHandle.classes?.has('today')).length, 1);
  await h.navigation().back();
  await h.settle();
  assert.equal(h.navigation().url(), '/today');
  assert.ok(h.one('Read', 'checkbox'));
});

test('editing a habit renames it everywhere', async (t) => {
  const h = await start(t);
  h.press('Read', 'button');
  await h.waitFor(() => h.renderedText().includes('Last 10 weeks'));
  h.press('Edit habit');
  await h.waitFor(() => h.byLabel('Habit name').length > 0);
  assert.equal(h.navigation().url(), '/habit/seed-read/edit');
  assert.equal(h.one('Habit name').props['text'], 'Read');
  h.type('Habit name', 'Read a book');
  h.press('Save');
  await h.waitFor(() => h.navigation().url() === '/habit/seed-read');
  await h.settle();
  assert.ok(h.nodes().some((node) => node.props['title'] === 'Read a book'));
});

test('deleting a habit asks first, then leaves Today without it', async (t) => {
  const h = await start(t);
  h.press('Meditate', 'button');
  await h.waitFor(() => h.renderedText().includes('Delete habit'));
  h.press('Delete habit');
  await h.waitFor(() => h.navigation().url() === '/today');
  await h.settle();
  assert.deepEqual(h.alerts, ['Delete "Meditate"?']);
  assert.equal(h.byLabel('Meditate', 'checkbox').length, 0);
  assert.ok(h.renderedText().includes('2 of 3'));
});

test('a refused delete keeps the habit', async (t) => {
  const h = await start(t, { confirm: false });
  h.press('Meditate', 'button');
  await h.waitFor(() => h.renderedText().includes('Delete habit'));
  h.press('Delete habit');
  await h.settle();
  assert.equal(h.navigation().url(), '/habit/seed-meditate');
});

test('a habit that no longer exists says so', async (t) => {
  const h = await start(t);
  await h.navigation().push('/habit/gone');
  await h.settle();
  assert.ok(h.renderedText().includes('This habit no longer exists.'));
  assert.ok(h.nodes().some((node) => node.props['title'] === 'Habit'));
});

test('header icons follow the colour scheme', async (t) => {
  const dark = await start(t, { scheme: 'dark' });
  assert.ok(JSON.stringify(dark.nodes().map((node) => node.props)).includes('#fafafa'));
});
