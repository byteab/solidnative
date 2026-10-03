/**
 * The real Tailwind CLI, for tests that need its output rather than a checked-in fixture of it.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FakeFabric, FakeFabricNode } from '@solidnative/testing';

/**
 * Tailwind 4's CLI, by path. `npx` would run whichever `tailwindcss` binary is linked into
 * `node_modules/.bin`, and Tailwind 3, installed here for its own tests, links one too.
 */
const CLI = join(
  dirname(createRequire(import.meta.url).resolve('@tailwindcss/cli/package.json')),
  'dist/index.mjs',
);

/** This package, so the CLI resolves `@solidnative/tailwind` the way an app would. */
const HERE = fileURLToPath(new URL('.', import.meta.url));

/**
 * Builds one preset with the real CLI and hands back its output.
 *
 * Run from this package, which has the workspace dependency installed - the CLI resolves imports
 * from the entry file's own directory, so a temp directory somewhere else cannot see
 * `@solidnative/tailwind` at all.
 */
export function build(preset: 'native' | 'web', classes: string): string {
  const dir = HERE;
  const entry = join(dir, `.preset-test-${preset}-${process.pid}.css`);
  const outDir = mkdtempSync(join(tmpdir(), 'preset-'));
  const out = join(outDir, 'out.css');
  writeFileSync(
    entry,
    [
      `@import 'tailwindcss/theme.css';`,
      // Only the classes asked for: scanning this package would pick up every class named in
      // any test or fixture here, and make each test's sheet depend on all the others.
      `@import 'tailwindcss/utilities.css' source(none);`,
      `@import '@solidnative/tailwind/${preset}.css';`,
      `@source inline("${classes}");`,
    ].join('\n'),
  );
  try {
    execFileSync(process.execPath, [CLI, '-i', entry, '-o', out], { cwd: dir, stdio: 'pipe' });
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(entry, { force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
}

/** The props a node was last committed with. */
export function committedProps(fabric: FakeFabric, node: unknown): Record<string, unknown> {
  const all = (n: FakeFabricNode): FakeFabricNode[] => [n, ...n.children.flatMap(all)];
  const found = fabric.committed.flatMap(all).find((n) => n.instanceHandle === node);
  assert.ok(found, 'committed');
  return found.props;
}
