import { createMemo, createSignal } from 'solid-js';
import { createServiceToken } from '@solidnative/device/solid';
import { database, type Migration, type SQLiteDatabase } from '@solidnative/expo/solid/database';

export interface Habit {
  readonly id: string;
  readonly name: string;
  readonly colour: string;
  /** `HH:mm`, or `null` for no daily reminder. */
  readonly reminderTime: string | null;
  readonly createdAt: string;
}

export type HabitChanges = Pick<Habit, 'name' | 'colour' | 'reminderTime'>;

/** One day as `YYYY-MM-DD`, in local time - never UTC, or a completion made at 11pm lands on the wrong day. */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Adds or removes one date from a set of completions, without touching the set passed in. */
export function toggleCompletion(days: ReadonlySet<string>, date: string): ReadonlySet<string> {
  const next = new Set(days);
  if (next.has(date)) next.delete(date);
  else next.add(date);
  return next;
}

/**
 * The days in a row a habit has been done, counting back from today. A habit not yet done today
 * still has yesterday's streak - it is only broken once a whole day passes with nothing logged.
 */
export function currentStreak(days: ReadonlySet<string>, today = new Date()): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(isoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(isoDate(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(isoDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** The fraction of habits done on a given day, for the progress ring. */
export function completionRate(total: number, done: number): number {
  return total === 0 ? 0 : done / total;
}

export interface GridDay {
  readonly date: string;
  readonly done: boolean;
  readonly today: boolean;
}

/**
 * `weeks * 7` days ending today, oldest first, for the calendar grid on the habit detail screen.
 * Not aligned to Sunday - the point is a quick read of "most days", not a real calendar.
 */
export function calendarGrid(
  days: ReadonlySet<string>,
  weeks: number,
  today = new Date(),
): readonly GridDay[] {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const total = weeks * 7;
  const grid: GridDay[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const date = new Date(end);
    date.setDate(date.getDate() - i);
    const iso = isoDate(date);
    grid.push({ date: iso, done: days.has(iso), today: i === 0 });
  }
  return grid;
}

export const PALETTE: readonly string[] = [
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#0ea5e9',
  '#8b5cf6',
];

/** A habit's fixed details, and one row per day it was done. */
export const HABITS_MIGRATIONS: readonly Migration[] = [
  {
    to: 1,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE habit (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          colour TEXT NOT NULL,
          reminder_time TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE completion (
          habit_id TEXT NOT NULL,
          date TEXT NOT NULL,
          PRIMARY KEY (habit_id, date)
        );
      `),
  },
];

interface HabitRow {
  id: string;
  name: string;
  colour: string;
  reminder_time: string | null;
  created_at: string;
}

function persistHabit(db: SQLiteDatabase, habit: Habit) {
  return db.runAsync(
    `INSERT INTO habit (id, name, colour, reminder_time, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, colour = excluded.colour,
       reminder_time = excluded.reminder_time`,
    habit.id,
    habit.name,
    habit.colour,
    habit.reminderTime,
    habit.createdAt,
  );
}

/**
 * Every habit, and which days each one was done.
 *
 * Backed by SQLite, written through best-effort: a write updates the signals first so the UI never
 * waits on disk, then persists in the background. With no `expo-sqlite` module - Node under the
 * tests - persistence quietly does nothing and the in-memory seed stands in for it. The database
 * belongs to this service's owner and closes with it.
 */
export function createHabits() {
  const db = database('habits.db', HABITS_MIGRATIONS);
  const [all, setAll] = createSignal<readonly Habit[]>(seedHabits());
  const [done, setDone] = createSignal<ReadonlyMap<string, ReadonlySet<string>>>(seedCompletions());
  const write = (task: (db: SQLiteDatabase) => Promise<unknown>) => {
    void db
      .ready()
      .then(task)
      .catch(() => {});
  };

  const find = (id: string) => all().find((habit) => habit.id === id);
  const completions = (id: string): ReadonlySet<string> => done().get(id) ?? new Set();
  const isDone = (id: string, date = new Date()) => completions(id).has(isoDate(date));

  async function load(): Promise<void> {
    const ready = await db.ready();
    const rows = await ready.getAllAsync<HabitRow>('SELECT * FROM habit ORDER BY created_at');
    if (rows.length === 0) {
      // First launch: persist the seed data so the next launch reads it back from disk too.
      await ready.withTransactionAsync(async () => {
        for (const habit of all()) await persistHabit(ready, habit);
        for (const [habitId, dates] of done())
          for (const date of dates)
            await ready.runAsync(
              'INSERT OR IGNORE INTO completion (habit_id, date) VALUES (?, ?)',
              habitId,
              date,
            );
      });
      return;
    }
    const rowsDone = await ready.getAllAsync<{ habit_id: string; date: string }>(
      'SELECT habit_id, date FROM completion',
    );
    const grouped = new Map<string, Set<string>>();
    for (const row of rowsDone)
      grouped.set(row.habit_id, (grouped.get(row.habit_id) ?? new Set()).add(row.date));
    setAll(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        colour: row.colour,
        reminderTime: row.reminder_time,
        createdAt: row.created_at,
      })),
    );
    setDone(grouped);
  }
  // The in-memory seed already stands in for a missing database.
  load().catch(() => {});

  return {
    habits: all,
    palette: PALETTE,
    find,
    completions,
    isDone,
    streak: (id: string, today = new Date()) => currentStreak(completions(id), today),
    todayRate: createMemo(() => {
      const today = isoDate(new Date());
      return completionRate(all().length, all().filter((h) => done().get(h.id)?.has(today)).length);
    }),
    nameTaken(name: string, exceptId?: string): boolean {
      const clean = name.trim().toLowerCase();
      return all().some((h) => h.id !== exceptId && h.name.trim().toLowerCase() === clean);
    },
    toggleToday(id: string, date = new Date()): void {
      const iso = isoDate(date);
      const next = new Map(done());
      next.set(id, toggleCompletion(next.get(id) ?? new Set(), iso));
      setDone(next);
      const nowDone = isDone(id, date);
      write((ready) =>
        nowDone
          ? ready.runAsync(
              'INSERT OR IGNORE INTO completion (habit_id, date) VALUES (?, ?)',
              id,
              iso,
            )
          : ready.runAsync('DELETE FROM completion WHERE habit_id = ? AND date = ?', id, iso),
      );
    },
    create(habit: HabitChanges): Habit {
      const created: Habit = {
        id: `h${Date.now().toString(36)}${Math.floor(Math.random() * 1_000).toString(36)}`,
        name: habit.name.trim(),
        colour: habit.colour,
        reminderTime: habit.reminderTime,
        createdAt: isoDate(new Date()),
      };
      setAll((list) => [...list, created]);
      write((ready) => persistHabit(ready, created));
      return created;
    },
    update(id: string, changes: HabitChanges): void {
      setAll((list) =>
        list.map((h) => (h.id === id ? { ...h, ...changes, name: changes.name.trim() } : h)),
      );
      const updated = find(id);
      if (updated) write((ready) => persistHabit(ready, updated));
    },
    remove(id: string): void {
      setAll((list) => list.filter((h) => h.id !== id));
      const next = new Map(done());
      next.delete(id);
      setDone(next);
      write((ready) =>
        ready.withTransactionAsync(async () => {
          await ready.runAsync('DELETE FROM habit WHERE id = ?', id);
          await ready.runAsync('DELETE FROM completion WHERE habit_id = ?', id);
        }),
      );
    },
  };
}
export type Habits = ReturnType<typeof createHabits>;
export const Habits = createServiceToken<Habits>('habits.habits', createHabits);

/** A handful of habits with a colour each, so a first launch has something to pick from. */
function seedHabits(): Habit[] {
  return [
    {
      id: 'seed-water',
      name: 'Drink water',
      colour: PALETTE[4]!,
      reminderTime: '09:00',
      createdAt: isoDate(daysAgo(60)),
    },
    {
      id: 'seed-read',
      name: 'Read',
      colour: PALETTE[3]!,
      reminderTime: '21:00',
      createdAt: isoDate(daysAgo(60)),
    },
    {
      id: 'seed-exercise',
      name: 'Exercise',
      colour: PALETTE[0]!,
      reminderTime: '07:00',
      createdAt: isoDate(daysAgo(45)),
    },
    {
      id: 'seed-meditate',
      name: 'Meditate',
      colour: PALETTE[5]!,
      reminderTime: null,
      createdAt: isoDate(daysAgo(30)),
    },
  ];
}

function daysAgo(n: number, today = new Date()): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
}

/**
 * A deterministic pattern of history for each seed habit, going back 60 days, so streaks and the
 * calendar grid look alive from the first launch rather than empty.
 */
function seedCompletions(): Map<string, Set<string>> {
  const today = new Date();
  const patterns: Record<string, (day: number) => boolean> = {
    // Done every day for the last nine, then a realistic gap further back.
    'seed-water': (day) => day < 9 || day % 3 !== 0,
    'seed-read': (day) => day < 5 || day % 2 === 0,
    // Not yet done today, but a six-day streak on the line - a good habit to check off for real.
    'seed-exercise': (day) => day > 0 && (day < 7 || day % 2 === 0),
    'seed-meditate': (day) => day < 14 && day % 4 !== 3,
  };
  const map = new Map<string, Set<string>>();
  for (const [id, isDoneOn] of Object.entries(patterns)) {
    const set = new Set<string>();
    for (let day = 0; day < 60; day++) {
      if (isDoneOn(day)) set.add(isoDate(daysAgo(day, today)));
    }
    map.set(id, set);
  }
  return map;
}
