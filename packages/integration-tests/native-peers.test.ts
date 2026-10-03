/**
 * Every native view a package renders comes from a module the app can be told to install.
 *
 * Expo Go bundles react-native-screens, safe-area-context, svg and gesture-handler, so a package
 * that renders their views without declaring them works there and nowhere else: a development or
 * release build links only what the app lists, and the view commits as `Unimplemented component`.
 * The template shipped exactly that for `<safe-area-view>`, found only by a release build.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = (dir: string) =>
  JSON.parse(readFileSync(`${root}${dir}/package.json`, 'utf8')) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

/** Longest prefix first: `RNSVG` is svg, not screens. */
const MODULES: [prefix: string, module: string][] = [
  ['RNSVG', 'react-native-svg'],
  ['RNCSafeArea', 'react-native-safe-area-context'],
  ['RNGestureHandler', 'react-native-gesture-handler'],
  ['RNS', 'react-native-screens'],
];

/** Every shipped source under a package's `src`, Solid entries in `src/solid/` included. */
function sources(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file))
    .map((file) => path.join(dir, file));
}

function nativeModulesUsedBy(pkg: string): Set<string> {
  const used = new Set<string>();
  for (const file of sources(`${root}packages/${pkg}/src`)) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/'(RN[A-Z]\w+)'/g)) {
      const module = MODULES.find(([prefix]) => name!.startsWith(prefix))?.[1];
      if (module) used.add(module);
    }
  }
  return used;
}

describe('native modules', () => {
  for (const pkg of ['components', 'router', 'icons']) {
    it(`@solidnative/${pkg} declares every module whose views it renders`, () => {
      const peers = manifest(`packages/${pkg}`).peerDependencies ?? {};
      for (const module of nativeModulesUsedBy(pkg)) {
        assert.ok(module in peers, `${module} is rendered but not a peer`);
      }
    });
  }

  it('finds the native views each package renders, so the check above is not vacuous', () => {
    assert.ok(nativeModulesUsedBy('components').has('react-native-safe-area-context'));
    assert.ok(nativeModulesUsedBy('router').has('react-native-screens'));
  });

  it('the template installs what its own app renders', () => {
    const app = sources(`${root}template/src`)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const deps = manifest('template').dependencies ?? {};
    assert.match(app, /<SafeAreaView\b/, 'the template still renders a safe area');
    assert.ok('react-native-safe-area-context' in deps);
  });
});
