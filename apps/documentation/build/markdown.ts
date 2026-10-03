/**
 * `.md` as a module, rendered at build time.
 *
 * The site's prose is markdown because prose is easier to write and to diff as markdown, but a
 * page here is not only prose: a component page interleaves paragraphs with live examples and
 * with API tables, and both of those are components that have to be rendered, not strings that
 * can be pasted into `innerHTML`. A component tag inside a string of HTML is just an unknown
 * element, so a page cannot be one blob of HTML with component tags scattered through it.
 *
 * So a markdown file compiles to a *list of blocks* rather than to one string. A line reading
 *
 *     <!-- example: settings -->
 *
 * ends the prose block before it and stands as a block of its own, and `doc-content` renders the
 * prose ones with `innerHTML` and mounts the example ones as islands. The marker is an HTML
 * comment on purpose: a markdown file with these in it still renders correctly in an editor
 * preview and on GitHub, so a page reads the same in an editor as it does on the site.
 *
 * Highlighting is Shiki, run here rather than in the browser, so no highlighter ships to the
 * client. `defaultColor: false` makes it emit both palettes as custom properties on every token
 * and lets one CSS rule pick between them, which is what makes the theme toggle instant instead
 * of a re-highlight of every block on the page.
 */
import fm from 'front-matter';
import { marked } from 'marked';
import { gfmHeadingId, getHeadingList } from 'marked-gfm-heading-id';
import { bundledThemes, createHighlighter, type Highlighter } from 'shiki';
import type { Plugin } from 'vite';
import { pageLinks, pageUrl } from './page-links.ts';

/** One piece of a page: prose already rendered, a named example, or a generated API table. */
export type DocBlock =
  | { readonly kind: 'html'; readonly html: string }
  | { readonly kind: 'example'; readonly name: string }
  | { readonly kind: 'api'; readonly reference: string };

/** An `## h2` or `### h3`, for the "on this page" column. */
export interface DocHeading {
  readonly id: string;
  readonly level: number;
  readonly text: string;
}

/**
 * `<!-- example: hero -->` and `<!-- api: Button -->`, on a line of their own.
 *
 * One expression for both because they cut the page the same way: the prose either side of a
 * marker has to be parsed separately, and a second pass looking for a second marker would have to
 * re-split segments the first pass had already cut.
 *
 * An API reference is a class name, optionally qualified by its package where two of them share a
 * name - `@solidnative/components#Switch`. See `build/api.ts`.
 */
const BLOCK_MARKER = /^[ \t]*<!--\s*(example|api):\s*([@a-zA-Z0-9/#-]+)\s*-->[ \t]*$/gm;

const LANGUAGES = ['ts', 'tsx', 'js', 'jsx', 'html', 'css', 'json', 'bash', 'sh', 'diff', 'md'];

/**
 * `github-light`'s own comment colour, `#6e7781` on this page's `--surface-code`, is a 4.40:1
 * contrast ratio - just under the 4.5:1 WCAG AA asks of normal-size text, and comments are the
 * most common token on a site this heavily documented. Darkening it a little, rather than
 * picking a different theme's comment colour outright, keeps every other token exactly as
 * GitHub's own designers chose it.
 */
const LIGHT_COMMENT = '#6e7781';
const LIGHT_COMMENT_AA = '#677079';

let highlighter: Promise<Highlighter> | undefined;

/**
 * `github-light-default`'s own theme JSON, tuned before a highlighter ever loads it - not read
 * back with `Highlighter.getTheme()` and reloaded, because that returns the theme already
 * *resolved*: Shiki builds its token-to-colour lookup once, at load time, from the raw
 * `tokenColors` list, and mutating a copy of the resolved object and calling `loadTheme()` again
 * does not reliably rebuild that lookup - some tokens kept the old colour regardless. Loading the
 * tuned theme instead of the stock one sidesteps the question entirely.
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

/**
 * `-default`, not the plain `github-light`/`github-dark` this used to load: GitHub's newer pair,
 * built to its own accessible colour set, which is what clears every other token's contrast on
 * this page without this file tuning it by hand the way it does the one above.
 */
function shiki(): Promise<Highlighter> {
  highlighter ??= tunedLightTheme().then((docsLight) =>
    createHighlighter({
      themes: [docsLight, 'github-dark-default'],
      langs: LANGUAGES,
    }),
  );
  return highlighter;
}

/**
 * Splits on the example markers, keeping the marker names.
 *
 * Returned as raw markdown segments rather than rendered ones because each has to go through
 * `marked` separately: heading ids are collected per parse, and a segment that started mid-list
 * or mid-fence would not survive being cut anywhere else.
 */
function segments(body: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  let at = 0;
  for (const match of body.matchAll(BLOCK_MARKER)) {
    const before = body.slice(at, match.index);
    if (before.trim()) blocks.push({ kind: 'html', html: before });
    blocks.push(
      match[1] === 'api'
        ? { kind: 'api', reference: match[2]! }
        : { kind: 'example', name: match[2]! },
    );
    at = match.index + match[0].length;
  }
  const rest = body.slice(at);
  if (rest.trim()) blocks.push({ kind: 'html', html: rest });
  return blocks;
}

async function render(source: string, headings: DocHeading[]): Promise<string> {
  const instance = marked.use(gfmHeadingId(), {
    async: true,
    gfm: true,
    renderer: {
      // Shiki owns the whole `<pre>`, so the fenced-code renderer is replaced rather than wrapped:
      // `marked-highlight` would nest Shiki's `<pre>` inside one of marked's own.
      code({ text, lang }) {
        const language = LANGUAGES.includes(lang ?? '') ? (lang as string) : 'text';
        return highlightSync(text, language);
      },
    },
  });
  const html = (await instance.parse(source)) as string;
  for (const heading of getHeadingList()) {
    if (heading.level >= 2 && heading.level <= 3) {
      headings.push({ id: heading.id, level: heading.level, text: stripTags(heading.text) });
    }
  }
  return html;
}

/**
 * Marked's renderer hooks are synchronous, and Shiki's `codeToHtml` is not once you count
 * loading a grammar. The highlighter is created before any parsing starts (see `transform`), so
 * by the time this runs the languages are already in memory and the call is synchronous in fact
 * even though its type is not.
 */
let ready: Highlighter | undefined;
function highlightSync(code: string, lang: string): string {
  if (!ready) return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  return ready.codeToHtml(code, {
    lang: ready.getLoadedLanguages().includes(lang) ? lang : 'text',
    themes: { light: 'docs-light', dark: 'github-dark-default' },
    defaultColor: false,
  });
}

/**
 * A whole file, highlighted as a docs code block is: the example apps' code browser shows their
 * source with this, so a file there and a fence in a guide are the same kind of block.
 */
export async function highlight(code: string, lang: string): Promise<string> {
  ready = await shiki();
  return highlightSync(code, LANGUAGES.includes(lang) ? lang : 'text');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A heading as plain text, for the contents column.
 *
 * The heading arrives from `marked` as rendered HTML, so `### <text-input>` is a `&lt;` and a
 * `&gt;` wrapped in a `<code>`. Stripping the tags is not enough on its own: without decoding the
 * entities too, the contents column reads `&lt;text-input&gt;` literally.
 */
function stripTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function markdown(): Plugin {
  return {
    name: 'documentation:markdown',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('.md')) return undefined;
      ready = await shiki();

      const { attributes, body } = fm<Record<string, unknown>>(code);
      const url = pageUrl(id);
      const headings: DocHeading[] = [];
      const blocks: DocBlock[] = [];
      for (const block of segments(body)) {
        blocks.push(
          block.kind === 'html'
            ? { kind: 'html', html: pageLinks(await render(block.html, headings), url) }
            : block,
        );
      }

      return {
        code:
          `export const attributes = ${JSON.stringify(attributes)};\n` +
          `export const headings = ${JSON.stringify(headings)};\n` +
          `export const blocks = ${JSON.stringify(blocks)};\n` +
          `export default { attributes, headings, blocks };\n`,
        map: null,
      };
    },
  };
}
