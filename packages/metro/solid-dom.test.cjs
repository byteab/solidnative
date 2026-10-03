const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const babel = require('@babel/core');
const {
  isSolidDomComponent,
  isSolidDomSource,
  transformSolidDom,
  solidDomPage,
} = require('./solid-dom.cjs');
const transformer = require('./solid-transformer.cjs');
const expo = require('@expo/metro-config/build/babel-transformer');
const { getDefaultConfig } = require('@expo/metro-config');
const { withSolidNative } = require('./solid-config.cjs');

const source = `'use dom';
import { mountInWebView as mount } from '@solidnative/web/solid/web-view';
function Signature(props: {name: string}) { return <div>{props.name}</div>; }
export default mount(Signature);`;
const projectRoot = path.resolve(__dirname, '../platform');
const filename = path.join(projectRoot, 'signature.dom.tsx');
const options = {
  projectRoot,
  dev: false,
  platform: 'ios',
  type: 'module',
  experimentalImportSupport: true,
  enableBabelRCLookup: false,
  minify: false,
};
const generated = (ast) =>
  babel.transformFromAstSync(ast, undefined, { babelrc: false, configFile: false }).code;

test('only explicit Solid DOM author files use the browser compiler', () => {
  assert.equal(isSolidDomSource(source, filename), true);
  assert.equal(
    isSolidDomSource('/** @jsxImportSource solid-js */\n<div />', '/app/view.tsx'),
    true,
  );
  assert.equal(isSolidDomComponent(source), true);
  for (const text of [
    `'use dom'; export default function ReactView() { return <div />; }`,
    `const quoted = "use dom @solidnative/web/solid/web-view";`,
    source.replace("'use dom';", 'const first = 0;'),
  ])
    assert.equal(isSolidDomComponent(text), false);
  assert.equal(isSolidDomSource(source, '/app/node_modules/library/page.dom.tsx'), false);
  assert.equal(
    isSolidDomSource('const marker="@jsxImportSource solid-js";', '/app/page.tsx'),
    false,
  );
});

test('native DOM lowering retains exact Expo page metadata and excludes all page runtime', () => {
  for (const dev of [false, true]) {
    const result = transformer.transform({
      src: source,
      filename,
      options: { ...options, dev },
      plugins: [],
    });
    assert.equal(result.metadata.expoDomComponentReference, pathToFileURL(filename).href);
    const code = generated(result.ast);
    assert.match(code, /domComponent/);
    assert.match(code, dev ? /signature\.dom\.tsx\?file=/ : /[a-f\d]{32}\.html/);
    assert.doesNotMatch(code, /solid-js|React|Signature|mountInWebView|use dom|\$Refresh/);
  }
});

test('web DOM compilation removes Expo React directive and retains reactive DOM output/source map', () => {
  const compiled = transformSolidDom(source, filename);
  assert.match(compiled.code, /solid-js\/web/);
  assert.match(compiled.code, /props.name/);
  assert.doesNotMatch(compiled.code, /use dom|react\/|@solidnative\/platform|delegateEvents/);
  assert.deepEqual(compiled.map.sourcesContent, [source]);
  const result = transformer.transform({
    src: source,
    filename,
    options: { ...options, platform: 'web' },
    plugins: [],
  });
  assert.match(generated(result.ast), /solid-js\/web/);
  assert.doesNotMatch(generated(result.ast), /react\/jsx|registerRootComponent/);
  assert.throws(
    () =>
      transformer.transform({
        src: 'export const View=()=> <div />;',
        filename,
        options,
        plugins: [],
      }),
    /DOM helpers/,
  );
});

test('upstream React DOM pages retain the exact Expo transform', () => {
  const params = {
    src: "'use dom'; export default function Page() { return <div />; }",
    filename: path.join(projectRoot, 'Page.tsx'),
    options,
    plugins: [],
  };
  assert.deepEqual(transformer.transform(params), expo.transform(params));
});

test('Expo generated Solid page entry mounts itself and passes early errors without React', () => {
  const dir = fs.mkdtempSync('/private/tmp/solid-native-g12-dom-');
  try {
    const entry = path.join(dir, 'expo/dom/entry.js');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    const target = path.join(dir, 'signature.dom.tsx');
    fs.writeFileSync(target, source);
    const relative = path.relative(path.dirname(entry), target);
    const data = solidDomPage(entry, {
      platform: 'web',
      customTransformOptions: { dom: encodeURI(relative) },
    });
    assert.ok(data);
    assert.match(data.toString(), /__solidNativeEarlyCleanup/);
    assert.ok(data.toString().includes(`require(${JSON.stringify(relative)})`));
    assert.doesNotMatch(data.toString(), /registerRootComponent|react\//);
    assert.equal(
      solidDomPage(entry, { platform: 'ios', customTransformOptions: { dom: relative } }),
      null,
    );
    fs.writeFileSync(target, "'use dom'; export default function Page() { return <div />; }");
    assert.equal(
      solidDomPage(entry, { platform: 'web', customTransformOptions: { dom: relative } }),
      null,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('actual Expo worker replaces a relative Solid DOM entry with owned page bootstrap', async () => {
  const dir = fs.mkdtempSync(path.join(projectRoot, 'solid-dom-worker-'));
  try {
    const entry = path.join(dir, 'expo/dom/entry.js');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    const target = path.join(dir, 'signature.dom.tsx');
    fs.writeFileSync(target, source);
    const config = withSolidNative(getDefaultConfig(projectRoot));
    const worker = require(config.transformerPath);
    const relative = path.relative(path.dirname(entry), target);
    const result = await worker.transform(
      config.transformer,
      projectRoot,
      path.relative(projectRoot, entry),
      Buffer.from('throw new Error("upstream React entry ran")'),
      { ...options, platform: 'web', customTransformOptions: { dom: encodeURI(relative) } },
    );
    const code = result.output[0].data.code;
    assert.match(code, /__solidNativeEarlyCleanup/);
    assert.doesNotMatch(code, /upstream React entry ran|registerRootComponent|react\/jsx/);
    assert.ok(result.dependencies.some((entry) => entry.name === relative));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
