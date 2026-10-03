/** @jsxImportSource @solid-native/platform/solid */
// Android in a file of its own: Fabric's platform is process-wide, and node --test gives each file
// its own process.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { TextInput } from '@solid-native/components';
import { cleanup, render, screen, userEvent } from '@solid-native/testing';

afterEach(cleanup);

test('renders Android view names, and types into an Android field', async () => {
  let typed = '';
  render(() => <TextInput placeholder="Name" onValueChange={(value) => (typed = value)} />, {
    platform: 'android',
  });
  assert.equal(screen.getByPlaceholderText('Name').viewName, 'AndroidTextInput');
  await userEvent.type(screen.getByPlaceholderText('Name'), 'Ada');
  assert.equal(typed, 'Ada');
});

test('stays on Android for the rest of the process', () => {
  assert.throws(() => render(() => <TextInput />), /cannot go back to iOS/);
});
