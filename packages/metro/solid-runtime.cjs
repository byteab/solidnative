const path = require('node:path');
const { realpathSync } = require('node:fs');
const { createRequire } = require('node:module');

const CLIENT_FILES = Object.freeze({
  'solid-js': 'dist/solid.js',
  'solid-js/store': 'store/dist/store.js',
  'solid-js/universal': 'universal/dist/universal.js',
});

/** One app-installed root, independent of worker/node/browser/development conditions. */
function createSolidRuntime(projectRoot) {
  const appRequire = createRequire(path.join(path.resolve(projectRoot), 'package.json'));
  const manifest = realpathSync(appRequire.resolve('solid-js/package.json'));
  const root = path.dirname(manifest);
  return {
    root,
    version: appRequire(manifest).version,
    resolve(specifier) {
      const file = Object.hasOwn(CLIENT_FILES, specifier) ? CLIENT_FILES[specifier] : undefined;
      return file ? path.join(root, file) : undefined;
    },
  };
}

module.exports = { createSolidRuntime };
