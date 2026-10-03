import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { provideService, ServiceScope, useService } from '@solidnative/device/solid';
import { Database, type SQLiteDatabase } from '@solidnative/expo/solid/database';
import {
  calendarGrid,
  completionRate,
  currentStreak,
  Habits,
  isoDate,
  toggleCompletion,
} from '../src/app/data/habits.solid.ts';

test('a date is local, not UTC', () => {
  assert.equal(isoDate(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(isoDate(new Date(2026, 8, 25)), '2026-09-25');
});

test('toggling adds or removes one date, without touching the set passed in', () => {
  const days = new Set(['2026-09-01']);
  const added = toggleCompletion(days, '2026-09-02');
  assert.deepEqual([...added].sort(), ['2026-09-01', '2026-09-02']);
  assert.equal(days.has('2026-09-02'), false);
  const removed = toggleCompletion(added, '2026-09-01');
  assert.deepEqual([...removed], ['2026-09-02']);
});

test('a streak counts consecutive days ending today', () => {
  const today = new Date(2026, 8, 25);
  const days = new Set(['2026-09-25', '2026-09-24', '2026-09-23', '2026-09-20']);
  assert.equal(currentStreak(days, today), 3);
});

test('a streak still counts if today has not been done yet, up to yesterday', () => {
  assert.equal(currentStreak(new Set(['2026-09-24', '2026-09-23']), new Date(2026, 8, 25)), 2);
});

test('a streak is broken by a day missed entirely, not just today', () => {
  const today = new Date(2026, 8, 25);
  assert.equal(currentStreak(new Set(['2026-09-22']), today), 0);
  assert.equal(currentStreak(new Set(), today), 0);
});

test('completion rate is the fraction of habits done, and zero with no habits at all', () => {
  assert.ok(Math.abs(completionRate(4, 3) - 0.75) < 1e-9);
  assert.equal(completionRate(0, 0), 0);
});

test('the calendar grid is one entry per day, oldest first, with today marked', () => {
  const grid = calendarGrid(new Set(['2026-09-25', '2026-09-24']), 2, new Date(2026, 8, 25));
  assert.equal(grid.length, 14);
  assert.equal(grid[0]!.date, '2026-09-12');
  assert.deepEqual(grid.at(-1), { date: '2026-09-25', done: true, today: true });
  assert.deepEqual(grid.at(-2), { date: '2026-09-24', done: true, today: false });
  assert.deepEqual(grid.at(-3), { date: '2026-09-23', done: false, today: false });
});

/** The slice of expo-sqlite the service reaches, recording every statement. */
export function fakeSqlite(rows: { habit?: unknown[]; completion?: unknown[] } = {}) {
  const calls: unknown[][] = [];
  let closed = 0;
  const db = {
    getFirstAsync: async (sql: string) =>
      sql.includes('user_version') ? { user_version: 0 } : null,
    execAsync: async (sql: string) =>
      void calls.push(['exec', sql.trim().split(/\s+/).slice(0, 3).join(' ')]),
    withTransactionAsync: async (task: () => Promise<void>) => task(),
    runAsync: async (sql: string, ...params: unknown[]) => {
      calls.push(['run', sql.trim().split(/\s+/)[0], ...params]);
      return { lastInsertRowId: 0, changes: 1 };
    },
    getAllAsync: async (sql: string) =>
      (sql.includes('FROM habit') ? rows.habit : rows.completion) ?? [],
    closeAsync: async () => void closed++,
  };
  return { db: db as unknown as SQLiteDatabase, calls, closed: () => closed };
}

function withService(open: SQLiteDatabase | (() => Promise<SQLiteDatabase>)) {
  return createRoot((dispose) => {
    let habits!: Habits;
    ServiceScope({
      services: [
        provideService(Database.SOURCE, () => ({
          open: typeof open === 'function' ? open : async () => open,
        })),
      ],
      get children() {
        habits = useService(Habits);
        return undefined;
      },
    });
    return { habits, dispose };
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test('a first launch migrates the database and writes the seed through to it', async () => {
  const sqlite = fakeSqlite();
  const { habits, dispose } = withService(sqlite.db);
  await tick();
  assert.deepEqual(sqlite.calls[0], ['exec', 'CREATE TABLE habit']);
  const inserts = sqlite.calls.filter(([, kind]) => kind === 'INSERT');
  // Four habit rows (five values each), then every seeded completion (two values each).
  assert.deepEqual(
    inserts.filter((call) => call.length === 7).map((call) => call[2]),
    ['seed-water', 'seed-read', 'seed-exercise', 'seed-meditate'],
  );
  assert.ok(inserts.filter((call) => call.length === 4).length > 30);
  assert.equal(habits.habits().length, 4);
  dispose();
  await tick();
  assert.equal(sqlite.closed(), 1);
});

test('a later launch reads habits and completions back from disk', async () => {
  const today = isoDate(new Date());
  const sqlite = fakeSqlite({
    habit: [{ id: 'h1', name: 'Walk', colour: '#22c55e', reminder_time: null, created_at: today }],
    completion: [{ habit_id: 'h1', date: today }],
  });
  const { habits, dispose } = withService(sqlite.db);
  await tick();
  assert.deepEqual(
    habits.habits().map((habit) => habit.name),
    ['Walk'],
  );
  assert.equal(habits.isDone('h1'), true);
  assert.equal(habits.streak('h1'), 1);
  assert.equal(habits.todayRate(), 1);
  dispose();
});

test('writes update the signals at once and persist in the background', async () => {
  const sqlite = fakeSqlite();
  const { habits, dispose } = withService(sqlite.db);
  await tick();
  sqlite.calls.length = 0;
  const created = habits.create({ name: '  Stretch ', colour: '#0ea5e9', reminderTime: '07:00' });
  assert.equal(created.name, 'Stretch');
  assert.equal(habits.nameTaken('stretch'), true);
  assert.equal(habits.nameTaken('Stretch', created.id), false);
  habits.toggleToday(created.id);
  assert.equal(habits.isDone(created.id), true);
  habits.update(created.id, { name: 'Yoga', colour: '#8b5cf6', reminderTime: null });
  assert.equal(habits.find(created.id)?.name, 'Yoga');
  habits.remove(created.id);
  assert.equal(habits.find(created.id), undefined);
  assert.equal(habits.completions(created.id).size, 0);
  await tick();
  assert.deepEqual(
    sqlite.calls.map(([, kind]) => kind),
    ['INSERT', 'INSERT', 'INSERT', 'DELETE', 'DELETE'],
  );
  dispose();
});

test('with no database the in-memory seed stands in, and writes still land', async () => {
  const { habits, dispose } = withService(() => Promise.reject(new Error('no expo-sqlite')));
  await tick();
  assert.equal(habits.habits().length, 4);
  assert.equal(habits.isDone('seed-exercise'), false);
  habits.toggleToday('seed-exercise');
  assert.equal(habits.isDone('seed-exercise'), true);
  await tick();
  dispose();
});
