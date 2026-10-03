const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const transformer = require('./solid-transformer.cjs');
const expo = require('@expo/metro-config/build/babel-transformer');

test('documented per-file Expo override disables native Solid React Refresh while preserving React defaults', () => {
  const projectRoot = fs.mkdtempSync('/private/tmp/native-solid-expo-dev-');
  try {
    const expoRequire = createRequire(require.resolve('@expo/metro-config/package.json'));
    const preset = expoRequire.resolve('expo/internal/babel-preset');
    const helper = require.resolve('./solid-babel.cjs');
    fs.writeFileSync(
      path.join(projectRoot, 'babel.config.cjs'),
      `
      const { isSolidFile } = require(${JSON.stringify(helper)});
      module.exports = {
        presets: [${JSON.stringify(preset)}],
        overrides: [{ test: isSolidFile, presets: [[${JSON.stringify(preset)}, { enableReactFastRefresh: false }]] }],
      };
    `,
    );
    const src =
      '/** @jsxImportSource @solidnative/platform/solid */\nexport function NativeView() { return <view><text>native dev</text></view>; }';
    const filename = path.join(projectRoot, 'NativeView.tsx');
    fs.writeFileSync(filename, src);
    const options = {
      projectRoot,
      dev: true,
      platform: 'ios',
      type: 'module',
      experimentalImportSupport: true,
      enableBabelRCLookup: true,
      minify: false,
    };
    const result = transformer.transform({ src, filename, options, plugins: [] });
    const code = babel.transformFromAstSync(result.ast, undefined, {
      babelrc: false,
      configFile: false,
    }).code;
    assert.match(code, /@solidnative\/platform\/solid/);
    assert.doesNotMatch(code, /\$Refresh|react\/jsx-runtime|solid-js\/web/);

    const react = {
      filename: path.join(projectRoot, 'ReactView.tsx'),
      src: 'export function ReactView() { return <View />; }',
      options,
      plugins: [],
    };
    fs.writeFileSync(react.filename, react.src);
    const untouched = transformer.transform(react);
    assert.deepEqual(untouched, expo.transform(react));
    const reactCode = babel.transformFromAstSync(untouched.ast, undefined, {
      babelrc: false,
      configFile: false,
    }).code;
    assert.match(reactCode, /\$RefreshReg\$/);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("the toolkit's own plain helpers are Solid files; an app's plain helper keeps Expo defaults", () => {
  const { isSolidFile } = require('./solid-babel.cjs');
  // Imports neither solid-js nor a `/solid` entry, and exports capitalised builders.
  assert.equal(isSolidFile(path.join(__dirname, '../components/src/solid/gestures.ts')), true);
  assert.equal(isSolidFile(path.join(__dirname, '../fabric/src/css.ts')), true);
  const projectRoot = fs.mkdtempSync('/private/tmp/native-solid-plain-');
  try {
    const plain = path.join(projectRoot, 'src', 'format.ts');
    fs.mkdirSync(path.dirname(plain));
    fs.writeFileSync(plain, 'export const Format = (n: number) => String(n);\n');
    assert.equal(isSolidFile(plain), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
