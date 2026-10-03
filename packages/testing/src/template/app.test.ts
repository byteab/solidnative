// The template's own app test (`template/src/app/app.test.ts`), on `@solid-native/testing`: the same
// claim, with the fake Fabric, the press and the settling done by the package.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen, userEvent } from '@solid-native/testing';
import { App } from './app.solid.tsx';

afterEach(cleanup);

test('counts taps', async () => {
  render(App);
  assert.ok(screen.getByText('Tapped 0 times'));

  await userEvent.press(screen.getByRole('button'));

  assert.ok(screen.getByText('Tapped 1 times'));
});
