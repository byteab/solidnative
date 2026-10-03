const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const worker = require('@expo/metro-config/build/transform-worker/metro-transform-worker');
const { registerModule } = require('./solid-reload-runtime.cjs');

const expoRequire = createRequire(require.resolve('@expo/metro-config/package.json'));
const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'));
const runtimePaths = [
  cliRequire.resolve('metro-runtime/src/polyfills/require'),
  path.join(path.dirname(cliRequire.resolve('./package.json')), 'build/metro-require/require.js'),
];

const projectRoot = fs.mkdtempSync('/private/tmp/native-solid-reload-');
after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
function setup() {
  const preset = expoRequire.resolve('expo/internal/babel-preset');
  fs.writeFileSync(
    path.join(projectRoot, 'babel.config.cjs'),
    `module.exports = {
    presets: [${JSON.stringify(preset)}],
    overrides: [{ test: require(${JSON.stringify(require.resolve('./solid-babel.cjs'))}).isSolidFile,
      presets: [[${JSON.stringify(preset)}, { enableReactFastRefresh: false }]] }],
  };`,
  );
  return async (source, experimentalImportSupport = true, dev = true, extra = {}) => {
    const { filename: basename = 'App.solid.tsx', ...optionOverrides } = extra;
    const filename = path.join(projectRoot, basename);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, source);
    return worker.transform(
      {
        babelTransformerPath: require.resolve('./solid-transformer.cjs'),
        enableBabelRCLookup: true,
        enableBabelRuntime: false,
        asyncRequireModulePath: expoRequire.resolve('metro-runtime/src/modules/asyncRequire'),
        dynamicDepsInPackages: 'reject',
        globalPrefix: '',
        unstable_renameRequire: false,
      },
      projectRoot,
      filename,
      Buffer.from(source),
      {
        dev,
        platform: 'ios',
        type: 'module',
        minify: false,
        experimentalImportSupport,
        inlineRequires: false,
        ...optionOverrides,
      },
    );
  };
}

function runtime(runtimePath) {
  const events = [];
  const timers = [];
  let pending = false;
  const registry = {
    isNativeReloadPending: () => pending,
    disposeNativeRootsForReload() {
      if (pending) return false;
      pending = true;
      events.push('dispose roots');
      return true;
    },
  };
  const context = vm.createContext({
    __DEV__: true,
    __METRO_GLOBAL_PREFIX__: '',
    console,
    setTimeout: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
    __ReactRefresh: {
      register() {},
      isLikelyComponentType: () => true,
      getFamilyByType: () => null,
      performFullRefresh: () => events.push('unexpected React full refresh'),
      performReactRefresh: () => events.push('upstream React refresh bookkeeping'),
    },
    evaluate: () => events.push('author body'),
    record: (message) => events.push(message),
  });
  context.global = context;
  vm.runInContext(fs.readFileSync(runtimePath, 'utf8'), context, { filename: runtimePath });
  const deps = {
    '@solid-native/metro/solid-reload-runtime.cjs': { registerModule },
    '@solid-native/platform/solid/dev-reload': registry,
    'react-native': { DevSettings: { reload: () => events.push('native reload') } },
    'author-dependency': {},
    './demo.ttf': 42,
    '@solid-native/platform/solid': { createElement: () => ({}) },
  };
  const ids = new Map();
  let nextId = 100;
  for (const [name, value] of Object.entries(deps)) {
    const id = nextId++;
    ids.set(name, id);
    context.__d(
      (_global, _require, _importDefault, _importAll, module) => {
        if (name === 'author-dependency' || name === './demo.ttf') events.push('author dependency');
        module.exports = value;
      },
      id,
      [],
      name,
    );
  }
  ids.set('./helper.solid.ts', 2);
  ids.set('./helper.solid.js', 2);
  ids.set('./theme.native.css', 3);
  function define(result, inverseDependencies, moduleId = 1) {
    const factoryContext = vm.createContext({
      __d(factory) {
        context.__d(
          factory,
          moduleId,
          result.dependencies.map((dep) => ids.get(dep.name)),
          'App.solid.tsx',
          inverseDependencies,
        );
      },
    });
    vm.runInContext(result.output[0].data.code, factoryContext);
  }
  return {
    context,
    events,
    define,
    flushTimers() {
      timers.splice(0).forEach((callback) => callback());
    },
  };
}

for (const runtimePath of runtimePaths) {
  for (const experimentalImportSupport of [true, false]) {
    test(`actual ${runtimePath.includes('metro-require') ? 'Expo' : 'Metro'} module update skips author code and new imports (${experimentalImportSupport})`, async (t) => {
      const compile = setup(t);
      const initial = await compile(
        'global.evaluate(); export default function NativeView() { return <view />; }',
        experimentalImportSupport,
      );
      const replacement = await compile(
        'import "author-dependency"; global.evaluate(); export default function NativeView() { return <view />; }',
        experimentalImportSupport,
      );
      const host = runtime(runtimePath);
      host.define(initial);
      host.context.__r(1);
      assert.deepEqual(host.events, ['author body']);
      await assert.rejects(
        () => compile('export default () => <view>', experimentalImportSupport),
        /Unexpected token|Unterminated JSX/,
      );
      assert.deepEqual(host.events, ['author body'], 'compile failure leaves the old module live');
      assert.equal(typeof host.context.__r.getModules().get(1).hot.decline, 'undefined');
      host.define(replacement, { 1: [] });
      host.define(replacement, { 1: [] });
      assert.deepEqual(host.events, ['author body', 'dispose roots', 'native reload']);
      host.flushTimers();
      assert.deepEqual(host.events, [
        'author body',
        'dispose roots',
        'native reload',
        'upstream React refresh bookkeeping',
      ]);
    });
  }
}

test('native release worker output has no reload helper or dev registry dependency', async (t) => {
  const compile = setup(t);
  const result = await compile(
    'export default function NativeView() { return <view />; }',
    true,
    false,
  );
  assert.doesNotMatch(
    result.output[0].data.code,
    /solid-reload|dev-reload|registerModule|DevSettings/,
  );
  assert.ok(result.dependencies.every((dep) => !/reload|react-native/.test(dep.name)));
});

test('reload failure keeps the old VM guarded and contains reporter errors', () => {
  assert.equal(
    registerModule({}, {}, () => {}, 'no hot'),
    true,
  );
  let pending = false;
  let cleanup = 0;
  let reload = 0;
  const registry = {
    isNativeReloadPending: () => pending,
    disposeNativeRootsForReload() {
      if (pending) return false;
      pending = true;
      cleanup++;
      return true;
    },
  };
  let dispose;
  const module = {
    hot: {
      accept() {},
      dispose(callback) {
        dispose = callback;
      },
    },
  };
  assert.equal(
    registerModule(
      module,
      registry,
      () => {
        reload++;
        throw new Error('unavailable');
      },
      'App',
    ),
    true,
  );
  const oldError = console.error;
  console.error = () => {
    throw new Error('reporter');
  };
  try {
    dispose();
  } finally {
    console.error = oldError;
  }
  assert.equal(
    registerModule(module, registry, () => reload++, 'App'),
    false,
  );
  dispose();
  assert.deepEqual([cleanup, reload], [1, 1]);
});

for (const runtimePath of runtimePaths) {
  test(`explicit non-JSX helper edits reload before evaluation in ${runtimePath.includes('metro-require') ? 'Expo' : 'Metro'}`, async (t) => {
    const compile = setup(t);
    for (const extension of ['ts', 'js']) {
      const filename = `helper.solid.${extension}`;
      const initial = await compile(
        'global.record("helper body"); export const value = 1;',
        true,
        true,
        { filename },
      );
      const next = await compile(
        'import "author-dependency"; global.record("replacement helper"); export const value = 2;',
        true,
        true,
        { filename },
      );
      const app = await compile(
        `import "./${filename}"; global.evaluate(); export default () => <view />;`,
      );
      const host = runtime(runtimePath);
      host.define(initial, undefined, 2);
      host.define(app);
      host.context.__r(1);
      assert.deepEqual(host.events, ['helper body', 'author body']);
      host.define(next, { 2: [1], 1: [] }, 2);
      host.flushTimers();
      assert.deepEqual(host.events, [
        'helper body',
        'author body',
        'dispose roots',
        'native reload',
        'upstream React refresh bookkeeping',
      ]);
    }
  });
  test(`native CSS edit skips new font dependency in ${runtimePath.includes('metro-require') ? 'Expo' : 'Metro'}`, async (t) => {
    const compile = setup(t);
    const initial = await compile('.label { opacity: 0.5 }', true, true, {
      filename: 'theme.native.css',
    });
    const next = await compile(
      '@font-face { font-family: Demo; src: url("./demo.ttf") } .label { opacity: 1 }',
      true,
      true,
      { filename: 'theme.native.css' },
    );
    const app = await compile(
      'import "./theme.native.css"; global.evaluate(); export default () => <view />;',
    );
    const host = runtime(runtimePath);
    host.define(initial, undefined, 3);
    host.define(app);
    host.context.__r(1);
    assert.deepEqual(host.events, ['author body']);
    host.define(next, { 3: [1], 1: [] }, 3);
    host.flushTimers();
    assert.deepEqual(host.events, [
      'author body',
      'dispose roots',
      'native reload',
      'upstream React refresh bookkeeping',
    ]);
  });
}

test('helpers delegate syntax to Expo in release/web and React/dependency sources keep Expo ownership', async (t) => {
  const compile = setup(t);
  const transformer = require('./solid-transformer.cjs');
  const expo = require('@expo/metro-config/build/babel-transformer');
  for (const [basename, source, platform, dev] of [
    ['helper.solid.ts', 'export const value: number = 1;', 'ios', false],
    ['helper.solid.js', 'export const value = 1;', 'web', true],
    ['Plain.ts', 'export const value: number = 1;', 'ios', true],
    [
      'Plain.ts',
      '/** @jsxImportSource @solid-native/platform/solid */ export const value = 1;',
      'ios',
      true,
    ],
    ['React.tsx', 'export function ReactView() { return <View />; }', 'ios', true],
    ['node_modules/library/helper.solid.ts', 'export const value: number = 1;', 'ios', true],
  ]) {
    const filename = path.join(projectRoot, basename);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, source);
    const params = {
      filename,
      src: source,
      plugins: [],
      options: {
        projectRoot,
        dev,
        platform,
        type: 'module',
        minify: false,
        experimentalImportSupport: true,
        enableBabelRCLookup: true,
      },
    };
    assert.deepEqual(transformer.transform(params), expo.transform(params));
  }
  const release = await compile('export const value: number = 1;', true, false, {
    filename: 'helper.solid.ts',
  });
  assert.doesNotMatch(release.output[0].data.code, /solid-reload|dev-reload|DevSettings/);
});

test('a plain .ts module importing Solid keeps React Refresh off; a React one keeps it on', async (t) => {
  const compile = setup(t);
  const solid = await compile(
    "import { createSignal } from 'solid-js';\nexport function Switch() { const [on] = createSignal(false); return on; }",
    true,
    true,
    { filename: 'switch.ts' },
  );
  assert.doesNotMatch(solid.output[0].data.code, /\$RefreshReg\$|\$RefreshSig\$/);
  const scoped = await compile(
    "import { useNative } from '@solid-native/device/solid';\nexport function Service() { return useNative(); }",
    true,
    true,
    { filename: 'service.ts' },
  );
  assert.doesNotMatch(scoped.output[0].data.code, /\$RefreshReg\$/);
  const react = await compile(
    "import { useState } from 'react';\nexport function Counter() { const [n] = useState(0); return n; }",
    true,
    true,
    { filename: 'counter.ts' },
  );
  assert.match(react.output[0].data.code, /\$RefreshReg\$/);
});
