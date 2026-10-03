/**
 * Large, real stylesheets used as a corpus for the CSS engine, and the browser cases drawn from
 * them. Shared by `css-corpus.test.ts` and `scripts/generate-css-oracle.mjs`, so the browser and
 * the engine are handed exactly the same CSS and exactly the same tree.
 *
 * A hand-written test can only find the bugs its author thought of. A stylesheet written by
 * somebody else, for browsers, finds the ones nobody did: every shorthand spelled the way people
 * really spell it, initial values the parser fills in, tokens used in places a unit test would
 * never put them.
 *
 * Each library's own compiled CSS is read from `node_modules`, at the exact version pinned in
 * `package.json`. Tailwind is built by its real CLI from a fixed class list.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseNode } from './css-oracle-cases.ts';

const require = createRequire(import.meta.url);
const HERE = fileURLToPath(new URL('.', import.meta.url));

export type LibraryName =
  'bootstrap' | 'bulma' | 'pico' | 'open-props' | 'tailwind' | 'tailwind-v3';

const read = (specifier: string) => readFileSync(require.resolve(specifier), 'utf8');

/**
 * The Tailwind CLI's output for the corpus entry.
 *
 * Run from this package, because the CLI resolves `@import`s from the entry's own directory and
 * `@solid-native/tailwind` is only installed here.
 */
function tailwind(): string {
  const cli = join(require.resolve('@tailwindcss/cli/package.json'), '..', 'dist', 'index.mjs');
  const out = join(mkdtempSync(join(tmpdir(), 'css-corpus-')), 'tailwind.css');
  execFileSync(process.execPath, [cli, '-i', join(HERE, 'css-corpus-tailwind.css'), '-o', out], {
    cwd: HERE,
    stdio: 'pipe',
  });
  return readFileSync(out, 'utf8');
}

/** `a{b,c}d` as `abd acd`, nested, which is how the corpus entry names its classes. */
function expandBraces(pattern: string): string[] {
  const open = pattern.indexOf('{');
  if (open === -1) return [pattern];
  let depth = 0;
  let close = open;
  const parts: string[] = [];
  let start = open + 1;
  for (let i = open; i < pattern.length; i++) {
    if (pattern[i] === '{') depth++;
    else if (pattern[i] === '}' && --depth === 0) {
      close = i;
      parts.push(pattern.slice(start, i));
      break;
    } else if (pattern[i] === ',' && depth === 1) {
      parts.push(pattern.slice(start, i));
      start = i + 1;
    }
  }
  const head = pattern.slice(0, open);
  const tails = expandBraces(pattern.slice(close + 1));
  return parts.flatMap((part) => expandBraces(head + part).flatMap((a) => tails.map((t) => a + t)));
}

/** Names only Tailwind 3 has, for the utilities it composes differently. */
const V3_ONLY =
  'transform filter backdrop-filter bg-gradient-to-r bg-gradient-to-br ring-inset ring-offset-2 ring-2 ' +
  'ring-offset-white {bg,text,border,divide,ring,placeholder}-opacity-{0,50,100} ' +
  '{space-x,space-y}-{2,4} {space-x,space-y}-reverse divide-y divide-x divide-{zinc-200,red-500} ' +
  'transform-gpu origin-center rotate-12 -rotate-12 skew-y-3 scale-x-50 scale-y-75 ' +
  'group-focus-visible:p-4 peer-hover:p-4 ios:p-4 android:p-4 native:p-4 ios:dark:p-4 pb-safe-4';

/** Tailwind 3's CLI output for the same class set, through the Tailwind 3 preset. */
function tailwindV3(): string {
  const entry = readFileSync(join(HERE, 'css-corpus-tailwind.css'), 'utf8');
  const patterns = [...entry.matchAll(/@source inline\("([^"]+)"\)/g)].map((m) => m[1]!);
  const classes = [...patterns, ...V3_ONLY.split(' ')].flatMap(expandBraces).join(' ');
  const dir = mkdtempSync(join(tmpdir(), 'css-corpus-v3-'));
  const preset = require.resolve('@solid-native/tailwind/preset.cjs');
  writeFileSync(
    join(dir, 'tailwind.config.js'),
    `module.exports = { presets: [require(${JSON.stringify(preset)})], content: [{ raw: ${JSON.stringify(classes)} }] };`,
  );
  writeFileSync(
    join(dir, 'in.css'),
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
  );
  const cli = require.resolve('tailwindcss-v3/lib/cli.js');
  execFileSync(
    process.execPath,
    [cli, '-c', 'tailwind.config.js', '-i', 'in.css', '-o', 'out.css'],
    {
      cwd: dir,
      stdio: 'pipe',
    },
  );
  return readFileSync(join(dir, 'out.css'), 'utf8');
}

/**
 * What each library is, as a browser would load it.
 *
 * Open Props is its token sheet, its normalize, and a small stylesheet written in its tokens: on
 * its own it defines custom properties and styles nothing.
 */
export const LIBRARIES: Record<LibraryName, () => string> = {
  bootstrap: () => read('bootstrap/dist/css/bootstrap.css'),
  bulma: () => read('bulma/css/bulma.css'),
  pico: () => read('@picocss/pico/css/pico.css'),
  'open-props': () =>
    [
      read('open-props/open-props.min.css'),
      read('open-props/normalize.min.css'),
      readFileSync(join(HERE, 'css-corpus-open-props.css'), 'utf8'),
    ].join('\n'),
  tailwind,
  'tailwind-v3': tailwindV3,
};

const cache = new Map<LibraryName, string>();

/** A library's CSS, read once per process: the Tailwind one costs a CLI run. */
export function source(library: LibraryName): string {
  let css = cache.get(library);
  if (css === undefined) cache.set(library, (css = LIBRARIES[library]()));
  return css;
}

/** One browser case: a tree wearing a library's classes, at one viewport width. */
export interface CorpusCase {
  library: LibraryName;
  name: string;
  /** Viewport width in CSS pixels. Headless Chrome will not go below 500. */
  width: number;
  tree: CaseNode;
}

/** The viewport height every case is measured at. Only orientation queries could notice it. */
export const HEIGHT = 900;

/**
 * The properties compared, as CSS names. Each maps to the React Native key a resolved style holds
 * it under; see `css-corpus.test.ts` for how a browser's value is read into ours.
 */
export const CORPUS_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-left-color',
  'border-top-width',
  'border-left-width',
  'border-top-left-radius',
  'border-bottom-right-radius',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'row-gap',
  'column-gap',
  'max-width',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration-line',
  'display',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'flex-grow',
  'flex-shrink',
  'opacity',
  'box-shadow',
  'aspect-ratio',
  'position',
] as const;

export type CorpusProperty = (typeof CORPUS_PROPERTIES)[number];

const probe = (classes: string[], extra: Partial<CaseNode> = {}): CaseNode => ({
  name: 'view',
  id: 'probe',
  classes,
  ...extra,
});

/** A probe inside a parent, for classes that only mean something as a child of another. */
const within = (parent: string[], child: CaseNode): CaseNode => ({
  name: 'view',
  classes: parent,
  children: [child],
});

const at = (library: LibraryName, name: string, tree: CaseNode, width = 500): CorpusCase => ({
  library,
  name,
  width,
  tree,
});

export const CORPUS_CASES: CorpusCase[] = [
  // Bootstrap. Its utilities are `!important` throughout, and almost everything else is a custom
  // property set by one class and read by a rule on another.
  at('bootstrap', '.btn.btn-primary', probe(['btn', 'btn-primary'], { name: 'text' })),
  at('bootstrap', '.card', probe(['card'])),
  at('bootstrap', '.card > .card-body', within(['card'], probe(['card-body']))),
  at('bootstrap', '.p-3', probe(['p-3'])),
  at('bootstrap', '.m-2.px-4', probe(['m-2', 'px-4'])),
  at('bootstrap', '.d-flex.gap-2', probe(['d-flex', 'gap-2'])),
  at(
    'bootstrap',
    '.d-flex.flex-column.align-items-center.justify-content-between',
    probe(['d-flex', 'flex-column', 'align-items-center', 'justify-content-between']),
  ),
  at('bootstrap', '.text-center', probe(['text-center'])),
  at(
    'bootstrap',
    '.fw-bold.text-uppercase.fst-italic',
    probe(['fw-bold', 'text-uppercase', 'fst-italic']),
  ),
  at('bootstrap', '.rounded', probe(['rounded'])),
  at('bootstrap', '.rounded-pill', probe(['rounded-pill'])),
  at('bootstrap', '.shadow-sm', probe(['shadow-sm'])),
  at('bootstrap', '.border', probe(['border'])),
  at('bootstrap', '.border-0', probe(['border-0'])),
  at('bootstrap', '.opacity-50', probe(['opacity-50'])),
  at('bootstrap', '.text-primary', probe(['text-primary'])),
  at('bootstrap', '.bg-primary', probe(['bg-primary'])),
  at('bootstrap', '.lh-base', probe(['lh-base'])),
  at('bootstrap', '.font-monospace', probe(['font-monospace'])),
  at('bootstrap', '.alert.alert-success', probe(['alert', 'alert-success'])),
  at('bootstrap', '.container at 500', probe(['container'])),
  at('bootstrap', '.container at 1280', probe(['container']), 1280),
  at('bootstrap', '.fs-1 at 500', probe(['fs-1'])),
  at('bootstrap', '.fs-1 at 1280', probe(['fs-1']), 1280),
  at('bootstrap', '.d-none.d-md-flex at 500', probe(['d-none', 'd-md-flex'])),
  at('bootstrap', '.d-none.d-md-flex at 1280', probe(['d-none', 'd-md-flex']), 1280),
  at('bootstrap', '.ratio-16x9', probe(['ratio', 'ratio-16x9'])),

  // Bulma. Colours are `hsl(var(--h), var(--s), var(--l))` from end to end.
  at('bulma', '.button.is-primary', probe(['button', 'is-primary'], { name: 'text' })),
  at('bulma', '.box', probe(['box'])),
  at('bulma', '.p-3', probe(['p-3'])),
  at('bulma', '.m-2', probe(['m-2'])),
  at('bulma', '.is-flex.is-flex-direction-column', probe(['is-flex', 'is-flex-direction-column'])),
  at('bulma', '.has-text-centered', probe(['has-text-centered'])),
  at('bulma', '.has-text-weight-bold', probe(['has-text-weight-bold'])),
  at('bulma', '.is-size-3', probe(['is-size-3'])),
  at('bulma', '.title', probe(['title'])),
  at('bulma', '.tag', probe(['tag'], { name: 'text' })),
  at('bulma', '.container at 500', probe(['container'])),
  at('bulma', '.container at 1280', probe(['container']), 1280),

  // Pico. Mostly classless, so what is left for a plain element is its layout classes and the
  // attribute selectors it styles buttons with.
  at('pico', '.container at 500', probe(['container'])),
  at('pico', '.container at 1280', probe(['container']), 1280),
  at('pico', '.grid', probe(['grid'])),
  at('pico', '[role=button]', probe([], { attrs: { role: 'button' } })),
  at('pico', '[role=button].secondary', probe(['secondary'], { attrs: { role: 'button' } })),

  // Open Props, through the stylesheet written in its tokens.
  at('open-props', '.op-card', probe(['op-card'])),
  at('open-props', '.op-media', probe(['op-media'])),
  at('open-props', '.op-stack', probe(['op-stack'])),

  // Tailwind, through the same flattening an app's build does.
  at('tailwind', 'p-4', probe(['p-4'])),
  at(
    'tailwind',
    'bg-blue-500 text-slate-50 rounded-lg',
    probe(['bg-blue-500', 'text-slate-50', 'rounded-lg']),
  ),
  at('tailwind', 'flex items-center gap-2', probe(['flex', 'items-center', 'gap-2'])),
  at('tailwind', 'shadow-lg', probe(['shadow-lg'])),
  at('tailwind', 'border-2 border-red-500', probe(['border-2', 'border-red-500'])),
  at(
    'tailwind',
    'text-2xl font-bold leading-tight tracking-wide',
    probe(['text-2xl', 'font-bold', 'leading-tight', 'tracking-wide']),
  ),
  at('tailwind', 'bg-red-500/50', probe(['bg-red-500/50'])),
  at('tailwind', 'opacity-50 aspect-video', probe(['opacity-50', 'aspect-video'])),
  at('tailwind', 'md:p-4 at 500', probe(['md:p-4'])),
  at('tailwind', 'md:p-4 at 1280', probe(['md:p-4']), 1280),
  at('tailwind', 'container at 500', probe(['container'])),
  at('tailwind', 'container at 1280', probe(['container']), 1280),

  // Tailwind 3: the same utilities, and the ones it builds out of several classes on one element.
  at('tailwind-v3', 'p-4', probe(['p-4'])),
  at(
    'tailwind-v3',
    'bg-blue-500 text-slate-50 rounded-lg',
    probe(['bg-blue-500', 'text-slate-50', 'rounded-lg']),
  ),
  at('tailwind-v3', 'flex items-center gap-2', probe(['flex', 'items-center', 'gap-2'])),
  at(
    'tailwind-v3',
    'text-2xl font-bold leading-tight tracking-wide',
    probe(['text-2xl', 'font-bold', 'leading-tight', 'tracking-wide']),
  ),
  at('tailwind-v3', 'md:p-4 at 500', probe(['md:p-4'])),
  at('tailwind-v3', 'md:p-4 at 1280', probe(['md:p-4']), 1280),
  at('tailwind-v3', 'shadow-lg', probe(['shadow-lg'])),
  at('tailwind-v3', 'shadow ring-2 ring-red-500', probe(['shadow', 'ring-2', 'ring-red-500'])),
  at(
    'tailwind-v3',
    'ring-2 ring-offset-2 ring-blue-500',
    probe(['ring-2', 'ring-offset-2', 'ring-blue-500']),
  ),
  at('tailwind-v3', 'bg-blue-500 bg-opacity-50', probe(['bg-blue-500', 'bg-opacity-50'])),
  at('tailwind-v3', 'text-red-500 text-opacity-50', probe(['text-red-500', 'text-opacity-50'])),
  at(
    'tailwind-v3',
    'border-2 border-red-500 border-opacity-50',
    probe(['border-2', 'border-red-500', 'border-opacity-50']),
  ),
  at('tailwind-v3', 'bg-red-500/50', probe(['bg-red-500/50'])),
];
