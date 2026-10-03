import { render, screen } from '@solid-native/testing';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('shows the day', () => {
    render(App);
    expect(screen.getByText('Today')).toBeTruthy();
  });
});
