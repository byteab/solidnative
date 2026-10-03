/**
 * The Metro preset.
 *
 * Setting a Metro config up by hand is where this framework is easiest to get subtly wrong: miss
 * the transformer and no Solid JSX compiles, miss a source extension and native stylesheets stop
 * resolving, miss the worker wrap and Expo empties every native stylesheet. The preset is what
 * makes those unforgettable, so it is worth a test of its own.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { withSolidNative } = require('@solidnative/metro') as {
  withSolidNative(
    config: object,
    options?: { workspaceRoot?: string; projectRoot?: string },
  ): MetroConfig;
};

type Resolve = (context: { resolveRequest: Resolve }, name: string, platform: string) => unknown;

interface MetroConfig {
  projectRoot?: string;
  watchFolders?: string[];
  transformerPath?: string;
  transformer: {
    babelTransformerPath?: string;
    cacheVersion?: string;
    solidNativeUpstreamTransformer?: string;
    unstable_disableModuleWrapping?: boolean;
  };
  resolver: {
    sourceExts: string[];
    assetExts?: string[];
    nodeModulesPaths?: string[];
    resolveRequest?: Resolve;
    unstable_conditionNames?: string[];
  };
  serializer?: { getPolyfills(options: unknown): string[] };
}

/**
 * An app root Metro can be pointed at: the preset resolves the app's own `solid-js`, so each root
 * carries a manifest for it, as an installed app does.
 */
function appRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  mkdirSync(path.join(root, 'node_modules/solid-js'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), '{"name":"app"}');
  writeFileSync(
    path.join(root, 'node_modules/solid-js/package.json'),
    JSON.stringify({ name: 'solid-js', version: '1.9.15' }),
  );
  return root;
}

/** What `getDefaultConfig` hands over, reduced to the parts the preset touches. */
const base = (projectRoot = import.meta.dirname): MetroConfig => ({
  projectRoot,
  transformer: {},
  resolver: { sourceExts: ['ts', 'tsx', 'js'] },
});

describe('the Metro preset', () => {
  it('installs the Solid transformer', () => {
    const config = withSolidNative(base());
    assert.match(config.transformer.babelTransformerPath!, /solid-transformer\.cjs$/);
  });

  it('adds the extensions Solid sources and native stylesheets need', () => {
    const config = withSolidNative(base());
    for (const ext of ['tsx', 'jsx', 'css']) {
      assert.ok(config.resolver.sourceExts.includes(ext), `${ext} is resolvable`);
    }
    assert.ok(config.resolver.sourceExts.includes('ts'), 'and what was there already is kept');
  });

  it("takes css back from Expo's asset extensions", () => {
    // Metro checks assets first, so a stylesheet listed there is bundled as an asset record our
    // transformer never sees.
    const config = base();
    config.resolver.assetExts = ['png', 'css'];
    assert.deepEqual(withSolidNative(config).resolver.assetExts, ['png']);
  });

  it('refuses a config that unwraps modules, which clean reload needs', () => {
    const config = base();
    config.transformer.unstable_disableModuleWrapping = true;
    assert.throws(() => withSolidNative(config), /module wrapping/);
  });

  /**
   * A library in Nx's TypeScript preset writes `export * from './lib/ui.js'` for `./lib/ui.ts`,
   * the way TypeScript's own module resolution expects. tsc and Vitest follow it; Metro looks for
   * a `.js` file that does not exist, and the app could not import the library at all.
   */
  describe('a relative .js import of a .ts file', () => {
    /** Metro's resolver, as it would answer for a library whose only file is `lib/ui.ts`. */
    const metro: Resolve = (_context, name) => {
      if (name === './lib/ui' || name === './lib/ui.ts')
        return { type: 'sourceFile', filePath: '/lib/ui.ts' };
      throw new Error(`Unable to resolve ${name}`);
    };
    const resolve = (config: MetroConfig, name: string) =>
      config.resolver.resolveRequest!({ resolveRequest: metro }, name, 'ios');

    it('resolves to the .ts file', () => {
      const config = withSolidNative(base());
      assert.deepEqual(resolve(config, './lib/ui.js'), {
        type: 'sourceFile',
        filePath: '/lib/ui.ts',
      });
    });

    it('goes through a resolver something else installed first, as withNxMetro does', () => {
      const config = base();
      const asked: string[] = [];
      config.resolver.resolveRequest = (context, name, platform) => {
        asked.push(name);
        return metro(context, name, platform);
      };
      const wrapped = withSolidNative(config);
      assert.deepEqual(resolve(wrapped, './lib/ui.js'), {
        type: 'sourceFile',
        filePath: '/lib/ui.ts',
      });
      assert.deepEqual(asked, ['./lib/ui.js', './lib/ui']);
    });

    it('still fails for a .js file that is not there as .ts either, and for a package name', () => {
      const config = withSolidNative(base());
      assert.throws(
        () => resolve(config, './lib/missing.js'),
        /Unable to resolve \.\/lib\/missing\.js/,
      );
      assert.throws(() => resolve(config, 'some-package.js'), /Unable to resolve some-package\.js/);
    });
  });

  it("puts the app's Solid version in Metro's cache key, so an upgrade starts afresh", () => {
    // Metro reads the key once per process, so an upgrade is a second root rather than an edit.
    const before = appRoot('solidnative-solid-');
    const after = appRoot('solidnative-solid-');
    writeFileSync(
      path.join(after, 'node_modules/solid-js/package.json'),
      JSON.stringify({ name: 'solid-js', version: '1.9.16' }),
    );
    try {
      const key = (root: string) => withSolidNative(base(root)).transformer.cacheVersion!;
      assert.match(key(before), /solid-js:1\.9\.15:production-client/);
      assert.match(key(after), /solid-js:1\.9\.16:production-client/);
    } finally {
      rmSync(before, { recursive: true, force: true });
      rmSync(after, { recursive: true, force: true });
    }
  });

  it("puts the worklets Babel plugin's package in Metro's cache key, so installing it starts afresh", (t) => {
    // babel-preset-expo adds the plugin only when it resolves, and Metro's key knew nothing of
    // that, so files transformed before the install kept their worklets untransformed.
    const root = appRoot('solidnative-worklets-');
    // Nx runs tasks with NODE_PATH set to pnpm's hoisted node_modules, where the workspace's own
    // worklets lives, so a bare app would find it. Resolve as an app outside the workspace would.
    const Module = require('node:module') as { _initPaths(): void };
    const nodePath = process.env['NODE_PATH'];
    delete process.env['NODE_PATH'];
    Module._initPaths();
    t.after(() => {
      if (nodePath !== undefined) process.env['NODE_PATH'] = nodePath;
      Module._initPaths();
    });
    try {
      const key = () => withSolidNative(base(root)).transformer.cacheVersion!;
      const before = key();
      assert.match(before, /react-native-worklets:absent/);

      mkdirSync(path.join(root, 'node_modules/react-native-worklets'), { recursive: true });
      writeFileSync(
        path.join(root, 'node_modules/react-native-worklets/package.json'),
        JSON.stringify({ name: 'react-native-worklets', version: '0.6.1' }),
      );
      assert.match(key(), /react-native-worklets:0\.6\.1/);
      assert.notEqual(key(), before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the app's own cacheVersion in front", () => {
    const config = base();
    config.transformer.cacheVersion = 'mine';
    assert.match(withSolidNative(config).transformer.cacheVersion!, /^mine-/);
  });

  it('is idempotent, so applying it twice changes nothing', () => {
    const once = withSolidNative(base());
    const twice = withSolidNative(withSolidNative(base()));
    assert.deepEqual(twice.resolver.sourceExts, once.resolver.sourceExts);
  });

  it("resolves with the app's tsconfig customConditions, as tsc does", () => {
    // Nx's TypeScript preset exports a library's source only under a custom condition named in
    // tsconfig; without it Metro took the dist entry, which is not built, and failed.
    const root = appRoot('solidnative-conditions-');
    writeFileSync(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { customConditions: ['react-native', '@org/source'] } }),
    );
    try {
      const config = withSolidNative(base(root));
      assert.deepEqual(config.resolver.unstable_conditionNames, ['@org/source']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads customConditions from a tsconfig with comments and trailing commas, as tsc does', () => {
    const root = appRoot('solidnative-conditions-');
    writeFileSync(
      path.join(root, 'tsconfig.json'),
      [
        '{',
        '  // Nx writes the workspace conditions here.',
        '  "compilerOptions": {',
        '    /* a block comment, with a "string" and a // in it */',
        '    "paths": { "@org/*": ["libs/*"] },',
        '    "customConditions": ["react-native", "@org/source",],',
        '  },',
        '}',
      ].join('\n'),
    );
    try {
      const config = withSolidNative(base(root));
      assert.deepEqual(config.resolver.unstable_conditionNames, ['@org/source']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('adds each condition once, beside the ones Metro already has, and never react-native', () => {
    const root = appRoot('solidnative-conditions-');
    writeFileSync(
      path.join(root, 'tsconfig.json'),
      '{ "compilerOptions": { "customConditions": ["source", "react-native", "app"] } }',
    );
    try {
      const config = base(root);
      config.resolver.unstable_conditionNames = ['react-native', 'source'];
      const once = withSolidNative(config);
      assert.deepEqual(once.resolver.unstable_conditionNames, ['react-native', 'source', 'app']);
      assert.deepEqual(
        withSolidNative(once).resolver.unstable_conditionNames,
        ['react-native', 'source', 'app'],
        'and applying it twice adds nothing',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('leaves any polyfill the app added in place', () => {
    const getPolyfills = () => ['/rn/polyfill.js', '/app/mine.js'];
    const config = withSolidNative({ ...base(), serializer: { getPolyfills } });
    assert.deepEqual(config.serializer!.getPolyfills({}), ['/rn/polyfill.js', '/app/mine.js']);
  });

  /** Monorepo wiring is not something an app installing from npm should have to think about. */
  it('only touches watch folders when told where the workspace is', () => {
    const app = import.meta.dirname;
    const plain = withSolidNative(base(app));
    assert.equal(plain.watchFolders, undefined);
    assert.equal(plain.resolver.nodeModulesPaths, undefined);
    const config = withSolidNative(base(app), { workspaceRoot: '/work' });
    assert.deepEqual(config.watchFolders, ['/work']);
    assert.deepEqual(config.resolver.nodeModulesPaths, [
      path.join(app, 'node_modules'),
      '/work/node_modules',
    ]);
  });

  /**
   * Expo's worker empties every native stylesheet before any babel transformer sees it, so a
   * `.native.css` import would have no data to carry to the device.
   */
  describe("Expo's transform worker", () => {
    const tag = (name: string) => `module.exports = { transform: () => ${JSON.stringify(name)} };`;

    /** A stand-in for Expo's worker and the one it hands source files to, laid out as Expo's is. */
    function fakeExpo() {
      const root = appRoot('solidnative-worker-');
      const dir = path.join(root, 'node_modules/@expo/metro-config/build/transform-worker');
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'transform-worker.js'), tag('expo'));
      writeFileSync(path.join(dir, 'metro-transform-worker.js'), tag('babel'));
      return { root, worker: path.join(dir, 'transform-worker.js') };
    }

    it('is wrapped, so a native stylesheet reaches our transformer in dev and release', () => {
      const { root, worker } = fakeExpo();
      try {
        const config = withSolidNative({ ...base(root), transformerPath: worker });
        assert.match(config.transformerPath!, /solid-worker\.cjs$/);

        const ours = require(config.transformerPath!) as {
          transform(...args: unknown[]): unknown;
        };
        const run = (file: string, options: object) =>
          ours.transform(config.transformer, root, file, Buffer.from(''), options);

        assert.equal(run('/app/a.native.css', { dev: true, platform: 'ios' }), 'babel');
        assert.equal(run('/app/a.native.css', { dev: false, platform: 'ios' }), 'babel');
        assert.equal(run('/app/a.native.css', { dev: true, platform: 'web' }), 'expo', "web's");
        assert.equal(run('/app/a.css', { dev: true, platform: 'ios' }), 'expo', 'ordinary CSS');
        assert.equal(run('/app/a.module.css', { dev: true, platform: 'ios' }), 'expo');
        assert.equal(run('/app/a.ts', { dev: true, platform: 'ios' }), 'expo');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('leaves a worker the app configured itself alone', () => {
      const config = withSolidNative({ ...base(), transformerPath: '/app/my-worker.js' });
      assert.equal(config.transformerPath, '/app/my-worker.js');
    });
  });
});
