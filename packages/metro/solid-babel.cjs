const { readFileSync } = require('node:fs');
const path = require('node:path');
const { isSolidReloadSource } = require('./solid-transform.cjs');
const { isSolidDomSource, isSolidDomComponent } = require('./solid-dom.cjs');

/**
 * Expo's development transformer always enables React Refresh. Disable it for native Solid:
 *
 * const { isSolidFile } = require('@solidnative/metro/solid-babel.cjs');
 * module.exports = {
 *   presets: ['babel-preset-expo'],
 *   overrides: [{
 *     test: isSolidFile,
 *     presets: [['babel-preset-expo', { enableReactFastRefresh: false }]],
 *   }],
 * };
 *
 * React files retain Expo defaults. Native Solid edits dispose development roots and request a
 * clean native reload through Metro's module boundary. Component/signal state is reset; this is
 * not React Refresh or state-preserving Solid HMR. Restart Metro after compiler edits.
 * Use .solid.ts/.solid.js for non-JSX helpers whose edits need the same guarded reload.
 */
// A plain .ts module that imports Solid (a package's control or service, say) is Solid code too.
// Left to React Refresh, a capitalised export like `Switch` registers as a React component and an
// edit hot-swaps it into a tree that does not exist, instead of reaching the clean reload.
const SOLID_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)['"](?:solid-js(?:\/[^'"]*)?|@solidnative\/[^'"/]+\/solid(?:\/[^'"]*)?)['"]/;

// The toolkit's own package sources (this workspace's `packages/*/src`) hold no React code, and a
// plain helper there (a gesture builder, the CSS engine) imports neither marker above. Installed
// copies sit under node_modules, which React Refresh never touches anyway.
const TOOLKIT_SOURCES = path.resolve(__dirname, '..') + path.sep;
const isToolkitSource = (filename) =>
  path.resolve(filename).startsWith(TOOLKIT_SOURCES) &&
  /[\\/]src[\\/]/.test(path.relative(TOOLKIT_SOURCES, path.resolve(filename)));

function isSolidFile(filename) {
  if (!filename || !/\.[jt]sx?$/i.test(filename) || /(?:^|[\\/])node_modules[\\/]/.test(filename))
    return false;
  if (isToolkitSource(filename)) return true;
  // A file Metro hands over without one on disk (a test fixture) is judged by its name alone.
  let source = '';
  try {
    source = readFileSync(filename, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return (
    SOLID_IMPORT.test(source) ||
    isSolidReloadSource(source, filename) ||
    isSolidDomSource(source, filename) ||
    isSolidDomComponent(source)
  );
}

module.exports = { isSolidFile };
