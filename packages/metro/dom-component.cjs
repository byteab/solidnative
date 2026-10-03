/**
 * The native side of a `'use dom'` page: imported from native code it is not compiled but becomes
 * `{ domComponent: '<page>' }`, named exactly as Expo's `'use dom'` plugin names a DOM component's,
 * with the same `expoDomComponentReference` metadata that plugin records. That metadata is how
 * `export:embed` finds the pages to bundle into `www.bundle`; the name is where it writes them.
 */
const { createHash } = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/** What native code gets for `import note from './web/note.tsx'`. */
function domComponentReference(filename, { dev }) {
  // MUST MATCH babel-preset-expo's use-dom-directive-plugin and @expo/cli's exportDomComponents.
  const reference = pathToFileURL(filename).href;
  const page = dev
    ? `${path.basename(filename)}?file=${reference}`
    : `${createHash('md5').update(reference).digest('hex')}.html`;
  return {
    code: `export default { domComponent: ${JSON.stringify(page)} };\n`,
    reference,
  };
}

module.exports = { domComponentReference };
