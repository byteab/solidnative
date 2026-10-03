/**
 * Snapshot prerendering: `vite build` produces the application, this walks it in a browser and
 * writes what each route drew back to disk, so a request for `/packages/components/touch` answers
 * with that page's prose instead of an empty `<app-root>`.
 *
 * A browser, rather than a server renderer: Playwright is already here for `packages/web`'s browser
 * suite, it adds no compiler to the graph, and a headless Chromium renders this site exactly as a
 * reader's browser would - including the parts of it that only a real layout engine can produce.
 *
 * The output is `dist/<route>.html`, which Cloudflare Pages serves at `/<route>` itself. A
 * `dist/<route>/index.html` would be served at `/<route>/` instead, with a 308 from the slashless
 * address every canonical URL, sitemap entry and internal link uses. The home page overwrites
 * `dist/index.html`, which stays the SPA fallback for anything unmatched, and this also writes `dist/404.html`, `dist/sitemap.xml` and `dist/robots.txt` - see the bottom of
 * this file.
 *
 * Three things are deliberately not in a snapshot:
 *
 * - **The live examples.** Each one is an island (`<solid-native-island>`, from `@solidnative/web/solid`)
 *   rendering `<view>` and `<text>`, element names no browser knows and no crawler can read. They are emptied here and mount on the client,
 *   which is the only place they can run. The prose around them is the point of this file.
 * - **A theme.** `index.html`'s pre-paint script decides `dark` from the reader's own storage and
 *   system preference, so the class must not be baked. The head below comes from the built
 *   `index.html` untouched rather than from the browser, which settles it by construction.
 * - **The head Vite rewrites at runtime.** Loading a lazy chunk appends a `<link rel="modulepreload">
 *   href="http://127.0.0.1:<port>/...">` naming this script's own throwaway server. Taking the
 *   built head instead of the rendered one keeps that out, at the cost of the preload hints a
 *   snapshot could otherwise have carried.
 *
 * The client does not hydrate the snapshot: Solid's `render()` appends beside whatever the host
 * already holds, so `src/main.tsx` waits for the router's first page and then clears `<app-root>`
 * before rendering, which makes the snapshot inert markup the application replaces. That costs a
 * re-render on boot and buys served HTML that is correct for every reader, which is the trade this
 * file exists to make.
 *
 * A page's title, description, canonical URL, Open Graph/Twitter tags and structured data are not
 * baked from anything this file computes either: `src/seo.ts` sets them at runtime from `landing/landing.tsx`'s
 * own copy or a document's front matter, the same code path a client navigation runs, and this file
 * only reads them back out of `document.head` once a route has settled - see `render()`.
 */
import { chromium, type Page } from 'playwright';
import { execFile } from 'node:child_process';
import { createServer, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { promisify } from 'node:util';
import { READING_ORDER, SECTIONS, STANDALONE_PAGES, flattenItems } from '../src/navigation.ts';
import { EXAMPLE_APPS } from '../src/example-apps/registry.ts';
import { LESSONS } from '../src/learn/outline.ts';
import { DEFAULT_DESCRIPTION, SITE_NAME, urlFor } from '../src/site.ts';

const execFileAsync = promisify(execFile);
const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const dist = path.resolve(dirname, '../dist');
const root = path.resolve(dirname, '..');

/** Enough of a content-type table for what `vite build` emits. */
const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.map': 'application/json',
};

/** The one element the built `index.html` has in its body, and the one this replaces. */
const HOST = '<app-root></app-root>';

/** A route to snapshot, and the source file its `lastmod` in the sitemap comes from. */
interface RouteEntry {
  readonly path: string;
  readonly source: string;
}

/**
 * Every route worth a snapshot, and the file behind it.
 *
 * `navigation.ts`'s `READING_ORDER` is the site's reading order flattened - every guide and
 * package page, parents and children alike - so it is read rather than restated - a page added to
 * the sidebar, at any depth, is prerendered without anyone remembering to list it twice. (An
 * earlier version of this file read `SECTIONS` directly and mapped only its top-level items, which
 * silently dropped every child page - the flattening is why `READING_ORDER` exists as its own
 * export rather than being inlined here.)
 */
function routes(): readonly RouteEntry[] {
  const pages = [...READING_ORDER, ...STANDALONE_PAGES].map((item) => ({
    path: `/${item.path}`,
    source: path.join(root, 'src/content', `${item.path}.md`),
  }));
  // The course: its index, and each written lesson, whose prose is its `lesson.md`.
  const course = [
    { path: '/learn', source: path.join(root, 'src/learn/outline.ts') },
    ...LESSONS.filter((lesson) => !lesson.planned).map((lesson) => ({
      path: `/learn/${lesson.slug}`,
      source: path.join(root, 'src/learn/lessons', lesson.slug, 'lesson.md'),
    })),
  ];
  // The example apps: the gallery, and each app's page, whose content is the app's own folder.
  const examples = [
    { path: '/examples', source: path.join(root, 'src/example-apps/registry.ts') },
    ...EXAMPLE_APPS.map((app) => ({
      path: `/examples/${app.slug}`,
      source: path.join(root, '../..', app.sourceRoot),
    })),
  ];
  return [
    { path: '/', source: path.join(root, 'src/landing/landing.tsx') },
    ...pages,
    ...course,
    ...examples,
  ];
}

/**
 * The built site, on a port nobody asked for.
 *
 * Port 0 so the operating system picks a free one: this runs on a machine that may already have
 * the dev server, a Metro bundler and an emulator on the ports this repository normally uses, and
 * a build step has no business competing for any of them.
 *
 * A path with an extension is a file; everything else is a route and gets the shell. That is
 * ordinary SPA fallback, and it also makes the run immune to its own output - a snapshot written
 * to `dist/packages/components/touch.html` cannot become the shell a later route boots from.
 * It is also how `dist/404.html` gets rendered: nothing on this site routes to `/__not-found__`, so
 * the client router falls through to `doc-page`'s own not-found branch, the same as a reader
 * mistyping a URL would see.
 */
async function serve(shell: string): Promise<{ origin: string; close: () => void }> {
  const server = createServer((request, response) => {
    const file = decodeURIComponent(new URL(request.url ?? '/', 'http://host').pathname);
    const extension = path.extname(file);
    if (!extension) return html(response, shell);
    readFile(path.join(dist, file)).then(
      (body) => {
        response.writeHead(200, { 'content-type': TYPES[extension] ?? 'application/octet-stream' });
        response.end(body);
      },
      () => html(response, shell),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('No port for the server');
  return { origin: `http://127.0.0.1:${address.port}`, close: () => server.close() };
}

function html(response: ServerResponse, body: string): void {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(body);
}

/** What one route contributes to its snapshot, past the built `index.html`'s own head. */
interface Rendered {
  readonly root: string;
  readonly styles: readonly string[];
  readonly title: string;
  /** The description `<meta>` tag's own `outerHTML`, already carrying the page's content. */
  readonly description: string;
  /** Canonical link, robots, Open Graph, Twitter and structured data - see `render()`. */
  readonly extras: readonly string[];
}

/**
 * One route, rendered and scrubbed.
 *
 * The wait is in two parts because either alone would be a guess. `h1` proves the chain finished -
 * the router resolved, the lazy chunk and the markdown arrived and `doc-content` drew it - and the
 * network settling afterwards proves nothing is still on its way, including the stylesheet a lazy
 * page brings with it and the `<title>`/`<meta>`/`<link>` tags `seo.ts` writes once the page it
 * describes has resolved.
 */
async function render(page: Page, origin: string, route: string): Promise<Rendered> {
  await page.goto(origin + route, { waitUntil: 'load' });
  // `main.tsx` swaps the served snapshot for the live page; until it has, `app-root` holds the
  // bare shell this server sends, which has no `main`.
  await page.waitForSelector('app-root main h1', { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  return page.evaluate((served) => {
    // Everything inside a `doc-example` or a `landing-island` is a mounted island, drawn by the
    // browser host's universal renderer rather than the page's DOM renderer - the latter is how
    // the landing page's devices mount their components. None of it survives the boot that
    // follows, and a crawler reading `<view>` and `<text>` as prose is worse than reading nothing.
    //
    // A lesson's editor and phone are the same: CodeMirror's DOM and a preview frame that only
    // mean anything once the page is running. The steps beside them are the prose.
    for (const example of document.querySelectorAll(
      'doc-example, landing-island, learn-code-editor, learn-lesson-preview',
    )) {
      example.replaceChildren();
    }
    // An island embedded anywhere else: emptied, and no longer marked as a root.
    for (const island of document.querySelectorAll('solid-native-island, [data-rn-root]')) {
      island.replaceChildren();
      island.removeAttribute('data-rn-root');
      island.classList.remove('platform-web');
    }
    const head = document.head;
    return {
      root: document.querySelector('app-root')?.outerHTML ?? '',
      // Inline styles carry no URLs, so unlike most `<link>` elements they are safe to bake, and
      // without them a reader with no JavaScript gets unstyled islands. The stylesheets a lazy page
      // brought with it are baked too, by path: they name this script's throwaway origin.
      styles: [
        ...[...head.querySelectorAll('style')].map((style) => style.outerHTML),
        ...[...head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
          .map((link) => new URL(link.href).pathname)
          .filter((href) => !served.includes(`href="${href}"`))
          .map((href) => `<link rel="stylesheet" crossorigin href="${href}">`),
      ],
      title: document.title,
      description: head.querySelector('meta[name="description"]')?.outerHTML ?? '',
      extras: [
        ...head.querySelectorAll(
          'meta[name="robots"], link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], #structured-data',
        ),
      ].map((element) => element.outerHTML),
    };
  }, shellHead);
}

/**
 * The built `index.html`, with one route's own head and body spliced in.
 *
 * Replacer functions rather than replacement strings throughout: a `$&` or a `$'` in a page - and
 * this site puts source code on most of them - is a substitution pattern to `String.replace` when
 * the replacement is a string, and would be spliced into the output silently. The title and
 * description patterns match the built `index.html`'s own static defaults (see that file), which
 * `landing/landing.tsx` keeps in sync so the home page's snapshot does not visibly change when this replaces
 * them with what `seo.ts` computed at runtime.
 */
/**
 * The site's display and body faces, fetched alongside the stylesheet rather than after it: every
 * page paints its largest text in them, and a late swap from the fallback reflows that text and
 * moves Largest Contentful Paint to whenever the font arrived.
 */
const FONT_PRELOADS = [
  '<link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin />',
  '<link rel="preload" href="/fonts/instrument-sans-latin.woff2" as="font" type="font/woff2" crossorigin />',
].join('\n');

function compose(shell: string, snapshot: Rendered, preloads = ''): string {
  return shell
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(snapshot.title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/, () => snapshot.description)
    .replace(HOST, () => snapshot.root)
    .replace('<title>', () => `${preloads}\n<title>`)
    .replace(
      '</head>',
      () => `${snapshot.extras.join('\n')}\n${snapshot.styles.join('\n')}\n</head>`,
    );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function writeSnapshot(route: string, snapshot: string): Promise<void> {
  if (snapshot.includes('data-rn-root')) throw new Error(`${route} kept an island`);
  const file = route === '/' ? path.join(dist, 'index.html') : path.join(dist, `${route}.html`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, snapshot);
}

/**
 * `git`'s own record of when a page last changed, as a plain date - `undefined` if `git` has
 * nothing to say (a brand-new file with no commit yet, or this running outside a git checkout at
 * all), which the sitemap then omits the `<lastmod>` for rather than inventing one.
 */
async function lastModified(source: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI', '--', source], {
      cwd: root,
    });
    const date = stdout.trim().slice(0, 10);
    return date || undefined;
  } catch {
    return undefined;
  }
}

async function writeSitemap(routeList: readonly RouteEntry[]): Promise<void> {
  const urls = await Promise.all(
    routeList.map(async (route) => ({
      loc: urlFor(route.path),
      lastmod: await lastModified(route.source),
    })),
  );
  const body = urls
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n` +
        (entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>\n` : '') +
        `  </url>`,
    )
    .join('\n');
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${body}\n` +
    '</urlset>\n';
  await writeFile(path.join(dist, 'sitemap.xml'), xml);
}

async function writeRobots(): Promise<void> {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${urlFor('/sitemap.xml')}\n`;
  await writeFile(path.join(dist, 'robots.txt'), body);
}

/** A page's markdown, split into its front matter's summary and the body a reader sees. */
function splitFrontMatter(markdown: string): { summary: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
  if (!match) return { summary: '', body: markdown.trim() };
  const summary = /^summary:\s*(.*)$/m.exec(match[1]!)?.[1]?.trim() ?? '';
  return { summary, body: markdown.slice(match[0].length).trim() };
}

/**
 * What a coding agent reads instead of the HTML: `llms.txt`, the site in outline with a line on
 * each page, per llmstxt.org; a plain-markdown copy of every page beside its HTML, which is what
 * that outline links to; and `llms-full.txt`, every page in reading order in one file, for an
 * agent that would rather take it all at once. Written from the same markdown the pages render
 * from, in the sidebar's order, so it cannot drift from the site.
 */
async function writeLlms(): Promise<void> {
  const pages = new Map<string, { title: string; summary: string; body: string }>();
  for (const item of READING_ORDER) {
    const markdown = await readFile(path.join(root, 'src/content', `${item.path}.md`), 'utf8');
    const { summary, body } = splitFrontMatter(markdown);
    pages.set(item.path, { title: item.title, summary, body });
    const file = path.join(dist, `${item.path}.md`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${body}\n`);
  }

  const outline = SECTIONS.map((section) => {
    const lines = flattenItems(section.items).map((item) => {
      const page = pages.get(item.path)!;
      const link = `- [${page.title}](${urlFor(`/${item.path}.md`)})`;
      return page.summary ? `${link}: ${page.summary}` : link;
    });
    return `## ${section.title}\n\n${lines.join('\n')}`;
  });
  const index =
    `# ${SITE_NAME}\n\n> ${DEFAULT_DESCRIPTION}\n\n` +
    "Solid components render real iOS and Android views on React Native's Fabric renderer, " +
    'with an Expo app around them. Components are TSX using the native components from ' +
    '`@solidnative/components/solid` (`<View>`, `<Text>`, `<Pressable>`), styled with React Native ' +
    'style objects, `.native.css` stylesheets or Tailwind. There is no DOM.\n\n' +
    `${outline.join('\n\n')}\n\n` +
    `## Optional\n\n- [Everything above in one file](${urlFor('/llms-full.txt')})\n` +
    `- [Rules for a coding agent, as an app's AGENTS.md](${urlFor('/agents.md')})\n`;
  await writeFile(path.join(dist, 'llms.txt'), index);
  await writeAgents();

  const full = READING_ORDER.map((item) => {
    const page = pages.get(item.path)!;
    return `<!-- ${urlFor(`/${item.path}`)} -->\n\n${page.body}`;
  });
  await writeFile(path.join(dist, 'llms-full.txt'), `${full.join('\n\n---\n\n')}\n`);
}

/**
 * The template's `AGENTS.md`, for an app that did not start from the template: the same rules, at
 * an address that stays put. Without its Commands section, which is the template's npm scripts and
 * not what another app runs.
 */
async function writeAgents(): Promise<void> {
  const agents = await readFile(path.join(root, '../../template/AGENTS.md'), 'utf8');
  await writeFile(
    path.join(dist, 'agents.md'),
    agents.replace(/## Commands\n[\s\S]*?\n\n(?=## )/, ''),
  );
}

/** The built `index.html`'s head, which already links the entry's own stylesheet. */
let shellHead = '';

async function prerender(): Promise<void> {
  const shell = await readFile(path.join(dist, 'index.html'), 'utf8');
  shellHead = shell.slice(0, shell.indexOf('</head>'));
  if (!shell.includes(HOST)) throw new Error(`dist/index.html has no ${HOST} to replace`);
  const server = await serve(shell);
  // `colorScheme: 'light'` so the run does not inherit whatever the machine building it prefers.
  // It settles the one thing the theme reaches that is not the `dark` class: the header's toggle
  // renders a moon or a sun from `theme.ts`'s `scheme()`. Baked as a moon it is wrong only for a
  // reader with no JavaScript, for whom the button does nothing either way; everyone else has it
  // replaced on boot, after the pre-paint script has already put the real class on the root.
  // `CHROMIUM_PATH` points at a Chromium already on the machine, where Playwright's own download
  // is not there to find.
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ colorScheme: 'light' });
  page.on('pageerror', (error) => console.warn(`  ! ${error.message}`));
  try {
    const routeList = routes();
    for (const route of routeList) {
      const snapshot = await render(page, server.origin, route.path);
      await writeSnapshot(route.path, compose(shell, snapshot, FONT_PRELOADS));
      console.log(`  prerendered ${route.path}`);
    }

    // No route on this site matches `/__not-found__`, so this exercises exactly what a reader
    // hitting a typo'd URL does: the wildcard route resolves, `doc-page` fails to find a document
    // for it, and its own not-found branch renders - see `doc-page.tsx`. `seo.ts`'s `applyNotFound()`
    // is what puts `noindex` on it, so a crawler that does execute the JavaScript does not index a
    // page that says nothing was found.
    const notFound = await render(page, server.origin, '/__not-found__');
    await writeFile(path.join(dist, '404.html'), compose(shell, notFound));
    console.log('  prerendered 404.html');

    await writeSitemap(routeList);
    await writeRobots();
    console.log('  wrote sitemap.xml and robots.txt');
    await writeLlms();
    console.log('  wrote llms.txt, llms-full.txt, agents.md and a markdown copy of every page');
  } finally {
    await browser.close();
    server.close();
  }
}

await prerender();
