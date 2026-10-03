/**
 * Named imports from `lucide-static`, replaced with the SVG strings they name.
 *
 * The package's entry re-exports every icon it has - 1,900-odd SVG strings, and Metro resolves
 * its `main`, a single 900 KB CommonJS file holding all of them - so importing three icons
 * shipped them all. Reading the three strings out of the package at build time means its module
 * is never in the graph at all, in development or release.
 *
 * Only a plain named import is rewritten, and only when every name is in the package. Anything
 * else - a namespace import, a type import, a name the package does not have - is left for the
 * ordinary import to handle, so its error is the real one. Each string is folded onto one line,
 * so the replacement keeps the statement's line count, every line after it keeps its number and
 * the source map stays right.
 *
 * ponytail: the package is read with regexes over its published ESM entry, which is one
 * `export { default as Name } from './icons/name.mjs';` per icon, and each icon file, which is one
 * `const Name = \`<svg ...>\`;`. A release published in another shape is left alone.
 */
const { readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*['"]lucide-static['"];?[ \t]*$/gm;
const EXPORT = /^export \{([^}]*)\} from '(\.\/[^']+)';$/gm;
const LITERAL = /^const \w+ = `([^`$\\]*)`;$/m;

/** @type {Map<string, { mtime: number, files: Map<string, string> }>} */
const entries = new Map();
/** @type {Map<string, string | undefined>} */
const literals = new Map();

/** Every exported icon name of the entry at `file`, to the icon file it re-exports. */
function iconFiles(file) {
  const mtime = statSync(file).mtimeMs;
  const cached = entries.get(file);
  if (cached?.mtime === mtime) return cached.files;

  const files = new Map();
  for (const [, list, target] of readFileSync(file, 'utf8').matchAll(EXPORT)) {
    const resolved = path.resolve(path.dirname(file), target);
    for (const entry of list.split(',')) {
      const [local, exported] = entry.trim().split(/\s+as\s+/);
      if (local === 'default' && exported) files.set(exported, resolved);
    }
  }
  entries.set(file, { mtime, files });
  return files;
}

/** The icon's markup as a one-line string literal, or undefined when it is not one. */
function literalOf(file) {
  if (!literals.has(file)) {
    const markup = LITERAL.exec(readFileSync(file, 'utf8'))?.[1];
    literals.set(file, markup && JSON.stringify(markup.replace(/\s*\n\s*/g, ' ').trim()));
  }
  return literals.get(file);
}

/** The package's ESM entry as `filename` would resolve it, or undefined. */
function entryFor(filename) {
  try {
    const manifest = require.resolve('lucide-static/package.json', {
      paths: [path.dirname(filename)],
    });
    const { module } = JSON.parse(readFileSync(manifest, 'utf8'));
    return module && path.join(path.dirname(manifest), module);
  } catch {
    return undefined;
  }
}

/**
 * @param {string} src
 * @param {string} filename
 */
function inlineIcons(src, filename) {
  if (!src.includes('lucide-static')) return src;
  return src.replace(IMPORT, (statement, list) => {
    if (/^\s*type\b/.test(list)) return statement;
    const entry = entryFor(filename);
    if (!entry) return statement;
    const files = iconFiles(entry);
    const bindings = [];
    for (const part of list.split(',')) {
      const name = part.trim();
      if (!name) continue;
      const [imported, local = imported] = name.split(/\s+as\s+/);
      const file = files.get(imported);
      const value = file && literalOf(file);
      if (!value) return statement;
      bindings.push(`${local} = ${value}`);
    }
    return bindings.length
      ? `const ${bindings.join(', ')};${'\n'.repeat(statement.split('\n').length - 1)}`
      : statement;
  });
}

module.exports = { inlineIcons };
