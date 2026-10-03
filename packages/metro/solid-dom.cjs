/** Explicit Solid DOM pages are a separate browser compilation boundary. */
const babel = require('@babel/core');
const fs = require('node:fs');
const path = require('node:path');
const { domComponentReference } = require('./dom-component.cjs');

function isSolidDomSource(source, filename) {
  if (!/\.[jt]sx$/.test(filename) || /(?:^|[\\/])node_modules[\\/]/.test(filename)) return false;
  if (/\.dom\.[jt]sx$/.test(filename)) return true;
  const header = source.match(/^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/)?.[0] ?? '';
  return /@jsxImportSource[\t ]+solid-js(?=[\s*]|$)/.test(header);
}

// The root `./web-view` export is the Solid entry (D040); `./solid/web-view` is its alias.
const WEB_VIEW = new Set(['@solidnative/web/web-view', '@solidnative/web/solid/web-view']);

function isSolidDomComponent(source) {
  if (!source.includes('use dom') || !source.includes('/web-view')) return false;
  const ast = babel.parseSync(source, {
    babelrc: false,
    configFile: false,
    parserOpts: { sourceType: 'module', plugins: ['typescript', 'jsx'] },
  });
  return (
    ast.program.directives[0]?.value.value === 'use dom' &&
    ast.program.body.some(
      (node) => node.type === 'ImportDeclaration' && WEB_VIEW.has(node.source.value),
    )
  );
}

function transformSolidDom(source, filename) {
  const result = babel.transformSync(source, {
    filename,
    sourceFileName: filename,
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    sourceMaps: true,
    presets: [
      [require('babel-preset-solid'), { generate: 'dom', dev: false, delegateEvents: false }],
    ],
    plugins: [
      () => ({
        visitor: {
          Program(node) {
            node.node.directives = node.node.directives.filter(
              (entry) => entry.value.value !== 'use dom',
            );
          },
        },
      }),
      [
        require('@babel/plugin-transform-typescript'),
        {
          isTSX: true,
          allExtensions: true,
          allowDeclareFields: true,
          onlyRemoveTypeImports: true,
        },
      ],
    ],
  });
  if (!result?.code || !result.map) throw new Error(`No Solid DOM output for ${filename}`);
  return { code: result.code, map: result.map };
}

function solidDomPage(filename, options) {
  const dom = options.customTransformOptions?.dom;
  if (
    options.platform !== 'web' ||
    typeof dom !== 'string' ||
    !/expo[\\/]dom[\\/]entry\.js$/.test(filename)
  )
    return null;
  const relative = decodeURI(dom);
  const target = path.resolve(path.dirname(filename), relative);
  let source;
  try {
    source = fs.readFileSync(target, 'utf8');
  } catch {
    return null;
  }
  if (!isSolidDomComponent(source)) return null;
  return Buffer.from(`(function () {
    function report(error) {
      var message = error && error.message ? error.message + '\\n' + (error.stack || '') : String(error);
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: message }));
    }
    function error(event) { report(event.error || event.message); }
    function rejection(event) { report(event.reason); }
    window.addEventListener('error', error);
    window.addEventListener('unhandledrejection', rejection);
    window.__solidNativeEarlyCleanup = function () {
      window.removeEventListener('error', error);
      window.removeEventListener('unhandledrejection', rejection);
    };
  })();
  require(${JSON.stringify(relative)});\n`);
}

module.exports = {
  isSolidDomSource,
  isSolidDomComponent,
  transformSolidDom,
  solidDomPage,
  domComponentReference,
};
