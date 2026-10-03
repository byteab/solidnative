import { fireEvent, render, screen, userEvent } from '@solidnative/testing';
import { expect, vi } from 'vitest';
import { check } from '../../check.ts';
import { App } from './solution/app.tsx';
import { NewHabit } from './solution/new-habit.tsx';

const field = () => screen.getByPlaceholderText('New habit');

check(
  1,
  'The text field is bound to the form',
  async ({ file }) => {
    expect(file('new-habit.tsx')).toMatch(/createForm\(/);
    expect(file('new-habit.tsx')).toMatch(/\{\.\.\.bindFormField\(/);
    render(NewHabit);
    await userEvent.type(field(), 'Stretch');
    expect(screen.getByDisplayValue('Stretch')).toBeTruthy();
  },
  'Add a file called new-habit.tsx that exports NewHabit, with a form from createForm({ name: \'\' }) and a <TextInput placeholder="New habit" {...bindFormField(form.fields.name)} />.',
);

check(
  1,
  'The screen shows the form',
  () => {
    render(App);
    expect(field()).toBeTruthy();
  },
  'Put <NewHabit /> in App, under the count, and import it from ./new-habit.',
);

check(
  2,
  'An empty name says what is wrong once the field loses focus, and not before',
  async () => {
    render(NewHabit);
    expect(screen.queryByRole('alert')).toBeNull();
    await fireEvent.focus(field());
    await fireEvent.changeText(field(), 'a');
    await fireEvent.changeText(field(), '');
    expect(screen.queryByRole('alert')).toBeNull();
    await fireEvent.blur(field());
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Give the habit a name')).toBeTruthy();
  },
  'Validate the name with formRequired({ message: \'Give the habit a name\' }), and show the first error in a <Text accessibilityRole="alert"> once the field is touched.',
);

check(
  2,
  'The native field receives a 30-character limit',
  () => {
    render(NewHabit);
    expect(field().props['maxLength']).toBe(30);
  },
  'Add formMaxLength(30) to the rules, and maxLength={30} to the <TextInput>, which the native field enforces as the person types.',
);

check(
  3,
  'Add says what was typed, and empties the field',
  async () => {
    const onAdd = vi.fn();
    render(NewHabit, { props: { onAdd } });
    await userEvent.type(field(), 'Stretch');
    await userEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('Stretch');
    expect(screen.queryByDisplayValue('Stretch')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  },
  'Give NewHabit an onAdd prop, and a <Pressable accessibilityRole="button"> with the text Add whose onPress calls form.submit(...), which passes the name to onAdd and empties the field.',
);

check(
  3,
  'Add does nothing with an empty name, and says why',
  async () => {
    const onAdd = vi.fn();
    render(NewHabit, { props: { onAdd } });
    await userEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  },
  'Call onAdd from inside form.submit(), which runs its handler only when the form is valid.',
);

check(
  3,
  'The return key adds the habit and keeps the keyboard up',
  async () => {
    const onAdd = vi.fn();
    render(NewHabit, { props: { onAdd } });
    expect(field().props['returnKeyType']).toBe('done');
    expect(field().props['submitBehavior']).toBe('submit');
    await userEvent.type(field(), 'Stretch', { submitEditing: true, skipBlur: true });
    expect(onAdd).toHaveBeenCalledWith('Stretch');
    expect(screen.queryByDisplayValue('Stretch')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  },
  'Give the <TextInput> returnKeyType="done", submitBehavior="submit" and onSubmitEditing={save}.',
);

check(
  3,
  'A new habit joins the list',
  async () => {
    render(App);
    await userEvent.type(field(), 'Stretch');
    await userEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Stretch')).toBeTruthy();
    expect(screen.getByText('3 left to do')).toBeTruthy();
  },
  "Pass App's add to <NewHabit onAdd={add} />, and append { id, name, done: false }, with a distinct id for every new habit.",
);

check(
  3,
  'Two habits with the same name are still two habits',
  async () => {
    render(App);
    for (let i = 0; i < 2; i++) {
      await userEvent.type(field(), 'Stretch');
      await userEvent.press(screen.getByRole('button', { name: 'Add' }));
    }
    expect(screen.getAllByText('Stretch')).toHaveLength(2);
    expect(screen.getByText('4 left to do')).toBeTruthy();
    await userEvent.press(screen.getAllByText('Stretch')[0]!);
    expect(screen.getByText('3 left to do')).toBeTruthy();
  },
  'Give every new habit an id of its own, such as habit-1, habit-2 and so on from a counter: toggle() goes by id.',
);
