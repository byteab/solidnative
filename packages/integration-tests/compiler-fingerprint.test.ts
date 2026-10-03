/**
 * Telling Metro that our compiler changed.
 *
 * Metro caches a transform result against the file's content and its own version, and knows
 * nothing about the transformer it called. So editing this project's compiler and restarting the
 * dev server is not enough: every file whose own text has not changed keeps the output it was
 * given by the old compiler, and only the files you also happen to edit pick the change up. The
 * failure is a half-applied compiler, which is worse to read than one that did not apply at all.
 *
 * A fingerprint of the compiler's own sources goes into `cacheVersion` and the transformer's
 * cache key, which changes the key for everything the moment the compiler moves.
 *
 * `solidCompilerFingerprint` hashes the directory it lives in, so each sandbox gets its own copy
 * of `solid-cache.cjs`, compiled with the sandbox as `__dirname` but resolving its pinned
 * dependencies (Babel, the Solid preset, lightningcss) from the real package.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Module, createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cacheFile = require.resolve('@solidnative/metro/solid-cache.cjs');
const cacheSource = readFileSync(cacheFile, 'utf8');
const { solidCompilerFingerprint } = require(cacheFile) as { solidCompilerFingerprint(): string };

type Internal = typeof Module & { _nodeModulePaths(dir: string): string[] };
type Compilable = Module & { _compile(source: string, filename: string): void; paths: string[] };

/** The fingerprint as it would be computed for a compiler living in `dir`. */
function fingerprintOf(dir: string): string {
  const filename = path.join(dir, 'solid-cache.cjs');
  const loaded = new Module(filename) as Compilable;
  loaded.filename = filename;
  loaded.paths = (Module as Internal)._nodeModulePaths(path.dirname(cacheFile));
  loaded._compile(cacheSource, filename);
  return (loaded.exports as { solidCompilerFingerprint(): string }).solidCompilerFingerprint();
}

/** A throwaway directory that looks like the compiler's own. */
function sandbox(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'fingerprint-'));
  mkdirSync(path.join(dir, 'css'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.join(dir, path.dirname(name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

describe('the compiler fingerprint', () => {
  it('is the same for the same sources', () => {
    const a = sandbox({ 'transform.cjs': 'one', 'css/compile.cjs': 'two' });
    const b = sandbox({ 'transform.cjs': 'one', 'css/compile.cjs': 'two' });
    assert.equal(fingerprintOf(a), fingerprintOf(b));
    rmSync(a, { recursive: true });
    rmSync(b, { recursive: true });
  });

  it('changes when a source changes, which is the whole point', () => {
    const dir = sandbox({ 'transform.cjs': 'one' });
    const before = fingerprintOf(dir);
    writeFileSync(path.join(dir, 'transform.cjs'), 'one, but different');
    assert.notEqual(fingerprintOf(dir), before);
    rmSync(dir, { recursive: true });
  });

  it('changes when a source is added, since a new rule is a new compiler', () => {
    const dir = sandbox({ 'transform.cjs': 'one' });
    const before = fingerprintOf(dir);
    writeFileSync(path.join(dir, 'extra.cjs'), 'more');
    assert.notEqual(fingerprintOf(dir), before);
    rmSync(dir, { recursive: true });
  });

  it('changes when a source is renamed, since a require names the file', () => {
    const a = sandbox({ 'one.cjs': 'same' });
    const b = sandbox({ 'two.cjs': 'same' });
    assert.notEqual(fingerprintOf(a), fingerprintOf(b));
    rmSync(a, { recursive: true });
    rmSync(b, { recursive: true });
  });

  it('reaches into the css directory, where the CSS compiler lives', () => {
    const dir = sandbox({ 'transform.cjs': 'one', 'css/compile.cjs': 'two' });
    const before = fingerprintOf(dir);
    writeFileSync(path.join(dir, 'css', 'compile.cjs'), 'two, but different');
    assert.notEqual(fingerprintOf(dir), before);
    rmSync(dir, { recursive: true });
  });

  it('ignores what cannot change the output', () => {
    // A README or a test beside the compiler is not the compiler. Hashing everything would
    // invalidate every app's cache on a typo fix, and a cache that clears too eagerly gets
    // turned off.
    const dir = sandbox({ 'transform.cjs': 'one' });
    const before = fingerprintOf(dir);
    writeFileSync(path.join(dir, 'README.md'), 'notes');
    writeFileSync(path.join(dir, 'transform.test.cjs'), 'a test');
    assert.equal(fingerprintOf(dir), before);
    rmSync(dir, { recursive: true });
  });

  it('answers for the real compiler, and reaches Metro through the config cacheVersion', () => {
    const real = solidCompilerFingerprint();
    assert.match(real, /^[0-9a-f]{20}$/);
    assert.equal(fingerprintOf(path.dirname(cacheFile)), real);
    const { withSolidNative } = require('@solidnative/metro') as {
      withSolidNative(config: object, options: object): { transformer: { cacheVersion: string } };
    };
    const config = withSolidNative({}, { projectRoot: import.meta.dirname });
    assert.ok(config.transformer.cacheVersion.includes(real), config.transformer.cacheVersion);
  });
});
