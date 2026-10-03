/** @jsxImportSource @solidnative/platform/solid */
// The template's app test again, under Vitest through `@solidnative/testing/vitest`.
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen, userEvent } from '@solidnative/testing';
import { App } from './app.solid.tsx';

afterEach(cleanup);

test('counts taps', async () => {
  render(App);
  await userEvent.press(screen.getByRole('button'));
  expect(screen.getByText('Tapped 1 times')).toBeTruthy();
});
