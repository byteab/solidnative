/**
 * Release gate: a production bundle must be Hermes bytecode carrying the Solid application and
 * nothing of the development reload path or a benchmark screen.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP = path.resolve(import.meta.dirname, '..');
const PLATFORM = process.argv[2] ?? 'ios';

// Development-only wiring, by ASCII identifiers that survive minification (Hermes stores other
// strings as UTF-16): the clean-reload boundary Metro inserts into every Solid module in a
// development build (`@solidnative/metro/solid-reload.cjs`), the runtime it requires
// (`solid-reload-runtime.cjs`, whose reload reason and failure message are its own strings), and
// React Refresh registration. `@solidnative/platform`'s `dev-reload.ts` is not listed: the native
// root imports it unconditionally, and only its `__DEV__`-gated calls are dead in a release.
const DEV_ONLY = [
  'solid-reload-runtime',
  'Native Solid source changed',
  'Native reload failed; reload the app manually',
  '$RefreshReg$',
];

const out = mkdtempSync(path.join(tmpdir(), 'solid-native-bundle-'));
let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${message}`);
  if (!ok) failures++;
};

try {
  // --clear because Metro keys its cache on the transformer, and a release check that reuses
  // whatever the dev server left behind is not checking the release build.
  execFileSync('npx', ['expo', 'export', '--clear', '--platform', PLATFORM, '--output-dir', out], {
    cwd: APP,
    stdio: 'inherit',
  });

  const dir = path.join(out, '_expo/static/js', PLATFORM);
  const bundle = readdirSync(dir).find((file) => file.endsWith('.hbc') || file.endsWith('.js'));
  check(Boolean(bundle), `a ${PLATFORM} bundle was produced`);

  const file = path.join(dir, bundle);
  const bytes = readFileSync(file);
  check(bundle.endsWith('.hbc'), 'bundle is Hermes bytecode, not plain JS');

  const text = bytes.toString('latin1');
  for (const symbol of DEV_ONLY) {
    check(!text.includes(symbol), `no ${symbol} (development-only wiring) in the bundle`);
  }
  // Solid's development build is a separate module set; the native graph always uses the client one.
  check(!text.includes('Computations created outside'), 'no Solid development build');
  // Benchmark screens are required only when EXPO_PUBLIC_BENCH is set at build time.
  check(!text.includes('measuring...'), 'no benchmark screen in an ordinary build');
  check(text.includes('Solid Native'), 'the Solid application shipped');

  // And the styling that is actually used did survive: this colour exists only in a compiled
  // sheet, converted from the hex the canary's CSS is written with.
  check(text.includes('rgb(127, 209, 138)'), 'the compiled stylesheets did ship');

  console.log(`\n${(bytes.length / 1024 / 1024).toFixed(1)}MB  ${bundle}`);
} finally {
  rmSync(out, { recursive: true, force: true });
}

process.exit(failures ? 1 : 0);
