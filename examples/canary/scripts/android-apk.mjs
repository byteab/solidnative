#!/usr/bin/env node
/**
 * The canary's Android APK, rebuilt only when its native half changed.
 *
 * A release APK is a native build, most of it C++ that takes the bulk of twenty minutes, plus a
 * JavaScript bundle compiled to Hermes bytecode that takes one. Most pull requests change only the
 * bundle. So CI keys the APK by Expo's fingerprint of everything native, and when a cached APK for
 * the same fingerprint exists it puts a freshly built bundle into that APK instead of building it
 * again: the same bundle command and Hermes flags React Native's Gradle plugin runs, then the APK
 * zipped, aligned and signed again.
 *
 *     node scripts/android-apk.mjs fingerprint
 *         prints the native fingerprint, the cache key
 *     node scripts/android-apk.mjs assets <assets.json>
 *         bundles the app and writes the list of assets it ships, beside a freshly built APK
 *     node scripts/android-apk.mjs rebundle <cached.apk> <assets.json> <keystore> <out.apk>
 *         the cached APK with today's bundle in it; exits 3 when the assets differ, since an
 *         image is compiled into the APK's resources and cannot be swapped like the bundle
 *
 * Run from examples/canary.
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bundle, fingerprint, hermes, run } from './native-bundle.mjs';

const BUNDLE = 'index.android.bundle';

/** Every file under a directory, by its path from there, with a hash of what is in it. */
function manifest(directory) {
  const files = {};
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const file = path.join(at, entry.name);
      if (entry.isDirectory()) walk(file);
      else
        files[path.relative(directory, file)] = createHash('sha1')
          .update(readFileSync(file))
          .digest('hex');
    }
  };
  walk(directory);
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

/** The newest build tools the SDK has, for zipalign and apksigner. */
function buildTools() {
  const sdk =
    process.env.ANDROID_HOME ??
    process.env.ANDROID_SDK_ROOT ??
    path.join(process.env.HOME, 'Library/Android/sdk');
  const versions = readdirSync(path.join(sdk, 'build-tools')).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  return path.join(sdk, 'build-tools', versions.at(-1));
}

function rebundle(cached, assetsFile, keystore, output) {
  const built = bundle('android', BUNDLE);
  const now = manifest(built.assets);
  const then = JSON.parse(readFileSync(assetsFile, 'utf8'));
  if (JSON.stringify(now) !== JSON.stringify(then)) {
    console.error('[android-apk] the assets changed, so the APK has to be built');
    process.exit(3);
  }
  const work = mkdtempSync(path.join(tmpdir(), 'canary-apk-'));
  mkdirSync(path.join(work, 'assets'));
  hermes(built.bundle, path.join(work, 'assets', BUNDLE));
  const unsigned = path.join(work, 'unsigned.apk');
  copyFileSync(cached, unsigned);
  // The old signature goes with the old bundle: it no longer matches what is in the zip.
  run('zip', ['-q', '-d', unsigned, 'META-INF/*'], { stdio: 'ignore' });
  run('zip', ['-q', unsigned, `assets/${BUNDLE}`], { cwd: work });
  const tools = buildTools();
  const aligned = path.join(work, 'aligned.apk');
  run(path.join(tools, 'zipalign'), ['-f', '-p', '4', unsigned, aligned]);
  run(path.join(tools, 'apksigner'), [
    'sign',
    '--ks',
    keystore,
    '--ks-pass',
    'pass:android',
    '--key-pass',
    'pass:android',
    '--ks-key-alias',
    'androiddebugkey',
    '--out',
    output,
    aligned,
  ]);
  rmSync(work, { recursive: true, force: true });
  rmSync(built.out, { recursive: true, force: true });
  console.log(
    `[android-apk] ${output}: ${(statSync(output).size / 1e6).toFixed(1)} MB, today's bundle`,
  );
}

const [command, ...args] = process.argv.slice(2);
if (command === 'fingerprint') {
  console.log(fingerprint('android'));
} else if (command === 'assets') {
  const built = bundle('android', BUNDLE);
  writeFileSync(args[0], JSON.stringify(manifest(built.assets), null, 2));
  rmSync(built.out, { recursive: true, force: true });
} else if (command === 'rebundle') {
  rebundle(...args);
} else {
  console.error(
    'usage: android-apk.mjs fingerprint | assets <out.json> | rebundle <apk> <assets.json> <keystore> <out.apk>',
  );
  process.exit(2);
}
