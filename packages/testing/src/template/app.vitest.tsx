/** @jsxImportSource @solid-native/platform/solid */
// The template's app test again, under Vitest through `@solid-native/testing/vitest`.
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen, userEvent } from '@solid-native/testing';
import { App } from './app.solid.tsx';

afterEach(cleanup);

test('counts taps', async () => {
  render(App);
  await userEvent.press(screen.getByRole('button'));
  expect(screen.getByText('Tapped 1 times')).toBeTruthy();
});
