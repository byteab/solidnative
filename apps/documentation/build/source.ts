/**
 * `import { html } from './settings.solid.tsx?source'` - a component's own text, highlighted.
 *
 * An example page shows a component running and shows the code that produced it, and the only
 * honest way to do the second is to read the first. Anything retyped into a markdown fence is a
 * copy that stops being true the moment the example is edited, and nothing fails when it does.
 *
 * Highlighting happens here for the same reason it does in `markdown.ts`: the site should not
 * ship a syntax highlighter to render text that was already known at build time.
 */
import { bundledThemes, createHighlighter, type Highlighter } from 'shiki';
import path from 'node:path';
import type { Plugin } from 'vite';
import { excerpt, withoutMarkers } from './excerpt.ts';

const SUFFIX = '?source';
/** `?excerpt`: only the region the file marks, in the language it names; see `excerpt.ts`. */
const EXCERPT = '?excerpt';

/**
 * The module id a request becomes: the file's path, with no `?query` and ending in `.js`, so that
 * nothing else claims it by its extension - Vite's CSS pipeline would take `plans.native.css?excerpt`
 * for a stylesheet, and the Solid transform a `.tsx` for a component.
 */
const PREFIX = '\0documentation-source:';

/** File extension to Shiki language, for a whole file shown with `?source`. */
const LANGUAGE: Record<string, string> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.css': 'css',
  '.html': 'html',
};

/**
 * `github-light`'s own comment colour, `#6e7781` on this page's `--surface-code`, is a 4.40:1
 * contrast ratio - just under the 4.5:1 WCAG AA asks of normal-size text, and every example on
 * this site opens with a comment. See `build/markdown.ts`, which tunes the same theme for prose
 * code blocks the same way and for the same reason; this file needs its own copy because it
 * builds its own `Highlighter` instance rather than sharing markdown's.
 */
const LIGHT_COMMENT = '#6e7781';
const LIGHT_COMMENT_AA = '#677079';

let highlighter: Promise<Highlighter> | undefined;

/**
 * Tuned before a highlighter ever loads it, not read back from one with `getTheme()` and
 * reloaded - see `build/markdown.ts`'s identical function for why the resolved theme a running
 * highlighter hands back does not reliably re-tokenize once mutated.
 */
async function tunedLightTheme() {
  const { default: theme } = await bundledThemes['github-light-default']();
  const tuned = JSON.parse(JSON.stringify(theme));
  tuned.name = 'docs-light';
  for (const rule of tuned.tokenColors ?? []) {
    if (rule.settings?.foreground === LIGHT_COMMENT) rule.settings.foreground = LIGHT_COMMENT_AA;
  }
  return tuned;
}

function shiki(): Promise<Highlighter> {
  highlighter ??= tunedLightTheme().then((docsLight) =>
    createHighlighter({
      themes: [docsLight, 'github-dark-default'],
      langs: ['ts', 'tsx', 'css', 'html'],
    }),
  );
  return highlighter;
}

export function source(): Plugin {
  return {
    name: 'documentation:source',
    enforce: 'pre',
    async resolveId(id, importer) {
      const suffix = [SUFFIX, EXCERPT].find((end) => id.endsWith(end));
      if (!suffix) return undefined;
      const request = id.slice(0, -suffix.length);
      // A relative path is joined here rather than resolved through the other plugins, which would
      // hand back their own module id for a `.native.css` rather than the file.
      const file =
        request.startsWith('.') && importer
          ? path.resolve(path.dirname(importer.split('?')[0]!), request)
          : (await this.resolve(request, importer, { skipSelf: true }))?.id.split('?')[0];
      return file ? `${PREFIX}${suffix.slice(1)}:${file}.js` : undefined;
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return undefined;
      const [kind, ...rest] = id.slice(PREFIX.length, -'.js'.length).split(':');
      const file = rest.join(':');
      this.addWatchFile(file);
      const text = await import('node:fs/promises').then((fs) => fs.readFile(file, 'utf8'));
      const region = kind === 'excerpt' ? excerpt(text) : undefined;
      const shown = region ? region.text : trimLicenceHeader(withoutMarkers(text));
      const html = (await shiki()).codeToHtml(shown, {
        lang: region?.lang ?? LANGUAGE[/\.\w+$/.exec(file)?.[0] ?? ''] ?? 'ts',
        themes: { light: 'docs-light', dark: 'github-dark-default' },
        defaultColor: false,
      });
      return (
        `export const text = ${JSON.stringify(shown)};\n` +
        `export const html = ${JSON.stringify(html)};\n` +
        `export default html;\n`
      );
    },
  };
}

/**
 * Drops a leading block comment.
 *
 * Every example file in this app opens with a note explaining what it is showing, which belongs
 * to the page rather than to the code a reader would paste into their own project.
 */
function trimLicenceHeader(text: string): string {
  const match = /^\s*\/\*[\s\S]*?\*\/\s*/.exec(text);
  return (match ? text.slice(match[0].length) : text).trimEnd() + '\n';
}
