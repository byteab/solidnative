import path from 'node:path';
import url from 'node:url';
import { expect, test } from 'vitest';
import { extractApi, lookup } from './api.ts';

const api = extractApi(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../..'));

test('a component lists its props, inherited ones included, with callbacks as events', () => {
  const entry = api['@solid-native/components#Switch']!;
  expect(entry).toMatchObject({ kind: 'component', importPath: '@solid-native/components/solid' });
  expect(entry.members).toContainEqual(
    expect.objectContaining({ name: 'class', kind: 'prop', type: 'string', required: false }),
  );
  expect(entry.members).toContainEqual(
    expect.objectContaining({ name: 'onValueChange', kind: 'event' }),
  );
});

test('a bare name resolves when unique and throws when two packages share it', () => {
  expect(lookup(api, 'ScrollView').package).toBe('@solid-native/components');
  expect(() => lookup(api, 'Switch')).toThrow(/@solid-native\/components#Switch/);
  expect(() => lookup(api, 'NoSuchThing')).toThrow(/No exported declaration/);
});

test('@solid-native/testing is read from its root entry, having no ./solid subpath', () => {
  expect(api['@solid-native/testing#render']).toMatchObject({
    kind: 'function',
    importPath: '@solid-native/testing',
  });
  expect(lookup(api, 'userEvent').package).toBe('@solid-native/testing');
});
