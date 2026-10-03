/**
 * The entry points an app writes, checked against every package's `exports` map and resolved by
 * Metro's own resolver.
 *
 * `@solid-native/expo/battery` is a file at `src/solid/battery.ts`, and the only thing connecting
 * the two is the `exports` map in the package's `package.json`. Nothing else in the suite would
 * notice if that stopped working: TypeScript resolves it, Node resolves it, and the failure would
 * appear for the first time on a device, as a red screen from the bundler.
 *
 * Adding an `exports` field is also the moment a package stops resolving anything not listed, so
 * this pins the negative too.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { resolve } = require('metro-resolver') as {
  resolve: (context: object, specifier: string, platform: string) => { filePath: string };
};

const root = path.resolve(import.meta.dirname, '../..');

interface Manifest {
  name: string;
  private?: boolean;
  main?: string;
  files?: string[];
  exports?: Record<string, ExportTarget>;
  publishConfig?: { main?: string; types?: string; exports?: Record<string, ExportTarget> };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}
type ExportTarget = string | { [condition: string]: ExportTarget };

/** Every published workspace package, with the directory its `exports` resolve against. */
const PACKAGES = readdirSync(path.join(root, 'packages'))
  .map((dir) => path.join(root, 'packages', dir))
  .filter((dir) => existsSync(path.join(dir, 'package.json')))
  .map((dir) => ({
    dir,
    manifest: JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as Manifest,
  }))
  .filter(({ manifest }) => !manifest.private);

/** The leaf paths of an export target, by condition (`default` for a bare string). */
function leaves(target: ExportTarget, condition = 'default'): [condition: string, file: string][] {
  return typeof target === 'string'
    ? [[condition, target]]
    : Object.entries(target).flatMap(([name, inner]) => leaves(inner, name));
}

/** Whether a target names a file that exists, or for a `*` pattern, at least one that matches. */
function exists(dir: string, target: string): boolean {
  if (!target.includes('*'))
    return existsSync(path.join(dir, target)) && statSync(path.join(dir, target)).isFile();
  const [before, after] = target.split('*') as [string, string];
  const slash = before.lastIndexOf('/') + 1;
  const folder = path.join(dir, before.slice(0, slash));
  const prefix = before.slice(slash);
  return readdirSync(folder).some((file) => file.startsWith(prefix) && file.endsWith(after));
}

/** The build a source file is published as. */
const built = (source: string) => source.replace(/^\.\/src\//, './dist/').replace(/\.tsx?$/, '.js');
const declaration = (source: string) =>
  source.replace(/^\.\/src\//, './dist/').replace(/\.tsx?$/, '.d.ts');

describe('every package', () => {
  it('is found, so the checks below are not vacuous', () => {
    const names = PACKAGES.map(({ manifest }) => manifest.name);
    for (const name of [
      '@solid-native/platform',
      '@solid-native/components',
      '@solid-native/expo',
    ]) {
      assert.ok(names.includes(name), name);
    }
  });

  for (const { dir, manifest } of PACKAGES) {
    describe(manifest.name, () => {
      if (!manifest.exports) return;
      const exportsMap = manifest.exports;

      it('resolves every entry point, under every condition, to a file that exists', () => {
        assert.ok('.' in exportsMap, 'a root entry');
        for (const [subpath, target] of Object.entries(exportsMap)) {
          for (const [condition, file] of leaves(target)) {
            assert.ok(exists(dir, file), `${subpath} (${condition}) -> ${file}`);
          }
        }
      });

      it('points main at the root entry', () => {
        const rootTarget = leaves(exportsMap['.']!).find(([condition]) => condition === 'default');
        assert.equal(`./${manifest.main}`, rootTarget?.[1]);
      });

      it('keeps each ./solid alias on the entry it aliases', () => {
        for (const [subpath, target] of Object.entries(exportsMap)) {
          if (subpath !== './solid' && !subpath.startsWith('./solid/')) continue;
          const plain = subpath === './solid' ? '.' : subpath.replace(/^\.\/solid\//, './');
          if (plain in exportsMap) assert.deepEqual(target, exportsMap[plain], subpath);
        }
      });

      const published = manifest.publishConfig?.exports;
      if (!published) return;

      it('publishes the build of every source entry point, and only those', () => {
        // The workspace resolves `exports`, which name source; npm gets `publishConfig.exports`,
        // which name the build. Nothing but this keeps the two in step: a subpath added to one
        // only would work in every test here and be missing, or dangling, for an app.
        assert.deepEqual(Object.keys(published), Object.keys(exportsMap));
        for (const [subpath, target] of Object.entries(exportsMap)) {
          const shipped: Map<string, string> = new Map(leaves(published[subpath]!));
          for (const [condition, file] of leaves(target)) {
            if (/^\.\/src\/.*\.tsx?$/.test(file)) {
              assert.equal(shipped.get(condition), built(file), `${subpath} (${condition})`);
              assert.equal(
                shipped.get('types'),
                declaration(leaves(target).at(-1)![1]),
                `${subpath} types`,
              );
            } else if (file.startsWith('./src/')) {
              assert.equal(shipped.get(condition), file.replace(/^\.\/src\//, './dist/'), subpath);
            } else {
              // Shipped as it is: it has to be in `files` to reach npm at all.
              assert.equal(shipped.get(condition), file, `${subpath} (${condition})`);
              if (file !== './package.json')
                assert.ok(
                  manifest.files?.some(
                    (entry) => entry === file.slice(2) || file.startsWith(`./${entry}/`),
                  ),
                  `${file} is in files`,
                );
            }
          }
        }
        assert.ok(manifest.files?.includes('dist'), 'the build is in files');
      });

      it('points the published main and types at the build of the root entry', () => {
        assert.equal(`./${manifest.publishConfig!.main}`, built(`./${manifest.main}`));
        assert.equal(`./${manifest.publishConfig!.types}`, declaration(`./${manifest.main}`));
      });
    });
  }
});

/** What Metro's `PackageCache` hands the resolver: subpath exports are driven entirely by this. */
function packageForModule(absolutePath: string) {
  let dir =
    existsSync(absolutePath) && statSync(absolutePath).isDirectory()
      ? absolutePath
      : path.dirname(absolutePath);
  while (dir !== path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (existsSync(manifest)) {
      return {
        rootPath: dir,
        packageJsonPath: manifest,
        packageJson: JSON.parse(readFileSync(manifest, 'utf8')),
        packageRelativePath: path.relative(dir, absolutePath),
      };
    }
    dir = path.dirname(dir);
  }
  return null;
}

/** Metro's resolution context, with the defaults `@expo/metro-config` ships. */
function context(from: string) {
  return {
    originModulePath: from,
    originModuleDir: path.dirname(from),
    // On by default in metro-config, and what makes an `exports` map load-bearing rather than
    // decorative. If an app ever turns it off, every deep entry point here stops resolving.
    unstable_enablePackageExports: true,
    unstable_conditionNames: new Set(['react-native', 'require', 'import']),
    unstable_conditionsByPlatform: { web: new Set(['browser']) },
    unstable_logWarning: () => {},
    mainFields: ['react-native', 'browser', 'main'],
    sourceExts: ['ts', 'tsx', 'js', 'json'],
    assetExts: new Set(['png']),
    nodeModulesPaths: [],
    extraNodeModules: null,
    resolveAsset: () => null,
    redirectModulePath: (p: string) => p,
    allowHaste: false,
    disableHierarchicalLookup: false,
    doesFileExist: (p: string) => existsSync(p) && statSync(p).isFile(),
    fileSystemLookup: (p: string) => {
      try {
        const stat = statSync(p);
        // Realpaths, as Metro's own lookup does: a workspace package is a symlink from
        // node_modules into packages/, and without following it every path here is the link.
        return { exists: true, type: stat.isDirectory() ? 'd' : 'f', realPath: realpathSync(p) };
      } catch {
        return { exists: false };
      }
    },
    getPackage: (p: string) => JSON.parse(readFileSync(p, 'utf8')),
    getPackageForModule: packageForModule,
    isAssetFile: () => false,
  };
}

// Resolved as the canary would: it is the example that declares these packages, and under a
// strict installer an app only resolves what it declares - which is the whole point of checking
// this against a real resolver rather than a hoisted node_modules that answers everything.
const from = path.join(root, 'examples/canary/src/app/app.solid.tsx');
const resolved = (specifier: string, platform = 'ios') =>
  path.relative(root, resolve(context(from), specifier, platform).filePath);

describe('the entry points Metro has to resolve', () => {
  it('maps a bare package, and its ./solid alias, to its Solid entry', () => {
    for (const name of ['expo', 'components', 'device', 'router', 'platform', 'icons']) {
      assert.equal(resolved(`@solid-native/${name}`), `packages/${name}/src/solid.ts`, name);
      assert.equal(resolved(`@solid-native/${name}/solid`), `packages/${name}/src/solid.ts`, name);
    }
    assert.equal(resolved('@solid-native/fabric'), 'packages/fabric/src/index.ts');
  });

  it('maps every per-module Expo entry point into src/solid, which is where the file is', () => {
    // One per Expo module, so importing haptics does not make an app install the video player.
    const manifest = JSON.parse(
      readFileSync(path.join(root, 'packages/expo/package.json'), 'utf8'),
    ) as Manifest;
    const modules = Object.keys(manifest.exports!)
      .filter((subpath) => /^\.\/solid\/[a-z-]+$/.test(subpath))
      .map((subpath) => subpath.slice('./solid/'.length));
    assert.ok(modules.length >= 30, `${modules.length} modules`);
    for (const name of modules) {
      for (const specifier of [`@solid-native/expo/${name}`, `@solid-native/expo/solid/${name}`]) {
        assert.equal(resolved(specifier), `packages/expo/src/solid/${name}.ts`, specifier);
      }
    }

    // The three that reach an optional peer, and so stay out of the barrel.
    for (const name of ['animations', 'gestures', 'reanimated']) {
      assert.equal(
        resolved(`@solid-native/components/${name}`),
        `packages/components/src/solid/${name}.ts`,
      );
    }
  });

  it('gives a browser build its own animations entry, and a device the native one', () => {
    // One import in an app, two graphs: React Native's on a device, a React-free one in a
    // browser, which could not load React Native's Flow source if it tried.
    for (const specifier of [
      '@solid-native/components/animations',
      '@solid-native/components/solid/animations',
    ]) {
      assert.equal(resolved(specifier), 'packages/components/src/solid/animations.ts');
      assert.equal(resolved(specifier, 'web'), 'packages/components/src/solid/animations-web.ts');
    }
    // Node has no `browser` condition either, so this suite's own imports see the native entry.
    assert.equal(
      path.relative(
        root,
        realpathSync(createRequire(from).resolve('@solid-native/components/animations')),
      ),
      'packages/components/src/solid/animations.ts',
    );
  });

  it('fails a specifier that maps to nothing', () => {
    assert.throws(() => resolved('@solid-native/expo/nope'));
    // A file that exists but is not an entry point: the map is the whole public surface.
    assert.throws(() => resolved('@solid-native/expo/observed'));
    assert.throws(() => resolved('@solid-native/expo/solid/observed'));
  });

  it('warns rather than refuses when a path reaches past the map, unlike Node', async () => {
    // Worth knowing which way each tool errs. Metro logs and falls back to file-based
    // resolution, so `@solid-native/expo/src/solid/battery.ts` would quietly work on a device;
    // Node and TypeScript both refuse it outright. The strict check therefore happens at
    // typecheck and test time, which is the right way round - but it does mean Metro alone
    // would never tell you an app was reaching past the entry points.
    const warnings: string[] = [];
    const lenient = { ...context(from), unstable_logWarning: (m: string) => warnings.push(m) };
    const past = resolve(lenient, '@solid-native/expo/src/solid/battery.ts', 'ios');

    assert.match(path.relative(root, past.filePath), /packages\/expo\/src\/solid\/battery\.ts$/);
    assert.equal(warnings.length, 1, 'it says so, at least');

    // Held in a variable because TypeScript refuses the specifier outright - writing it literally
    // fails `tsc` with TS2307, which is the third tool agreeing.
    const reachingPast = '@solid-native/expo/src/solid/battery.ts';
    await assert.rejects(
      () => import(reachingPast),
      { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
      'Node refuses the same path',
    );
  });
});
