import { render, screen, userEvent } from '@solidnative/testing';
import { describe, expect, it } from 'vitest';
import { App } from './app';

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
