const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const babel = require('@babel/core');
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const { transformSolid, isSolidSource } = require('./solid-transform.cjs');
const transformer = require('./solid-transformer.cjs');
const expo = require('@expo/metro-config/build/babel-transformer');
const { withSolidNative } = require('./solid-config.cjs');
const { createSolidRuntime } = require('./solid-runtime.cjs');
const { solidCompilerFingerprint } = require('./solid-cache.cjs');

const projectRoot = path.resolve(__dirname, '../platform');
const filename = path.join(projectRoot, 'solid-tests/probe.solid.tsx');
const source = `/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import type { EngineNode } from '@solidnative/fabric';
type Count = number;
export const [count, setCount] = createSignal<Count>(0);
export function Probe() {
  const label: string = 'authored-marker';
  return <view testID="probe"><text>{label}: {count()}</text></view>;
}
export function drive(value: number) {
  'worklet';
  return value + 1;
}`;
const options = {
  projectRoot,
  dev: false,
  platform: 'ios',
  type: 'module',
  experimentalImportSupport: true,
  enableBabelRCLookup: false,
  minify: false,
};

function generated(ast) {
  return babel.transformFromAstSync(ast, undefined, {
    babelrc: false,
    configFile: false,
    ast: false,
    code: true,
  }).code;
}
function namedString(ast, value) {
  let found;
  babel.traverse(ast, {
    StringLiteral(at) {
      if (at.node.value === value) found = at.node;
    },
  });
  assert.ok(found, `AST string ${value} exists`);
  return found;
}

test('universal compiler emits plain ESM custom helpers, native maps and preserved worklet directives', () => {
  const result = transformSolid(source, filename, { platform: 'ios' });
  assert.match(result.code, /from "@solidnative\/platform\/solid"/);
  assert.doesNotMatch(result.code, /solid-js\/web|React|import type|type Count|: number|<view/);
  assert.match(result.code, /['"]worklet['"]/);
  assert.match(result.code, /export function drive/);
  const ast = babel.parseSync(result.code, { babelrc: false, configFile: false });
  const marker = namedString(ast, 'authored-marker');
  const original = originalPositionFor(new TraceMap(result.map), marker.loc.start);
  assert.equal(original.line, 7);
  assert.equal(original.column, source.split('\n')[6].indexOf("'authored-marker'"));
  assert.deepEqual(result.map.sourcesContent, [source]);
  assert.throws(() => transformSolid(source, filename, { platform: 'web' }), /cannot target web/);
});

test('only explicit author JSX opts in; React, Flow, dependencies and pragma-like strings are excluded', () => {
  assert.equal(isSolidSource(source, '/app/Screen.tsx'), true);
  assert.equal(isSolidSource('<view />', '/app/Screen.solid.tsx'), true);
  assert.equal(
    isSolidSource('// @jsxImportSource @solidnative/platform/solid\n<view />', '/app/Screen.jsx'),
    true,
  );
  for (const file of [
    '/app/node_modules/lib/Screen.solid.tsx',
    'C:\\app\\node_modules\\lib\\Screen.solid.jsx',
    '/app/Screen.ts',
    '/app/Screen.js',
  ])
    assert.equal(isSolidSource(source, file), false, file);
  assert.equal(isSolidSource('export const x = <View />;', '/app/Screen.tsx'), false);
  assert.equal(
    isSolidSource(
      'const marker = "/* @jsxImportSource @solidnative/platform/solid */";',
      '/app/Screen.tsx',
    ),
    false,
  );
  assert.equal(
    isSolidSource(
      '/** @jsxImportSource @solidnative/platform/solid-extra */\n<view />',
      '/app/Screen.tsx',
    ),
    false,
  );
});

test('actual Expo delegation retains authored TSX locations and applies downstream plugins', () => {
  const plugins = [
    () => ({
      visitor: {
        StringLiteral(at) {
          if (at.node.value === 'authored-marker') at.node.value = 'downstream-marker';
        },
      },
    }),
  ];
  const result = transformer.transform({ src: source, filename, options, plugins });
  const marker = namedString(result.ast, 'downstream-marker');
  assert.equal(marker.loc.start.line, 7);
  assert.equal(marker.loc.start.column, source.split('\n')[6].indexOf("'authored-marker'"));
  assert.equal(marker.loc.filename, filename);
  assert.match(generated(result.ast), /@solidnative\/platform\/solid/);
  assert.doesNotMatch(generated(result.ast), /solid-js\/web|react\/jsx-runtime/);
});

test('actual Expo receives untouched React JSX and React Native Flow; web Solid fails explicitly', () => {
  const inputs = [
    {
      filename: path.join(projectRoot, 'ReactScreen.tsx'),
      src: 'export function ReactScreen() { return <View testID="react" />; }',
    },
    {
      filename: path.join(projectRoot, 'node_modules/upstream/Flow.jsx'),
      src: '// @flow\nexport const data: {| value: number |} = { value: 1 }; export const render = () => <View />;',
    },
    { filename: path.join(projectRoot, 'node_modules/upstream/Source.solid.tsx'), src: source },
  ];
  for (const input of inputs) {
    const params = { ...input, options, plugins: [] };
    assert.deepEqual(transformer.transform(params), expo.transform(params), input.filename);
  }
  assert.throws(
    () =>
      transformer.transform({
        src: source,
        filename,
        options: { ...options, platform: 'web' },
        plugins: [],
      }),
    /cannot target web/,
  );
  const bad =
    '/** @jsxImportSource @solidnative/platform/solid */\nexport const Broken = () => <view>';
  assert.throws(
    () => transformer.transform({ src: bad, filename, options }),
    (error) => error.loc?.line === 2,
  );
});

test('default Expo development React Refresh fails visibly for native Solid', () => {
  // The guard is independent of Worklets' development source-file lookup.
  const noWorklet = source.slice(0, source.indexOf('export function drive'));
  assert.throws(
    () =>
      transformer.transform({
        src: noWorklet,
        filename,
        options: { ...options, dev: true },
        plugins: [],
      }),
    /Native Solid cannot use React Refresh/,
  );
});

test('native Metro resolver canonicalizes signal/store/universal including internal requests and preserves upstream resolution', () => {
  const seen = [];
  const originalResolve = (context, name, platform) => {
    seen.push([context.originModulePath, name, platform]);
    if (name.endsWith('.js')) throw new Error('source extension needed');
    return { type: 'sourceFile', filePath: `/upstream/${name}` };
  };
  const base = {
    projectRoot,
    resolver: {
      sourceExts: ['js', 'ts'],
      assetExts: ['png', 'css'],
      unstable_conditionNames: ['worker', 'development'],
      resolveRequest: originalResolve,
    },
    transformer: { cacheVersion: 'existing', custom: 'kept' },
    transformerPath: '/expo/worker.js',
    serializer: { marker: 'kept' },
  };
  const config = withSolidNative(base, { workspaceRoot: path.resolve(__dirname, '../..') });
  const runtime = createSolidRuntime(projectRoot);
  for (const originModulePath of [
    '/app/main.solid.tsx',
    runtime.resolve('solid-js/store'),
    runtime.resolve('solid-js/universal'),
  ]) {
    for (const name of ['solid-js', 'solid-js/store', 'solid-js/universal'])
      assert.deepEqual(config.resolver.resolveRequest({ originModulePath }, name, 'ios'), {
        type: 'sourceFile',
        filePath: runtime.resolve(name),
      });
  }
  assert.equal(seen.length, 0);
  assert.throws(
    () => config.resolver.resolveRequest({}, 'solid-js/web', 'ios'),
    /not a native host runtime/,
  );
  assert.deepEqual(config.resolver.resolveRequest({}, 'react', 'ios'), {
    type: 'sourceFile',
    filePath: '/upstream/react',
  });
  assert.deepEqual(config.resolver.resolveRequest({}, 'solid-js', 'web'), {
    type: 'sourceFile',
    filePath: '/upstream/solid-js',
  });
  assert.deepEqual(config.resolver.resolveRequest({}, './widget.js', 'ios'), {
    type: 'sourceFile',
    filePath: '/upstream/./widget',
  });
  assert.equal(base.resolver.resolveRequest, originalResolve);
  assert.deepEqual(base.resolver.sourceExts, ['js', 'ts']);
  assert.deepEqual(config.resolver.sourceExts, ['js', 'ts', 'tsx', 'jsx', 'css']);
  assert.equal(config.transformerPath, base.transformerPath);
  assert.equal(config.serializer, base.serializer);
  assert.deepEqual(config.resolver.assetExts, ['png']);
  assert.match(config.transformer.cacheVersion, /existing-.*solid-js:1\.9\.15:production-client/);
  assert.ok(config.transformer.cacheVersion.includes(solidCompilerFingerprint()));
  assert.ok(
    transformer
      .getCacheKey({ projectRoot, enableBabelRCLookup: false })
      .includes(solidCompilerFingerprint()),
  );
});

test('runtime selection requires the application dependency', () => {
  const empty = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'native-solid-no-dependency-'),
  );
  try {
    assert.throws(() => createSolidRuntime(empty), /Cannot find module 'solid-js\/package.json'/);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test('Solid transformer inlines named lucide-static imports so the package never enters the graph', () => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'solid-icons-'));
  const set = path.join(dir, 'node_modules', 'lucide-static');
  fs.mkdirSync(path.join(set, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(set, 'package.json'), '{"name":"lucide-static","module":"index.mjs"}');
  fs.writeFileSync(
    path.join(set, 'index.mjs'),
    "export { default as FakeStar } from './icons/star.mjs';\nexport { default as FakeUnused } from './icons/unused.mjs';\n",
  );
  fs.writeFileSync(
    path.join(set, 'icons', 'star.mjs'),
    'const FakeStar = `\n<svg>\n  star\n</svg>\n`;\n\nexport { FakeStar as default };\n',
  );
  fs.writeFileSync(
    path.join(set, 'icons', 'unused.mjs'),
    'const FakeUnused = `<svg>unused</svg>`;\n',
  );
  try {
    const src = `import {
  FakeStar,
} from 'lucide-static';
export const Star = () => <svg-icon data={FakeStar} label="star-marker" />;`;
    const file = path.join(dir, 'Star.solid.tsx');
    const result = transformer.transform({ src, filename: file, options, plugins: [] });
    const code = generated(result.ast);
    assert.doesNotMatch(code, /lucide-static/);
    assert.match(code, /<svg> star <\/svg>/);
    assert.doesNotMatch(code, /unused/);
    assert.equal(
      namedString(result.ast, 'star-marker').loc.start.line,
      4,
      'lines after a multi-line import keep their number',
    );
    const helper = transformer.transform({
      src: "import { FakeStar } from 'lucide-static';\nexport const icon = FakeStar;\n",
      filename: path.join(dir, 'icons.ts'),
      options,
      plugins: [],
    });
    assert.doesNotMatch(generated(helper.ast), /lucide-static/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('plain View and Text lower to intrinsics; anything the components act on stays one', () => {
  const lowered = (jsx, platform = 'ios', extra = {}) =>
    transformSolid(
      `/** @jsxImportSource @solidnative/platform/solid */
import { View, Text as Label } from '@solidnative/components/solid';
export const A = (p) => ${jsx};`,
      'lower.tsx',
      { platform, ...extra },
    ).code;
  const plain = lowered('<View style={p.s} onLayout={p.f}><Label style={p.t}>{p.a}</Label></View>');
  assert.match(plain, /createElement\("view"\)/);
  assert.match(plain, /createElement\("text"\)/);
  assert.match(plain, /setProp\(_el\$2, "accessible", true\)/);
  assert.doesNotMatch(plain, /createComponent/);
  assert.match(lowered('<Label>x</Label>', 'android'), /"accessible", false/);
  for (const kept of [
    '<View ref={p.r} />',
    '<View {...p} />',
    '<View id="x" />',
    '<View aria-label="x" />',
    '<View accessibilityState={p.s} />',
    '<Label onPress={p.f}>x</Label>',
    '<Label disabled>x</Label>',
    '<Label accessible={false}>x</Label>',
  ])
    assert.match(lowered(kept), /createComponent/, kept);
  assert.match(lowered('<Label>x</Label>', null), /createComponent/, 'Text needs a platform');
  assert.match(lowered('<View />', 'ios', { lowerPrimitives: false }), /createComponent/);
});
