/**
 * What a native Solid app is made of, in an Nx workspace.
 *
 * The source of truth is `template/`, the starter `create-expo-app` uses and the setup this project
 * verifies before every release. `files/` holds verbatim copies of the template's source files and
 * the versions below are the template's own, and `native-app.test.ts` fails the moment either
 * drifts from it.
 *
 * Three files differ from the template's, each because of something Nx does:
 *
 * - `metro.config.js` wraps the preset in `withNxMetro`, which resolves the workspace's tsconfig
 *   path aliases and watches its libraries. Without it an app in an integrated workspace cannot
 *   import a library at all: Metro reports `Cannot resolve @org/ui`.
 * - `tsconfig.json` also extends the workspace's `tsconfig.base.json` when there is one, which is
 *   where those aliases live, and puts back the Expo settings the workspace's base overrides.
 * - When there is a workspace base, the test command imports a `test-register.mjs` of the app's
 *   own, which loads the template's `@solidnative/testing/register` and also resolves those aliases,
 *   since Node's test runner does not read tsconfig either.
 *
 * The `@solidnative/*` packages are pinned to this package's own version, because every one of them
 * is released in lockstep with it.
 */
const { readFileSync } = require('node:fs');
const path = require('node:path');
const semver = require('semver');

const { version } = require('./package.json');

const FRAMEWORK = [
  '@solidnative/components',
  '@solidnative/device',
  '@solidnative/fabric',
  '@solidnative/metro',
  '@solidnative/platform',
];

/** @type {Record<string, string>} */
const dependencies = {
  ...Object.fromEntries(FRAMEWORK.map((name) => [name, version])),
  expo: '~57.0.20',
  'expo-status-bar': '~57.0.1',
  react: '19.2.3',
  'react-native': '0.86.3',
  'react-native-safe-area-context': '~5.7.0',
  'solid-js': '1.9.15',
};

/**
 * What `nx add` puts beside `@nx/expo`, in place of the `@nx/expo:init` it does not run: see
 * `init/index.cjs`. `@expo/cli` and `@babel/runtime` are the ranges the template's `expo` depends
 * on.
 */
const expoCompanions = {
  'react-dom': dependencies.react,
  '@expo/cli': '^57.0.22',
  '@babel/runtime': '^7.20.0',
};

/** @type {Record<string, string>} */
const devDependencies = {
  // React Native's Babel peer would otherwise take the newest copy there is.
  '@babel/core': '^7.29.7',
  // The template's test: render, screen and userEvent over a fake Fabric, and the compile hook.
  '@solidnative/testing': version,
  // The test's `node:test` and `node:assert`, for the typecheck.
  '@types/node': '^26.6.3',
  '@types/react': '~19.2.2',
  typescript: '~6.0.3',
};

/** The template's commands, which the project's targets run. */
const COMMANDS = {
  typecheck: 'tsc -p tsconfig.json --noEmit',
  test: 'node --import @solidnative/testing/register --test "src/**/*.test.ts"',
};

/** The template's files, copied verbatim into the new app. */
const SOURCE_FILES = [
  'src/main.solid.ts',
  'src/app/app.solid.tsx',
  'src/app/app.native.css',
  'src/app/app.test.ts',
  'src/native-styles.d.ts',
  'babel.config.js',
];

/** @param {string} name */
function sourceFile(name) {
  return readFileSync(path.join(__dirname, 'files', name), 'utf8');
}

/**
 * The template's `AGENTS.md`, with its Commands section replaced by this workspace's own. The rest
 * describes the framework, which is the same wherever the app lives.
 *
 * @param {string} commands the markdown that goes under the Commands heading
 */
function agentsFile(commands) {
  return sourceFile('AGENTS.md').replace(
    /## Commands\n[\s\S]*?(?=\n## )/,
    `## Commands\n\n${commands}\n`,
  );
}

/**
 * The template's `app.json`, named for this app, without the template's icons: they are the
 * template's branding, and Expo draws its own default until `icon` is set.
 *
 * @param {string} name the project name, which is also the Expo slug
 */
function appJson(name) {
  const slug = name.replace(/^@[^/]+\//, '');
  const expo = {
    name: slug,
    slug,
    version: '1.0.0',
    // Not left to Expo, which adds `web` whenever `react-dom` resolves, and @nx/react puts one there.
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    ios: { supportsTablet: true },
    android: { predictiveBackGestureEnabled: false },
    scheme: slug.replace(/[^a-z0-9]/gi, '').toLowerCase(),
    // The template's: Expo otherwise guesses a router root from src/app and says so on every start.
    extra: { router: { root: 'src/app' } },
  };
  return JSON.stringify({ expo }, null, 2) + '\n';
}

const METRO_CONFIG = `const { withNxMetro } = require('@nx/expo');
const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solidnative/metro/solid-config.cjs');

// withNxMetro resolves the workspace's libraries, through its tsconfig path aliases or its package
// manager's links, and watches them. withSolidNative registers the transformer that compiles
// Solid's JSX into native renderer calls, compiles each \`.native.css\` import into the sheet the
// engine reads, and resolves \`solid-js\` to its client build. It goes on the outside, so its
// resolver can wrap Nx's: a library's \`./lib/ui.js\` import has to find \`ui.ts\`.
module.exports = withSolidNative(withNxMetro(getDefaultConfig(__dirname)));
`;

/**
 * @param {string | undefined} workspaceBase the workspace's `tsconfig.base.json`, relative to the
 *   app, when there is one to take path aliases from
 */
function tsconfig(workspaceBase, conditions = []) {
  // The template's own: Solid's JSX, typed against the native renderer.
  const compilerOptions = {
    strict: true,
    allowImportingTsExtensions: true,
    jsx: 'preserve',
    jsxImportSource: '@solidnative/platform/solid',
    types: ['node'],
  };
  if (!workspaceBase) {
    // The workspace's custom conditions, which a library in Nx's TypeScript preset exports its
    // source under; the Metro preset reads them from here too, and the test target passes them to
    // Node. Beside Expo's own `react-native`, which setting the option would otherwise replace.
    const extra = conditions.filter((c) => c !== 'react-native');
    if (extra.length) compilerOptions.customConditions = ['react-native', ...extra];
    return { extends: 'expo/tsconfig.base', compilerOptions };
  }
  // The workspace's base is written for a web build or for emitting declarations, and wins over
  // Expo's where they overlap. These are Expo's, restored: without `DOM` and `ESNext` the framework
  // packages' own source, which the app compiles, fails to typecheck.
  return {
    extends: ['expo/tsconfig.base', workspaceBase],
    compilerOptions: {
      ...compilerOptions,
      noEmit: true,
      lib: ['DOM', 'ESNext'],
      target: 'ESNext',
      module: 'preserve',
      moduleResolution: 'bundler',
      customConditions: ['react-native'],
      composite: false,
      declaration: false,
      emitDeclarationOnly: false,
    },
  };
}

/**
 * The app's own `test-register.mjs` when there is a workspace base: the template's compile hook,
 * `@solidnative/testing/register`, and a resolve hook for the workspace's tsconfig path aliases, so a
 * test can import a library the way Metro and tsc do. Without a base there are no aliases, the app
 * runs the template's command as it is, and there is no file to write.
 *
 * @param {string | undefined} workspaceBase the workspace's `tsconfig.base.json`, relative to the app
 * @returns {string | undefined}
 */
function testRegister(workspaceBase) {
  if (!workspaceBase) return undefined;
  return `// The template's compile hook for Node's test runner, and the workspace's tsconfig path aliases,
// which Node does not read. Registered after it, the alias hook resolves first. The first target of
// each alias wins.
import '@solidnative/testing/register';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const base = new URL(${JSON.stringify(workspaceBase)}, import.meta.url);
const tsconfig = JSON.parse(readFileSync(base, 'utf8')).compilerOptions ?? {};
const paths = Object.entries(tsconfig.paths ?? {});
const from = new URL((tsconfig.baseUrl ?? '.').replace(/\\/?$/, '/'), base);

function alias(specifier) {
  for (const [pattern, [target]] of paths) {
    const [prefix, suffix = ''] = pattern.split('*');
    const wild = pattern.includes('*');
    if (wild ? !specifier.startsWith(prefix) || !specifier.endsWith(suffix) : specifier !== pattern)
      continue;
    const rest = wild ? specifier.slice(prefix.length, specifier.length - suffix.length) : '';
    return new URL(target.replace('*', rest), from).href;
  }
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(alias(specifier) ?? specifier, context);
  },
});
`;
}

/**
 * The template's test command, or, with a workspace base, the same command through the app's own
 * `test-register.mjs` (see `testRegister`).
 *
 * @param {string | undefined} workspaceBase
 */
function testCommand(workspaceBase) {
  return workspaceBase
    ? COMMANDS.test.replace('@solidnative/testing/register', './test-register.mjs')
    : COMMANDS.test;
}

/**
 * The dependencies an integrated workspace's app lists in its own `package.json`, at the ranges
 * the root installs, though nothing installs from it.
 *
 * All of them, because Expo's autolinking links the native modules the app's `package.json` names
 * and no others: without `react-native-safe-area-context` here, Android crashed on RNCSafeAreaView.
 * And `expo prebuild`, which `expo run:ios` starts with, adds `expo`, `react` or `react-native` if
 * it does not find them and then offers to install them into the app's directory, which would put a
 * second copy of React Native beside the root's.
 *
 * @param {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} root
 */
function prebuildPins(root) {
  const installed = { ...root.devDependencies, ...root.dependencies };
  return Object.fromEntries(
    Object.keys(dependencies).map((pkg) => [pkg, installed[pkg] ?? dependencies[pkg]]),
  );
}

/**
 * Where what a workspace already has can be older than what a new app is given: any Node types
 * recent enough for `node:test` do for the typecheck, and a workspace pins its own.
 */
const accepted = { '@types/node': '>=22.0.0' };

/**
 * Why an existing dependency would stop this app installing or running, as a sentence each.
 *
 * Only ranges already in the manifest are judged, and only a range that cannot overlap the one
 * wanted is a conflict: `~6.0.2` and `~6.0.3` resolve to the same TypeScript. A missing package is
 * added at the version above. Nothing is rewritten, because moving a workspace's React Native or
 * TypeScript is an upgrade of every project in it, and that belongs to `nx migrate`, not to a generator.
 *
 * @param {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} manifest
 * @returns {string[]}
 */
function conflicts(manifest) {
  const existing = { ...manifest.dependencies, ...manifest.devDependencies };
  const problems = [];
  for (const [name, installed] of Object.entries({ ...dependencies, ...devDependencies })) {
    const range = existing[name];
    const wanted = accepted[name] ?? installed;
    if (!range || name.startsWith('@solidnative/')) continue;
    if (semver.validRange(range) && !semver.intersects(range, wanted)) {
      problems.push(
        `${name} is ${range} here, and solidnative needs ${wanted}. ` +
          `npm will refuse the install until it is moved.`,
      );
    }
  }
  return problems;
}

module.exports = {
  dependencies,
  devDependencies,
  COMMANDS,
  SOURCE_FILES,
  sourceFile,
  agentsFile,
  appJson,
  METRO_CONFIG,
  tsconfig,
  testRegister,
  testCommand,
  prebuildPins,
  expoCompanions,
  conflicts,
  accepted,
};
