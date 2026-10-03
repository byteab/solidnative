import { render, screen } from '@solid-native/testing';
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
});
