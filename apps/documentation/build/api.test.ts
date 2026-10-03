import path from 'node:path';
import url from 'node:url';
import { expect, test } from 'vitest';
import { extractApi, lookup } from './api.ts';

const api = extractApi(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../..'));

test('a component lists its props, inherited ones included, with callbacks as events', () => {
  const entry = api['@solidnative/components#Switch']!;
  expect(entry).toMatchObject({ kind: 'component', importPath: '@solidnative/components/solid' });
  expect(entry.members).toContainEqual(
    expect.objectContaining({ name: 'class', kind: 'prop', type: 'string', required: false }),
  );
  expect(entry.members).toContainEqual(
    expect.objectContaining({ name: 'onValueChange', kind: 'event' }),
  );
});

test('a bare name resolves when unique and throws when two packages share it', () => {
  expect(lookup(api, 'ScrollView').package).toBe('@solidnative/components');
  expect(() => lookup(api, 'Switch')).toThrow(/@solidnative\/components#Switch/);
  expect(() => lookup(api, 'NoSuchThing')).toThrow(/No exported declaration/);
});

test('@solidnative/testing is read from its root entry, having no ./solid subpath', () => {
  expect(api['@solidnative/testing#render']).toMatchObject({
    kind: 'function',
    importPath: '@solidnative/testing',
  });
  expect(lookup(api, 'userEvent').package).toBe('@solidnative/testing');
});
