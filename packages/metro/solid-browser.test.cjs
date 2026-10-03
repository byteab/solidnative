const assert = require('node:assert/strict');
const { test } = require('node:test');
const { compileBrowserCss, transformSolidBrowser } = require('./solid-browser.cjs');
test('browser universal compiler preserves host imports and source positions without DOM helpers', () => {
  const result = transformSolidBrowser(
    'export const App = () => <view><text>Hello</text></view>;',
    '/fixture.solid.tsx',
  );
  assert.match(result.code, /@solidnative\/platform\/solid/);
  assert.doesNotMatch(result.code, /solid-js\/web|React/);
  assert.ok(result.map.sources.some((source) => source.endsWith('/fixture.solid.tsx')));
});
test('browser CSS scopes hosts, descendant compounds, pseudos and nested media without rewriting keyframes', () => {
  const sheet = compileBrowserCss(
    ':host(.active) { color: red } .row > .label::before { content: "hi" } @media (min-width:600px) { .label { color: blue } } @keyframes fade { from { opacity:0 } to { opacity:1 } }',
    '/card.native.css',
  );
  assert.equal(sheet.browser, true);
  assert.match(sheet.css, new RegExp(`\\[data-h-${sheet.id}\\]\\.active`));
  assert.match(
    sheet.css,
    new RegExp(`\\.row\\[data-s-${sheet.id}\\] > \\.label\\[data-s-${sheet.id}\\]::?before`),
  );
  assert.match(sheet.css, /@media/);
  assert.match(sheet.css, /@keyframes fade/);
  assert.doesNotMatch(sheet.css, /from\[/);
  assert.equal(
    compileBrowserCss('.x{}', '/a.native.css').id,
    compileBrowserCss('.x{}', '/a.native.css').id,
  );
  assert.notEqual(
    compileBrowserCss('.x{}', '/a.native.css').id,
    compileBrowserCss('.x{}', '/b.native.css').id,
  );
});
