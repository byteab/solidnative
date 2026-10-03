/**
 * What the canary's release builds share: Expo's fingerprint of the native half, and the
 * JavaScript bundled and compiled to Hermes bytecode as a release build does it. `android-apk.mjs`
 * and `ios-app.mjs` put a fresh bundle into a cached build with these, so a pull request that
 * changes only JavaScript does not compile the native half again.
 *
 * Run from examples/canary.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
export const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    ...options,
  });

/** The entry the native build resolves, as an absolute path, which is what ends up in the bytecode. */
function entry(platform) {
  return run(process.execPath, [
    '-e',
    "require('expo/scripts/resolveAppEntry')",
    process.cwd(),
    platform,
    'absolute',
  ]).trim();
}

/** Expo's hash of everything native for a platform: the key a cached build is kept under. */
export function fingerprint(platform) {
  const cli = require.resolve('@expo/fingerprint/bin/cli.js', {
    paths: [path.dirname(require.resolve('expo/package.json'))],
  });
  return JSON.parse(run(process.execPath, [cli, 'fingerprint:generate', '--platform', platform]))
    .hash;
}

/** The bundle and its assets, as `export:embed` writes them for a release build. */
export function bundle(platform, name) {
  const out = mkdtempSync(path.join(tmpdir(), 'canary-bundle-'));
  const assets = path.join(out, 'assets');
  mkdirSync(assets);
  run(
    'npx',
    [
      'expo',
      'export:embed',
      '--platform',
      platform,
      '--dev',
      'false',
      '--reset-cache',
      '--entry-file',
      entry(platform),
      '--bundle-output',
      path.join(out, name),
      '--assets-dest',
      assets,
      '--sourcemap-output',
      path.join(out, `${name}.packager.map`),
      '--minify',
      'false',
    ],
    { stdio: 'inherit' },
  );
  return { out, bundle: path.join(out, name), assets };
}

/** The JavaScript as Hermes bytecode, with the flags the Gradle plugin passes by default. */
export function hermes(source, target) {
  const compiler = path.join(
    path.dirname(
      require.resolve('hermes-compiler/package.json', {
        paths: [path.dirname(require.resolve('react-native/package.json'))],
      }),
    ),
    'hermesc',
    process.platform === 'darwin' ? 'osx-bin' : 'linux64-bin',
    'hermesc',
  );
  run(compiler, [
    '-w',
    '-emit-binary',
    '-max-diagnostic-width=80',
    '-out',
    target,
    source,
    '-O',
    '-output-source-map',
  ]);
}
