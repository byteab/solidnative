import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService, LayoutAnimation } from '@solidnative/device/solid';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer, flatten } from './consumer-harness.ts';
import {
  lanes,
  minuteAt,
  monthGrid,
  type CalendarEvent,
} from '../src/app/calendar/calendar-model.solid.ts';
import { CARDS, columnAt, moveCard } from '../src/app/kanban/kanban-model.solid.ts';
import { NotesModel, shortcut, inline, wrapped } from '../src/app/notes/notes-model.solid.ts';
import { calendarRoutes } from '../src/app/calendar/routes.solid.ts';
import { kanbanRoutes } from '../src/app/kanban/routes.solid.ts';
import { collectionRoutes } from '../src/app/collections/routes.solid.ts';
import { noteRoutes } from '../src/app/notes/routes.solid.ts';
import { gestures, installRouteGestures, nativeMock } from './g12-routes-native-fixture.ts';
const removeHooks = installRouteGestures();
await import('../src/app/calendar/calendar-page.solid.tsx');
await import('../src/app/kanban/kanban-page.solid.tsx');
removeHooks();
const routes = [
  ...calendarRoutes,
  ...kanbanRoutes,
  ...collectionRoutes,
  ...noteRoutes,
  { path: 'cover', component: () => null },
];
function pressLabel(h: ReturnType<typeof bootConsumer>, label: string) {
  const node = h.nodes().find((node) => node.props['accessibilityLabel'] === label);
  assert.ok(node, label);
  for (const type of ['topTouchStart', 'topTouchEnd']) {
    const touch = { identifier: 1, pageX: 1, pageY: 1 };
    h.fabric.emit(node, type, {
      ...touch,
      changedTouches: [touch],
      touches: type === 'topTouchEnd' ? [] : [touch],
    });
  }
  h.clock.flushMicrotasks();
}
test('calendar model preserves Monday grids, snapping and overlap lanes', () => {
  const weeks = monthGrid(2026, 8);
  assert.equal(weeks[0]![0], '2026-08-31');
  assert.equal(weeks.at(-1)!.at(-1), '2026-10-04');
  assert.ok(weeks.every((week) => week.length === 7));
  assert.equal(monthGrid(2026, 5)[0]![0], '2026-06-01');
  assert.deepEqual([0, 160, 80, -50, 2560].map(minuteAt), [420, 570, 495, 420, 1320]);
  const event = (id: string, start: number, end: number): CalendarEvent => ({
    id,
    day: '2026-09-27',
    title: id,
    start,
    end,
    calendar: 'work',
  });
  const placed = lanes([event('a', 600, 690), event('b', 660, 720), event('c', 800, 860)]);
  assert.deepEqual(
    [...placed.values()],
    [
      { lane: 0, of: 2 },
      { lane: 1, of: 2 },
      { lane: 0, of: 1 },
    ],
  );
});
test('kanban model preserves order, empty columns and scroll geometry', () => {
  const ids = (cards: typeof CARDS, column: string) =>
    cards.filter((card) => card.column === column).map((card) => card.id);
  assert.deepEqual(ids(moveCard(CARDS, 'k1', 'review'), 'review'), ['k7', 'k8', 'k1']);
  assert.deepEqual(ids(moveCard(CARDS, 'k1', 'review', 1), 'review'), ['k7', 'k1', 'k8']);
  assert.deepEqual(ids(moveCard(CARDS, 'k6', 'doing', 0), 'doing'), ['k6', 'k4', 'k5']);
  assert.deepEqual(ids(moveCard(CARDS, 'k1', 'backlog'), 'backlog'), ['k2', 'k3', 'k1']);
  assert.deepEqual(
    ids(moveCard(moveCard(moveCard(CARDS, 'k9', 'doing'), 'k10', 'doing'), 'k1', 'done'), 'done'),
    ['k1'],
  );
  const layout = { inset: 16, width: 290, gap: 14 };
  assert.deepEqual(
    [
      [10, 0],
      [100, 0],
      [100, 304],
      [350, 0],
      [300, 2000],
    ].map(([x, scroll]) => columnAt(x!, scroll!, layout)),
    [null, 'backlog', 'doing', 'doing', 'done'],
  );
});
test('note model preserves shortcuts, nested inline marks, selection and list continuation', () => {
  assert.deepEqual(
    ['# Plans', '- milk', '[] eggs', '[x] bread', '> said so', '#hashtag'].map(shortcut),
    [
      { kind: 'heading', text: 'Plans' },
      { kind: 'bullet', text: 'milk' },
      { kind: 'check', text: 'eggs' },
      { kind: 'check', text: 'bread', done: true },
      { kind: 'quote', text: 'said so' },
      null,
    ],
  );
  assert.deepEqual(inline('a **b *c* d** e'), [
    { text: 'a ' },
    { text: 'b ', bold: true },
    { text: 'c', bold: true, italic: true },
    { text: ' d', bold: true },
    { text: ' e' },
  ]);
  assert.deepEqual(inline('`*not italic*`'), [{ text: '*not italic*', code: true }]);
  assert.deepEqual(inline('2 * 3 = 6'), [{ text: '2 * 3 = 6' }]);
  assert.deepEqual(inline('~~gone~~'), [{ text: 'gone', strike: true }]);
  assert.deepEqual(wrapped('make this loud', { start: 10, end: 14 }, '**'), {
    text: 'make this **loud**',
    caret: 18,
  });
  assert.deepEqual(wrapped('ab', { start: 1, end: 1 }, '*'), { text: 'a**b', caret: 2 });
  const model = new NotesModel(),
    note = model.create();
  assert.equal(note.blocks.length, 1);
  model.remove(note.id, note.blocks[0]!.id);
  assert.equal(model.get(note.id)!.blocks.length, 1);
});
for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} calendar routes select/add/delete/draw events and suspend covered gestures`, async (t) => {
    const fixture = consumerFixture(() => routes),
      h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/calendar');
    h.finish();
    const labels = () => h.nodes().map((node) => String(node.props['accessibilityLabel'] ?? ''));
    assert.ok(labels().some((label) => label.endsWith(', 1 event')));
    assert.ok(labels().some((label) => label.endsWith(', 0 events')));
    const tomorrow = labels().find((label) => label.endsWith(', 2 events'))!;
    pressLabel(h, tomorrow);
    assert.ok(labels().includes('Planning, 14:00 to 15:30'));
    pressLabel(h, 'Add event at 10:00');
    assert.ok(labels().includes('New event, 10:00 to 11:00'));
    const drawing = gestures('Pan')[0]!;
    drawing.callbacks['start']!({ y: 384 });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /13:00 to 13:30/);
    drawing.callbacks['update']!({ y: 480 });
    drawing.callbacks['end']!();
    drawing.callbacks['finalize']!();
    h.clock.flushMicrotasks();
    assert.ok(labels().includes('New event, 13:00 to 14:30'));
    const event = h
      .nodes()
      .find((node) => node.props['accessibilityLabel'] === 'New event, 13:00 to 14:30')!;
    h.fabric.emit(event, 'topAccessibilityAction', { actionName: 'delete' });
    h.clock.flushMicrotasks();
    assert.ok(!labels().includes('New event, 13:00 to 14:30'));
    pressLabel(h, 'Next month');
    const now = new Date();
    assert.match(
      h.renderedText(),
      new RegExp(
        new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
          new Date(now.getFullYear(), now.getMonth() + 1, 1),
        ),
      ),
    );
    await nav.push('/cover');
    h.finish();
    assert.equal(nativeMock.gestures.size, 0);
    drawing.callbacks['start']!({ y: 0 });
    drawing.callbacks['end']!();
    await nav.back();
    h.finish();
    drawing.callbacks['start']!({ y: 0 });
    drawing.callbacks['end']!();
    h.clock.flushMicrotasks();
    assert.ok(!labels().includes('New event, 07:00 to 07:30'));
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} kanban routes move by tap, drag, accessibility and cancel a covered lift`, async (t) => {
    const fixture = consumerFixture(() => routes),
      h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/kanban');
    h.finish();
    const card = (title: string) =>
      h
        .nodes()
        .find((node) => String(node.props['accessibilityLabel'] ?? '').startsWith(`${title},`))!;
    gestures('Tap', card('Onboarding illustrations').tag)[0]!.callbacks['end']!();
    h.clock.flushMicrotasks();
    assert.ok(!h.nodes().some((node) => node.props['accessibilityLabel'] === 'Move to Backlog'));
    pressLabel(h, 'Move to Review');
    assert.ok(h.nodes().some((node) => node.props['accessibilityLabel'] === 'Review, 3 cards'));
    const pan = gestures('Pan', card('Crash when a photo is huge').tag)[0]!;
    const at = (x: number) => ({ absoluteX: x, absoluteY: 400, x: 20, y: 20 });
    pan.callbacks['start']!(at(350));
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /2 pt, Tom/);
    pan.callbacks['update']!(at(660));
    pan.callbacks['end']!(at(660));
    pan.callbacks['finalize']!();
    h.clock.flushMicrotasks();
    assert.ok(h.nodes().some((node) => node.props['accessibilityLabel'] === 'Review, 4 cards'));
    assert.doesNotMatch(h.renderedText(), /2 pt, Tom/);
    h.fabric.emit(card('Pricing page copy'), 'topAccessibilityAction', { actionName: 'activate' });
    h.clock.flushMicrotasks();
    pressLabel(h, 'Move to Backlog');
    assert.ok(h.nodes().some((node) => node.props['accessibilityLabel'] === 'Done, 1 cards'));
    const another = gestures('Pan', card('Offline sync for drafts').tag)[0]!;
    another.callbacks['start']!(at(100));
    await nav.push('/cover');
    h.finish();
    assert.equal(nativeMock.gestures.size, 0);
    another.callbacks['end']!(at(660));
    await nav.back();
    h.finish();
    another.callbacks['start']!(at(100));
    another.callbacks['end']!(at(660));
    another.callbacks['finalize']!();
    h.clock.flushMicrotasks();
    assert.doesNotMatch(h.renderedText(), /8 pt, Kofi/);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} queue retains keyed native rows through edits, ordering and filtering`, async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const configured: object[] = [];
    const fixture = consumerFixture(
      () => routes,
      [
        provideService(LayoutAnimation.SOURCE, () => ({
          configureNext(config, done) {
            configured.push(config);
            done?.();
          },
        })),
      ],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/queue');
    h.finish();
    const scroll = h.nodes().find((node) => node.instanceHandle.name === 'scroll-view')!;
    h.fabric.emit(scroll, 'topLayout', { layout: { width: 402, height: 900 } });
    h.clock.flushMicrotasks();
    const rows = () =>
      h.nodes().filter((node) => String(node.props['nativeID'] ?? '').startsWith('row-k'));
    const text = (node: ReturnType<typeof rows>[number]) =>
      flatten([node])
        .map((child) => child.props['text'] ?? '')
        .join('');
    assert.ok(rows().length);
    const first = rows()[0]!,
      second = rows()[1]!;
    const title = (node: ReturnType<typeof rows>[number]) =>
      String(flatten([node]).find((child) => child.props['text'])!.props['text']);
    pressLabel(h, `Move up ${title(second)}`);
    assert.equal(rows()[0]!.props['nativeID'], second.props['nativeID']);
    pressLabel(h, `Move ${title(first)} to the other section`);
    assert.match(h.renderedText(), /Up next \(11\)/);
    assert.match(h.renderedText(), /Later \(49\)/);
    const moved = rows().find((row) => row.props['nativeID'] === first.props['nativeID']);
    if (moved) assert.equal(moved.tag, first.tag);
    let before = new Map(rows().map((node) => [node.props['nativeID'], node.tag]));
    for (const action of ['Sort', 'Shuffle', 'Reverse']) {
      h.press(action);
      for (const row of rows())
        if (before.has(row.props['nativeID']))
          assert.equal(row.tag, before.get(row.props['nativeID']));
      before = new Map(rows().map((node) => [node.props['nativeID'], node.tag]));
    }
    h.press('Insert 3');
    h.press('Delete 10');
    assert.equal(configured.length, 7);
    h.input('Filter', 'naima');
    assert.ok(rows().every((row) => text(row).includes('Naima')));
    h.input('Filter', '', 2);
    assert.ok(rows().length);
    const beforeBurst = configured.length;
    h.press('Burst');
    t.mock.timers.tick(2000);
    h.clock.flushMicrotasks();
    assert.equal(configured.length, beforeBurst + 40);
    t.mock.timers.tick(1000);
    assert.equal(configured.length, beforeBurst + 40);
    assert.equal(new Set(rows().map((row) => row.props['nativeID'])).size, rows().length);
    h.press('Burst');
    t.mock.timers.tick(50);
    await nav.push('/cover');
    h.finish();
    const covered = configured.length;
    t.mock.timers.tick(2000);
    assert.equal(configured.length, covered);
    assert.deepEqual(fixture.errors, []);
  });
  test(`actual ${platform} note editor keeps native input identity through shortcuts and formatting`, async (t) => {
    const fixture = consumerFixture(() => routes),
      h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/notes');
    h.finish();
    pressLabel(h, 'New note');
    await h.waitFor(() => h.nodes().some((node) => node.props['accessibilityLabel'] === 'Title'));
    h.finish();
    h.input('Title', 'Groceries');
    const field = () =>
      h.nodes().find((node) => node.props['accessibilityLabel'] === 'Paragraph 1')!;
    const original = field();
    h.input('Paragraph 1', 'hello world');
    assert.equal(field().tag, original.tag);
    h.fabric.emit(field(), 'topFocus');
    h.fabric.emit(field(), 'topSelectionChange', { selection: { start: 6, end: 11 } });
    pressLabel(h, 'Bold');
    assert.equal(field().props['text'], 'hello **world**');
    pressLabel(h, 'Heading');
    const heading = h.nodes().find((node) => node.props['accessibilityLabel'] === 'Heading 1')!;
    assert.equal(heading.tag, original.tag);
    h.fabric.emit(heading, 'topSubmitEditing');
    h.clock.flushMicrotasks();
    assert.ok(h.nodes().some((node) => node.props['accessibilityLabel'] === 'Paragraph 2'));
    h.input('Paragraph 2', '[] milk');
    const check = h.nodes().find((node) => node.props['accessibilityLabel'] === 'Checklist 2')!;
    h.fabric.emit(check, 'topSubmitEditing');
    h.clock.flushMicrotasks();
    const last = h.nodes().find((node) => node.props['accessibilityLabel'] === 'Checklist 3')!;
    h.fabric.emit(last, 'topSubmitEditing');
    h.clock.flushMicrotasks();
    const empty = h.nodes().find((node) => node.props['accessibilityLabel'] === 'Paragraph 3')!;
    h.fabric.emit(empty, 'topKeyPress', { key: 'Backspace' });
    h.clock.flushMicrotasks();
    assert.ok(!h.nodes().some((node) => node.props['accessibilityLabel'] === 'Paragraph 3'));
    pressLabel(h, 'Done');
    assert.match(h.renderedText(), /Groceries/);
    assert.match(h.renderedText(), /hello world/);
    await nav.back();
    h.finish();
    assert.match(h.renderedText(), /Groceries/);
    assert.deepEqual(fixture.errors, []);
  });
}
