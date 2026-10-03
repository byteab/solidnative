import { render, screen, userEvent } from '@solidnative/testing';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { HabitRow } from './habit-row';

describe('App', () => {
  it('shows the day', () => {
    render(App);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('shows every habit, and how many are left', () => {
    render(App);
    expect(screen.getByText('Drink water')).toBeTruthy();
    expect(screen.getByText('Read ten pages')).toBeTruthy();
    expect(screen.getByText('Walk')).toBeTruthy();
    expect(screen.getByText('2 left to do')).toBeTruthy();
  });

  it('ticks a habit off when it is pressed', async () => {
    render(App);
    await userEvent.press(screen.getByText('Drink water'));
    expect(screen.getByText('1 left to do')).toBeTruthy();
  });
});

describe('HabitRow', () => {
  it('says when it is pressed', async () => {
    const onToggle = vi.fn();
    render(HabitRow, { props: { name: 'Stretch', onToggle } });
    await userEvent.press(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
