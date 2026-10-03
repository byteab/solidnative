/**
 * The example apps' own files, for the code browser on each app's page.
 *
 * Read off disk at build time from each registry entry's `sourceRoot`, so the page shows the code
 * in the repository rather than a copy of it. Two virtual modules:
 *
 * - `virtual:solid-native/example-sources` lists every app's files, each with a loader;
 * - each loader imports one file, highlighted by `markdown.ts`'s Shiki, as its own chunk.
 *
 * One chunk per file rather than one per app, because an app's highlighted source runs to
 * hundreds of kilobytes and a reader opens a few files, not all of them.
 *
 * What counts as source: the app's Solid code - every `*.solid.ts(x)` and `*.native.css` under
 * `src`, and any other file in `src` one of them imports (a shared model, the Tailwind sheet) - plus
 * the text files at the app's root (its manifest, Metro and Expo config). Anything else in `src` -
 * sources from an earlier port that an app still keeps beside its Solid ones - is not the app the
 * page describes, so it is left out, as are dependencies, native projects, build output, lockfiles, generated files and anything
 * dot-prefixed (`.expo`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { EXAMPLE_APPS } from '../src/example-apps/registry.ts';
import { highlight } from './markdown.ts';

const INDEX = 'virtual:solid-native/example-sources';
const FILE = 'virtual:solid-native/example-source/';
/** Ends a file's module id, so no plugin reads `home.ts` in the id as a TypeScript module. */
const FILE_SUFFIX = '.highlighted';

const SKIPPED_FOLDERS = new Set(['node_modules', 'ios', 'android', 'dist', 'build']);
const LOCKFILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb']);
const GENERATED = /\.generated\.|^expo-env\.d\.ts$/;

/** Extension to Shiki language. Anything else is not shown. */
const LANGUAGE: Record<string, string> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.mts': 'ts',
  '.cts': 'ts',
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.json': 'json',
  '.css': 'css',
  '.html': 'html',
  '.md': 'md',
};

/** Where a Solid app's own code starts: everything else in `src` is in only if one of these imports it. */
const SOLID_SOURCE = /\.solid\.tsx?$|\.native\.css$/;
/** `from './x'`, `import './x'` and `import('./x')`, relative specifiers only. */
const RELATIVE_IMPORT = /(?:from\s+|import\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

/** Every text file under `folder`, relative to `root`, skipping what no author wrote. */
function textFiles(root: string, folder: string, recurse: boolean): string[] {
  const files: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(path.join(root, at), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const relative = at ? `${at}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (recurse && !SKIPPED_FOLDERS.has(entry.name)) walk(relative);
      } else if (
        entry.isFile() &&
        path.extname(entry.name) in LANGUAGE &&
        !LOCKFILES.has(entry.name) &&
        !GENERATED.test(entry.name)
      ) {
        files.push(relative);
      }
    }
  };
  walk(folder);
  return files;
}

/** An app's source files, as paths relative to its folder with forward slashes, sorted. */
export function sourceFiles(root: string): string[] {
  const inSource = new Set(textFiles(root, 'src', true));
  const shown = new Set([...inSource].filter((file) => SOLID_SOURCE.test(file)));
  const queue = [...shown];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    const text = readFileSync(path.join(root, file), 'utf8');
    for (const [, specifier] of text.matchAll(RELATIVE_IMPORT)) {
      const target = path.posix.join(path.posix.dirname(file), specifier!);
      if (inSource.has(target) && !shown.has(target)) {
        shown.add(target);
        queue.push(target);
      }
    }
  }
  return [...textFiles(root, '', false), ...shown].sort();
}

/** One file, highlighted. */
export function highlightFile(root: string, file: string): Promise<string> {
  const text = readFileSync(path.join(root, file), 'utf8');
  return highlight(text.trimEnd() + '\n', LANGUAGE[path.extname(file)] ?? 'text');
}

export function exampleSources(workspaceRoot: string): Plugin {
  const rootOf = (slug: string) => {
    const app = EXAMPLE_APPS.find((entry) => entry.slug === slug);
    if (!app) throw new Error(`No example app "${slug}" in src/example-apps/registry.ts`);
    return path.join(workspaceRoot, app.sourceRoot);
  };

  return {
    name: 'documentation:example-sources',
    enforce: 'pre',
    resolveId(id) {
      if (id === INDEX || id.startsWith(FILE)) return `\0${id}`;
      return undefined;
    },
    async load(id) {
      if (id === `\0${INDEX}`) {
        const apps = EXAMPLE_APPS.map((app) => {
          const files = sourceFiles(rootOf(app.slug)).map((file) => {
            const module = JSON.stringify(`${FILE}${app.slug}/${file}${FILE_SUFFIX}`);
            return `{ path: ${JSON.stringify(file)}, load: () => import(${module}).then((m) => m.default) }`;
          });
          return `${JSON.stringify(app.slug)}: [\n    ${files.join(',\n    ')}\n  ]`;
        });
        return `export const EXAMPLE_SOURCES = {\n  ${apps.join(',\n  ')}\n};\n`;
      }
      if (id.startsWith(`\0${FILE}`) && id.endsWith(FILE_SUFFIX)) {
        const [slug = '', ...rest] = id.slice(FILE.length + 1, -FILE_SUFFIX.length).split('/');
        const root = rootOf(slug);
        const file = rest.join('/');
        this.addWatchFile(path.join(root, file));
        return `export default ${JSON.stringify(await highlightFile(root, file))};\n`;
      }
      return undefined;
    },
  };
}
