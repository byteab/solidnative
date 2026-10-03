/**
 * The preview runs the native CSS compiler's files from a hand-written list, so a file the
 * compiler starts requiring has to be added to it. When `color-spaces.cjs` was not, the compiler
 * failed to load in the page and every CSS note and style check went quiet.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCES } from './native-css-sources.ts';

const require = createRequire(import.meta.url);
const cssDir = path.dirname(require.resolve('@solid-native/metro/css/compile.cjs'));
const flatten = require.resolve('@solid-native/tailwind/flatten.cjs');

describe('the native CSS compiler in the page', () => {
  it('has every file the compiler and the Tailwind flattener require', () => {
    const files = [
      ...readdirSync(cssDir)
        .filter((name) => name.endsWith('.cjs'))
        .map((name) => path.join(cssDir, name)),
      flatten,
    ];
    const required = new Set<string>();
    for (const file of files) {
      for (const [, sibling] of readFileSync(file, 'utf8').matchAll(
        /require\('(?:\.|@solid-native\/metro\/css)(\/[\w-]+\.cjs)'\)/g,
      )) {
        required.add(`.${sibling!}`);
      }
    }
    const missing = [...required].filter((sibling) => !(sibling in SOURCES));
    expect(missing).toEqual([]);
  });
});
