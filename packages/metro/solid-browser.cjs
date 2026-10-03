/** Browser compilation for shared universal components; separate from native and DOM pages. */
const { createHash } = require('node:crypto');
const { transform } = require('lightningcss');
const { transformSolid } = require('./solid-transform.cjs');

function transformSolidBrowser(source, filename) {
  const result = transformSolid(source, filename);
  // Both emitted helpers and authored platform imports select the same browser host in Vite.
  // Keep the native module spelling in the source map and use resolution, not text replacement.
  return result;
}
function attribute(name) {
  return { type: 'attribute', name };
}
function scopedSelector(selector, id) {
  const result = [];
  let compound = [];
  function finish() {
    if (!compound.length) return;
    const isHost = compound.some((part) => part.type === 'pseudo-class' && part.kind === 'host');
    const scoped = [];
    for (const part of compound) {
      if (part.type === 'pseudo-class' && part.kind === 'host') {
        scoped.push(attribute(`data-h-${id}`), ...(part.selectors ?? []));
      } else scoped.push(part);
    }
    if (!isHost) {
      const at = scoped.findIndex((part) => part.type === 'pseudo-element');
      scoped.splice(at < 0 ? scoped.length : at, 0, attribute(`data-s-${id}`));
    }
    result.push(...scoped);
    compound = [];
  }
  for (const part of selector) {
    if (part.type === 'combinator') {
      finish();
      result.push(part);
    } else compound.push(part);
  }
  finish();
  return result;
}
function compileBrowserCss(source, filename) {
  const id = createHash('sha256')
    .update(filename)
    .update('\0')
    .update(source)
    .digest('hex')
    .slice(0, 16);
  const result = transform({
    filename,
    code: Buffer.from(source),
    minify: false,
    // A selector visitor, not a style-rule one: returning a whole rule makes lightningcss
    // deserialize its declarations too, and that fails on any var() reference.
    visitor: { Selector: (selector) => scopedSelector(selector, id) },
  });
  return { browser: true, id, css: result.code.toString() };
}
module.exports = { transformSolidBrowser, compileBrowserCss };
