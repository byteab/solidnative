/**
 * `nx g @solid-native/nx:app`, in the two shapes an Nx workspace comes in.
 *
 * Integrated: one root `package.json` and tsconfig path aliases, which is what the `@nx/angular`
 * and `@nx/react` presets make. Package-manager workspaces: each project its own package, which is Nx's default
 * since 20 and what the TypeScript and Expo presets make.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import type { Tree } from '@nx/devkit';

const require = createRequire(import.meta.url);
const { createTreeWithEmptyWorkspace } = require('@nx/devkit/testing') as {
  createTreeWithEmptyWorkspace: () => Tree;
};
const { readJson, readProjectConfiguration, readNxJson, updateJson, logger } =
  require('@nx/devkit') as typeof import('@nx/devkit');
const { application } = require('./index.cjs');
const { pnpmGlobs } = require('./workspaces.cjs');

function integrated() {
  const tree = createTreeWithEmptyWorkspace();
  updateJson(tree, 'package.json', (manifest) => ({
    ...manifest,
    dependencies: { react: '19.2.3' },
    devDependencies: { nx: '23.2.0' },
  }));
  tree.write('.gitignore', 'node_modules\n');
  return tree;
}

function pnpmWorkspace() {
  const tree = createTreeWithEmptyWorkspace();
  updateJson(tree, 'package.json', (manifest) => ({
    ...manifest,
    devDependencies: { nx: '23.2.0' },
  }));
  tree.delete('tsconfig.base.json');
  tree.write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
  return tree;
}

const generate = (tree: Tree, options: object) =>
  application(tree, { skipFormat: true, skipInstall: true, ...options });

describe('in an integrated workspace', () => {
  it("writes the template's app, with Nx's Metro config", async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    for (const file of [
      'src/main.solid.ts',
      'src/app/app.solid.tsx',
      'src/app/app.native.css',
      'src/app/app.test.ts',
      'src/native-styles.d.ts',
      'babel.config.js',
      'test-register.mjs',
      'app.json',
    ]) {
      assert.ok(tree.exists(`apps/mobile/${file}`), file);
    }
    assert.ok(!tree.exists('apps/mobile/vitest.config.mts'));
    assert.match(
      tree.read('apps/mobile/metro.config.js', 'utf-8')!,
      /withSolidNative\(withNxMetro/,
    );
  });

  it('writes an AGENTS.md with the commands this workspace runs, and a CLAUDE.md that reads it', async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    const agents = tree.read('apps/mobile/AGENTS.md', 'utf-8')!;
    assert.match(agents, /^nx run mobile:run-ios +# the iOS simulator$/m);
    assert.match(agents, /Run `nx test mobile` and `nx typecheck mobile` after a change/);
    assert.doesNotMatch(agents, /npm (start|test)/);
    assert.equal(tree.read('apps/mobile/CLAUDE.md', 'utf-8'), '@AGENTS.md\n');
  });

  it('adds typecheck and test, the two targets @nx/expo does not infer', async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile', tags: 'type:app, platform:native' });
    const project = readProjectConfiguration(tree, 'mobile');
    assert.equal(project.root, 'apps/mobile');
    assert.deepEqual(project.tags, ['type:app', 'platform:native']);
    assert.equal(project.targets?.typecheck?.options.command, 'tsc -p tsconfig.json --noEmit');
    assert.equal(
      project.targets?.test?.options.command,
      'node --import ./test-register.mjs --test "src/**/*.test.ts"',
    );
    assert.equal(project.targets?.test?.options.cwd, 'apps/mobile');
  });

  it('runs expo start itself, since @nx/expo infers start with an executor it deprecates', async () => {
    // @nx/expo 23.2's plugin infers `start` as `@nx/expo:start`, and every `nx start` printed that
    // the executor would be removed in Nx 24 and to run convert-to-inferred, which changes nothing.
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    const { start } = readProjectConfiguration(tree, 'mobile').targets ?? {};
    assert.equal(start?.executor, 'nx:run-commands');
    assert.equal(start?.options.command, 'expo start');
    assert.equal(start?.options.cwd, 'apps/mobile');
    assert.equal(start?.continuous, true);
  });

  it("registers @nx/expo's plugin for the rest", async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    const plugins = readNxJson(tree)?.plugins ?? [];
    assert.ok(
      plugins.some((entry) => typeof entry !== 'string' && entry.plugin === '@nx/expo/plugin'),
    );
  });

  it('puts the dependencies in the root package.json, keeping versions already there', async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    const root = readJson(tree, 'package.json');
    assert.equal(root.dependencies['react-native'], '0.86.3');
    assert.equal(root.dependencies['solid-js'], '1.9.15');
    assert.equal(root.devDependencies['@nx/expo'], '23.2.0');
    // Every dependency, because Expo links only the native modules the app's own package.json
    // names: without react-native-safe-area-context there, Android crashed on RNCSafeAreaView.
    const app = readJson(tree, 'apps/mobile/package.json');
    assert.equal(app.main, 'src/main.solid.ts');
    assert.equal(app.dependencies['react-native'], '0.86.3');
    assert.equal(app.dependencies['react-native-safe-area-context'], '~5.7.0');
    assert.equal(app.dependencies['solid-js'], '1.9.15');
  });

  it("pins react-dom to the app's React, and adds the Expo CLI nx prebuild loads", async () => {
    // @nx/expo depends on @nx/react, whose react-dom peer npm would take at 19.3, and every later
    // npm install then failed against React 19.2.3. @nx/expo:init would have added both of these.
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    const root = readJson(tree, 'package.json');
    assert.equal(root.devDependencies['react-dom'], root.dependencies.react);
    assert.match(root.devDependencies['@expo/cli'], /^\^57\./);
  });

  it("extends the workspace's tsconfig.base.json, where its path aliases are", async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    assert.deepEqual(readJson(tree, 'apps/mobile/tsconfig.json').extends, [
      'expo/tsconfig.base',
      '../../tsconfig.base.json',
    ]);
  });

  it('resolves those aliases in tests too, which Node does not read from tsconfig', async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    const register = tree.read('apps/mobile/test-register.mjs', 'utf-8')!;
    assert.match(register, /new URL\("\.\.\/\.\.\/tsconfig\.base\.json", import\.meta\.url\)/);
    assert.match(register, /nextResolve\(alias\(specifier\) \?\? specifier, context\)/);
    assert.equal(readJson(tree, 'package.json').devDependencies['@nx/vite'], undefined);
  });

  it('stays integrated when pnpm-workspace.yaml only holds settings, as pnpm 11 writes it', async () => {
    // With no packages: list there are no workspace packages, and treating the file as if there
    // were put the app's dependencies where a workspace library could not reach them.
    const tree = integrated();
    const settings = 'autoInstallPeers: true\nallowBuilds:\n  nx: true\n';
    tree.write('pnpm-workspace.yaml', settings);
    await generate(tree, { directory: 'apps/mobile' });
    assert.equal(readJson(tree, 'package.json').dependencies['react-native'], '0.86.3');
    assert.equal(readJson(tree, 'apps/mobile/package.json').name, 'mobile');
    assert.equal(tree.read('pnpm-workspace.yaml', 'utf-8'), settings);
  });

  it('warns about a pinned dependency npm would refuse to install beside it', async () => {
    const tree = integrated();
    updateJson(tree, 'package.json', (manifest) => {
      manifest.dependencies['react-native'] = '0.85.2';
      return manifest;
    });
    const warnings: string[] = [];
    const warn = logger.warn;
    logger.warn = (message: string) => void warnings.push(message);
    try {
      await generate(tree, { directory: 'apps/mobile' });
    } finally {
      logger.warn = warn;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /react-native is 0\.85\.2 here/);
  });

  it("ignores Expo's cache directory", async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    assert.match(tree.read('.gitignore', 'utf-8')!, /^\.expo\/$/m);
  });

  it('ignores it once, however many apps are added', async () => {
    const tree = integrated();
    await generate(tree, { directory: 'apps/mobile' });
    await generate(tree, { directory: 'apps/second' });
    assert.equal(tree.read('.gitignore', 'utf-8')!.match(/^\.expo\/$/gm)?.length, 1);
  });

  it('refuses a directory that already holds a package', async () => {
    const tree = integrated();
    tree.write('apps/mobile/package.json', '{}');
    await assert.rejects(
      generate(tree, { directory: 'apps/mobile' }),
      /already has a package\.json/,
    );
  });
});

describe('in a pnpm workspace', () => {
  it("names the project for the workspace's scope, as Nx names its own packages", async () => {
    const tree = pnpmWorkspace();
    await generate(tree, { directory: 'apps/mobile' });
    assert.equal(readProjectConfiguration(tree, '@proj/mobile').root, 'apps/mobile');
    assert.equal(readJson(tree, 'apps/mobile/package.json').name, '@proj/mobile');
    assert.equal(JSON.parse(tree.read('apps/mobile/app.json', 'utf-8')!).expo.slug, 'mobile');
  });

  it("lists the dependencies in the app's own package.json, which pnpm needs to link them", async () => {
    const tree = pnpmWorkspace();
    await generate(tree, { directory: 'apps/mobile' });
    const app = readJson(tree, 'apps/mobile/package.json');
    assert.equal(app.main, 'src/main.solid.ts');
    assert.equal(app.dependencies.expo, '~57.0.20');
    assert.equal(app.dependencies['solid-js'], '1.9.15');
    assert.equal(app.devDependencies.typescript, '~6.0.3');
    assert.equal(app.devDependencies.vitest, undefined);
    const root = readJson(tree, 'package.json');
    assert.equal(root.dependencies?.expo, undefined);
  });

  it("adds the app's directory to the workspace when no glob covers it", async () => {
    const tree = pnpmWorkspace();
    await generate(tree, { directory: 'apps/mobile' });
    assert.deepEqual(pnpmGlobs(tree.read('pnpm-workspace.yaml', 'utf-8')!), [
      'apps/*',
      'packages/*',
    ]);
  });

  it('leaves the workspace alone when a glob already does', async () => {
    const tree = pnpmWorkspace();
    await generate(tree, { directory: 'packages/mobile' });
    assert.equal(tree.read('pnpm-workspace.yaml', 'utf-8'), "packages:\n  - 'packages/*'\n");
  });

  it("uses the template's own tsconfig, since there are no path aliases to reach", async () => {
    const tree = pnpmWorkspace();
    await generate(tree, { directory: 'apps/mobile' });
    assert.equal(readJson(tree, 'apps/mobile/tsconfig.json').extends, 'expo/tsconfig.base');
    assert.ok(!tree.exists('apps/mobile/test-register.mjs'));
  });

  it("carries the workspace's custom conditions, which its libraries export their source under", async () => {
    // The TypeScript preset's @nx/js:library points every condition but one at an unbuilt dist,
    // so without it tsc, the tests and Metro all failed to import the library.
    const tree = pnpmWorkspace();
    tree.write(
      'tsconfig.base.json',
      JSON.stringify({ compilerOptions: { customConditions: ['@proj/source'] } }),
    );
    await generate(tree, { directory: 'apps/mobile' });
    assert.deepEqual(readJson(tree, 'apps/mobile/tsconfig.json').compilerOptions.customConditions, [
      'react-native',
      '@proj/source',
    ]);
    assert.equal(
      readProjectConfiguration(tree, '@proj/mobile').targets?.test?.options.command,
      'node --conditions=@proj/source --import @solid-native/testing/register --test "src/**/*.test.ts"',
    );
  });
});

describe('in an npm workspace', () => {
  it("adds the app's directory to package.json's workspaces", async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (manifest) => ({
      ...manifest,
      workspaces: ['libs/*', '!libs/legacy'],
      devDependencies: { nx: '23.2.0' },
    }));
    await generate(tree, { directory: 'apps/mobile', name: 'phone' });
    assert.deepEqual(readJson(tree, 'package.json').workspaces, [
      'libs/*',
      '!libs/legacy',
      'apps/*',
    ]);
    assert.equal(readProjectConfiguration(tree, '@proj/phone').root, 'apps/mobile');
  });

  it('reads the object form of workspaces, too', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (manifest) => ({
      ...manifest,
      workspaces: { packages: ['libs/*'] },
      devDependencies: { nx: '23.2.0' },
    }));
    await generate(tree, { directory: 'mobile' });
    assert.deepEqual(readJson(tree, 'package.json').workspaces.packages, ['libs/*', 'mobile']);
  });
});

describe('pnpmGlobs', () => {
  it('reads quoted, bare and commented entries, and nothing past the list', () => {
    const yaml =
      'packages:\n  - \'apps/*\'\n  - packages/* # libraries\n  - "tools"\nonlyBuiltDependencies:\n  - nx\n';
    assert.deepEqual(pnpmGlobs(yaml), ['apps/*', 'packages/*', 'tools']);
  });
});
