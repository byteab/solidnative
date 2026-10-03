import { render, screen, settle, userEvent } from '@solid-native/testing';
import { expect, vi } from 'vitest';
import { check, parentOf } from '../../check.ts';
import { App } from './solution/app.tsx';
import { HabitRow } from './solution/habit-row.tsx';

check(
  1,
  'Pressing a habit ticks it off, and pressing it again puts it back',
  async () => {
    render(App);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await userEvent.press(screen.getByText('Drink water'));
    expect(screen.getByText('1 left to do')).toBeTruthy();
    expect(screen.getAllByText('Done')).toHaveLength(2);
    await userEvent.press(screen.getByText('Drink water'));
    expect(screen.getByText('2 left to do')).toBeTruthy();
  },
  'Make the card a <Pressable accessibilityRole="button" onPress={() => toggle(habit.id)}>, and update the signal in toggle().',
);

check(
  2,
  'A card changes color while it is touched, and changes back when the finger lifts',
  async () => {
    const { fabric } = render(App);
    const card = () => parentOf(fabric.committed, screen.getByText('Drink water'))!;
    const resting = card().props['backgroundColor'];
    // A finger down on the words, as the responder sees it, and up again a task later.
    fabric.emit(screen.getByText('Drink water'), 'topTouchStart', {
      touches: [{}],
      changedTouches: [{}],
    });
    await settle();
    expect(card().props['backgroundColor']).not.toEqual(resting);
    fabric.emit(screen.getByText('Drink water'), 'topTouchEnd', {
      touches: [],
      changedTouches: [{}],
    });
    await settle();
    expect(card().props['backgroundColor']).toEqual(resting);
  },
  'Add a .habit:active rule with a background-color of its own, next to the .habit rule.',
  { readsStyles: true },
);

check(
  3,
  'HabitRow takes a name and whether it is done',
  () => {
    render(HabitRow, { props: { name: 'Stretch', done: true } });
    expect(screen.getByText('Stretch')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  },
  'Export a HabitRow component from habit-row.tsx that shows props.name, and Done or To do from props.done.',
);

check(
  3,
  'HabitRow says when it is pressed',
  async () => {
    const onToggle = vi.fn();
    render(HabitRow, { props: { name: 'Stretch', onToggle } });
    await userEvent.press(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  },
  'Give HabitRow an onToggle prop, and call it from the pressable: onPress={() => props.onToggle?.()}.',
);

check(
  3,
  'The screen draws its rows with HabitRow',
  async ({ file }) => {
    expect(file('app.tsx')).toContain('<HabitRow');
    render(App);
    await userEvent.press(screen.getByText('Read ten pages'));
    expect(screen.getByText('1 left to do')).toBeTruthy();
  },
  'Use <HabitRow name={habit.name} done={habit.done} onToggle={() => toggle(habit.id)} /> inside the <For>, and import it from ./habit-row.',
);
