const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const vm = require('node:vm');
const { compileCss } = require('./css/compile.cjs');
const { transformNativeCss, isNativeCss } = require('./solid-css.cjs');
const { withSolidNative } = require('./solid-config.cjs');
const { transformSolid } = require('./solid-transform.cjs');
const { getDefaultConfig } = require('@expo/metro-config');

const projectRoot = path.resolve(__dirname, '../../examples/canary');
const filename = 'src/theme.native.css';
const css = ':host { --ink: red; padding: 12px } .label { color: var(--ink); font-size: 18px }';
const options = {
  dev: false,
  platform: 'ios',
  type: 'module',
  minify: false,
  experimentalImportSupport: false,
  inlineRequires: false,
  unstable_transformProfile: 'default',
};

test('native CSS is explicit stylesheet data in the existing engine format, with visible diagnostics', () => {
  assert.equal(isNativeCss(filename), true);
  for (const file of ['theme.css', 'theme.module.css', 'theme.scss'])
    assert.equal(isNativeCss(file), false);
  const result = transformNativeCss(css, filename, options);
  const sheet = vm.runInNewContext(
    `(${result.code.replace('export default', '').replace(/;$/, '')})`,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(sheet)),
    compileCss(css, filename, { platform: 'ios' }),
  );
  const warnings = [];
  const warned = transformNativeCss('.label { float: left; opacity: 0.5 }', filename, {
    ...options,
    onUnsupported: (message) => warnings.push(message),
  });
  assert.ok(warnings.some((message) => message.includes(filename) && message.includes('float')));
  assert.match(warned.code, /opacity/);
  assert.throws(() => transformNativeCss('.label { color: rgb( }', filename, options));
  assert.throws(() => transformNativeCss(css, filename, { platform: 'web' }), /native stylesheet/);
});

test('font assets stay static Metro dependencies and stylesheet import stays a source graph edge', () => {
  const result = transformNativeCss(
    '@font-face { font-family: Demo; src: url("./demo.ttf") }',
    filename,
    options,
  );
  assert.match(result.code, /require\("\.\/demo.ttf"\)/);
  const compiled = transformSolid(
    'import sheet from "./theme.native.css"; export const View = () => <view />; export { sheet };',
    'src/View.solid.tsx',
    options,
  );
  assert.match(compiled.code, /import sheet from "\.\/theme.native.css"/);
});

test('real Expo worker compiles explicit native CSS in development and release, preserves ordinary CSS', async () => {
  const base = getDefaultConfig(projectRoot);
  const config = withSolidNative(base);
  assert.notEqual(config.transformerPath, base.transformerPath);
  assert.ok(config.resolver.sourceExts.includes('css'));
  const worker = require(config.transformerPath);
  for (const dev of [false, true]) {
    const result = await worker.transform(
      config.transformer,
      projectRoot,
      filename,
      Buffer.from(css),
      { ...options, dev },
    );
    const output = result.output[0].data.code;
    assert.match(output, /fontSize/);
    assert.match(output, /18/);
    assert.doesNotMatch(output, /solid-js\/web|\$RefreshReg\$/);
    const ordinary = await worker.transform(
      config.transformer,
      projectRoot,
      'src/theme.css',
      Buffer.from(css),
      { ...options, dev },
    );
    assert.deepEqual(
      ordinary,
      await require(base.transformerPath).transform(
        config.transformer,
        projectRoot,
        'src/theme.css',
        Buffer.from(css),
        { ...options, dev },
      ),
    );
  }
  const font = await worker.transform(
    config.transformer,
    projectRoot,
    filename,
    Buffer.from('@font-face { font-family: Demo; src: url("./demo.ttf") }'),
    options,
  );
  assert.ok(font.dependencies.some((entry) => entry.name === './demo.ttf'));
  const updated = await worker.transform(
    config.transformer,
    projectRoot,
    filename,
    Buffer.from(css.replace('18px', '22px')),
    options,
  );
  assert.match(updated.output[0].data.code, /22/);
  const source =
    'import sheet from "./theme.native.css"; export const View = () => <view />; export { sheet };';
  const compiled = await worker.transform(
    config.transformer,
    projectRoot,
    'src/View.solid.tsx',
    Buffer.from(source),
    options,
  );
  assert.ok(compiled.dependencies.some((entry) => entry.name === './theme.native.css'));
  assert.doesNotMatch(compiled.output[0].data.code, /fontSize|18/);
  const webOptions = { ...options, platform: 'web' };
  const web = await worker.transform(
    config.transformer,
    projectRoot,
    filename,
    Buffer.from(css),
    webOptions,
  );
  assert.deepEqual(
    web,
    await require(base.transformerPath).transform(
      config.transformer,
      projectRoot,
      filename,
      Buffer.from(css),
      webOptions,
    ),
  );
  assert.throws(
    () =>
      worker.transform(config.transformer, projectRoot, filename, Buffer.from(css), {
        ...options,
        dev: true,
        customTransformOptions: { optimize: true },
      }),
    /requires Metro module wrapping/,
  );
});
