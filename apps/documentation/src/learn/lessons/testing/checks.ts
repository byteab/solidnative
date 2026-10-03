/**
 * The checks for the testing lesson run the learner's own tests against stand-ins for their
 * components: one that works, and one that is wrong in a single way. A test earns its place by
 * passing against the first and failing against the second.
 *
 * Each stand-in is the whole tracker, the learner's own `NewHabit` included, so a test about
 * something else, such as the form, passes against both and proves nothing here. The rows are
 * drawn inline rather than with `HabitRow`, so a broken `HabitRow` breaks only the tests that
 * render it on its own.
 *
 * This file is not `.tsx`, so the stand-ins are written with `h`, which is what JSX compiles to.
 */
import { createComponent, createSignal, type JSX } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { For } from '@solidnative/platform/solid';
import { expect } from 'vitest';
import { check, type CheckContext, type TestOutcome } from '../../check.ts';
import { NewHabit } from './solution/new-habit.tsx';

interface Habit {
  readonly id: string;
  readonly name: string;
  readonly done: boolean;
}

const HABITS: readonly Habit[] = [
  { id: 'water', name: 'Drink water', done: false },
  { id: 'read', name: 'Read ten pages', done: false },
  { id: 'walk', name: 'Walk', done: true },
];

/** `<Component {...props}>{children}</Component>`. */
function h(component: unknown, props: object = {}, ...children: unknown[]): JSX.Element {
  const all = children.length
    ? { ...props, children: children.length > 1 ? children : children[0] }
    : props;
  return createComponent(component as (props: object) => JSX.Element, all);
}

/** What every stand-in for the screen does; each draws its rows its own way. */
function tracker() {
  const [habits, setHabits] = createSignal(HABITS);
  let nextHabitId = 0;
  return {
    habits,
    remaining: () => habits().filter((habit) => !habit.done).length,
    add: (name: string) =>
      setHabits((list) => [...list, { id: `habit-${++nextHabitId}`, name, done: false }]),
    toggle: (id: string) =>
      setHabits((list) => list.map((h) => (h.id === id ? { ...h, done: !h.done } : h))),
  };
}

type Tracker = ReturnType<typeof tracker>;

/** The title, the count, the form, and `rows` in a scroll view. */
const screenOf = (habits: Tracker, rows: () => unknown) =>
  h(
    View,
    {},
    h(Text, {}, 'Today'),
    h(Text, {}, () => `${habits.remaining()} left to do`),
    h(NewHabit, { onAdd: habits.add }),
    h(ScrollView, {}, rows()),
  );

const row = (habit: Pick<Habit, 'name' | 'done'>, onPress?: () => void) =>
  h(
    Pressable,
    { accessibilityRole: 'button', onPress },
    h(Text, {}, habit.name),
    h(Text, {}, habit.done ? 'Done' : 'To do'),
  );

const each = (habits: Tracker, draw: (habit: Habit) => unknown) =>
  h(For, {
    get each() {
      return habits.habits();
    },
    children: draw,
  });

/** The screen as it should be. */
function WorkingApp() {
  const habits = tracker();
  return screenOf(habits, () => each(habits, (habit) => row(habit, () => habits.toggle(habit.id))));
}

/** Everything but the habits: the count, the form and an empty list. */
function WithoutHabits() {
  return screenOf(tracker(), () => null);
}

/** Everything, except that pressing a habit does nothing. */
function PressDoesNothing() {
  const habits = tracker();
  return screenOf(habits, () => each(habits, (habit) => row(habit)));
}

/** A row that never says it was pressed. */
function SilentRow(props: { name: string; done?: boolean }) {
  return row({ name: props.name, done: props.done ?? false });
}

type Replace = Readonly<Record<string, Record<string, unknown>>>;

const failed = (outcomes: readonly TestOutcome[]) => outcomes.filter((outcome) => !outcome.ok);

async function passing({ runTests }: CheckContext): Promise<void> {
  const outcomes = await runTests('app.spec.ts');
  expect(failed(outcomes).map((outcome) => outcome.name)).toEqual([]);
}

/** The tests that pass with `working` in place and fail with `broken`. */
async function caught(
  { runTests }: CheckContext,
  working: Replace,
  broken: Replace,
): Promise<string[]> {
  const passed = new Set(
    (await runTests('app.spec.ts', { replace: working }))
      .filter((outcome) => outcome.ok)
      .map((outcome) => outcome.name),
  );
  return failed(await runTests('app.spec.ts', { replace: broken }))
    .map((outcome) => outcome.name)
    .filter((name) => passed.has(name));
}

const WORKING: Replace = { 'app.tsx': { App: WorkingApp } };

check(
  1,
  'Your tests pass',
  async (context) => {
    await passing(context);
  },
  'Run the tests: each failure says what it expected and what it found.',
);

check(
  1,
  'They fail when the habits are missing',
  async (context) => {
    const names = await caught(context, WORKING, { 'app.tsx': { App: WithoutHabits } });
    expect(names).not.toEqual([]);
  },
  "Add a test that finds a habit on screen, such as expect(screen.getByText('Drink water')).toBeTruthy().",
);

check(
  2,
  'They fail when pressing a habit does nothing',
  async (context) => {
    await passing(context);
    const names = await caught(context, WORKING, { 'app.tsx': { App: PressDoesNothing } });
    expect(names).not.toEqual([]);
  },
  'Add a test that presses a habit with userEvent.press and expects the count to go down.',
);

check(
  3,
  'They fail when HabitRow does not say it was pressed',
  async (context) => {
    await passing(context);
    const names = await caught(context, WORKING, {
      ...WORKING,
      'habit-row.tsx': { HabitRow: SilentRow },
    });
    expect(names).not.toEqual([]);
  },
  'Render HabitRow on its own with props: { name, onToggle } and onToggle from vi.fn(), press it, and expect onToggle to have been called.',
);
