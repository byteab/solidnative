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

const source = `'use dom';
import { mountInWebView as mount } from '@solid-native/web/solid/web-view';
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

test('actual Expo development override disables React Refresh for Solid DOM pages', () => {
  const dir = fs.mkdtempSync('/private/tmp/solid-native-g12-dom-dev-');
  try {
    const requireExpo = createRequire(require.resolve('@expo/metro-config/package.json'));
    const preset = requireExpo.resolve('expo/internal/babel-preset');
    fs.writeFileSync(
      path.join(dir, 'babel.config.cjs'),
      `const {isSolidFile}=require(${JSON.stringify(require.resolve('./solid-babel.cjs'))}); module.exports={presets:[${JSON.stringify(preset)}],overrides:[{test:isSolidFile,presets:[[${JSON.stringify(preset)},{enableReactFastRefresh:false}]]}]};`,
    );
    const file = path.join(dir, 'signature.dom.tsx');
    fs.writeFileSync(file, source);
    const result = transformer.transform({
      src: source,
      filename: file,
      options: {
        ...options,
        projectRoot: dir,
        platform: 'web',
        dev: true,
        enableBabelRCLookup: true,
      },
      plugins: [],
    });
    const code = generated(result.ast);
    assert.match(code, /solid-js\/web/);
    assert.doesNotMatch(code, /\$Refresh|react\/jsx|use dom/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
