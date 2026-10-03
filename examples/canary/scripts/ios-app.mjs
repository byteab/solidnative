#!/usr/bin/env node
/**
 * The canary's iOS simulator app, rebuilt only when its native half changed.
 *
 * The iOS twin of `android-apk.mjs`: CI keys the app by Expo's fingerprint of everything native,
 * and when a cached app for the same fingerprint exists it puts a freshly built bundle into a copy
 * of it instead of compiling the pods again. Simpler than Android's: a simulator build is not
 * signed, and the images a bundle requires, and the DOM components' web bundle, are files beside it
 * in the app rather than compiled resources, so they are replaced with the bundle whatever changed.
 *
 *     node scripts/ios-app.mjs fingerprint
 *         prints the native fingerprint, the cache key
 *     node scripts/ios-app.mjs rebundle <cached.app> <out.app>
 *         a copy of the cached app with today's bundle and images in it
 *
 * Run from examples/canary.
 */
import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import { bundle, fingerprint, hermes } from './native-bundle.mjs';

const BUNDLE = 'main.jsbundle';

function rebundle(cached, output) {
  const built = bundle('ios', BUNDLE);
  try {
    rmSync(output, { recursive: true, force: true });
    cpSync(cached, output, { recursive: true, verbatimSymlinks: true });
    // What the old bundle brought with it, which today's replaces: the images it required, and the
    // web bundle Expo's DOM components are served from.
    for (const stale of ['assets', 'www.bundle']) {
      rmSync(path.join(output, stale), { recursive: true, force: true });
    }
    cpSync(built.assets, output, { recursive: true });
    hermes(built.bundle, path.join(output, BUNDLE));
    // The compiler writes a source map beside the bytecode, which a built app does not carry.
    rmSync(path.join(output, `${BUNDLE}.map`), { force: true });
  } finally {
    rmSync(built.out, { recursive: true, force: true });
  }
  console.log(`[ios-app] ${output}: today's bundle`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'fingerprint') {
  console.log(fingerprint('ios'));
} else if (command === 'rebundle') {
  rebundle(...args);
} else {
  console.error('usage: ios-app.mjs fingerprint | rebundle <cached.app> <out.app>');
  process.exit(2);
}
