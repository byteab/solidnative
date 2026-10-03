import { render, screen } from '@solid-native/testing';
import { expect } from 'vitest';
import { check } from '../../check.ts';
import { App } from './solution/app.tsx';

check(
  1,
  'The screen says Today',
  () => {
    render(App);
    expect(screen.getByText('Today')).toBeTruthy();
  },
  'Change the word between <Text> and </Text> to Today.',
);

check(
  2,
  'A second line says 3 left to do',
  () => {
    render(App);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText(/left to do$/)).toBeTruthy();
  },
  'Add another <Text> inside the <View>, after the first one.',
);
