/**
 * The site's router: the History API, a route table and nothing else.
 *
 * Six routes, and the last one is not a fallback but the main route: every guide and package page
 * is a markdown file resolved from the URL (see `content.ts`), so they need no entry of their own.
 * Each page is a lazy chunk, so a reader who opened one page has downloaded one page.
 *
 * A navigation commits only once the next page is ready - its chunk loaded and, for a document,
 * its markdown - so the page being left stays on screen until then, and `currentPath()` changes
 * together with the page it describes. After the commit the window scrolls to the URL's `#anchor`
 * when it has one and to the top otherwise: every navigation here is to a different document.
 *
 * Plain same-origin `<a href>` clicks are taken over globally, because prose, API tables and
 * search results are rendered HTML rather than components, and following one of their links must
 * not reload the site.
 */
import {
  createComponent,
  createMemo,
  createSignal,
  untrack,
  type Component,
  type JSX,
} from 'solid-js';
import { loadDoc, type DocModule } from './content.ts';

/** Which shell a page sits in; see `app.tsx`. */
export type Layout = 'home' | 'docs' | 'course' | 'workspace';

interface Route {
  readonly pattern: RegExp;
  readonly layout: Layout;
  readonly load: () => Promise<Component<never>>;
  /** Props for the page, from the pattern's groups and anything the route resolves first. */
  readonly props: (match: RegExpExecArray, path: string) => Promise<Record<string, unknown>>;
}

const none = async () => ({});
const slug = async (match: RegExpExecArray) => ({ slug: decodeURIComponent(match[1]!) });

/** The markdown page for the path, or `null` when there is none: see `doc-page.tsx`. */
async function doc(_: RegExpExecArray, path: string) {
  const relative = path.replace(/^\/+/, '');
  const load = loadDoc(relative);
  const found: DocModule | null = load ? await load().catch(() => null) : null;
  return { path: relative, doc: found };
}

const ROUTES: readonly Route[] = [
  {
    pattern: /^\/$/,
    layout: 'home',
    load: () => import('./landing/landing.tsx').then((m) => m.Home as Component<never>),
    props: none,
  },
  // The course. Its lesson page is a workspace rather than a document, so the shell drops the
  // sidebar and footer for everything under `learn`; see `app.tsx`.
  {
    pattern: /^\/learn$/,
    layout: 'course',
    load: () => import('./learn/course-page.tsx').then((m) => m.CoursePage as Component<never>),
    props: none,
  },
  {
    pattern: /^\/learn\/([^/]+)$/,
    layout: 'workspace',
    load: () => import('./learn/lesson-page.tsx').then((m) => m.LessonPage as Component<never>),
    props: slug,
  },
  // The example apps: a gallery, and a page for each with its code. See `example-apps/registry.ts`.
  {
    pattern: /^\/examples$/,
    layout: 'course',
    load: () =>
      import('./example-apps/gallery-page.tsx').then(
        (m) => m.ExampleGalleryPage as Component<never>,
      ),
    props: none,
  },
  {
    pattern: /^\/examples\/([^/]+)$/,
    layout: 'course',
    load: () =>
      import('./example-apps/example-app-page.tsx').then(
        (m) => m.ExampleAppPage as Component<never>,
      ),
    props: slug,
  },
  {
    pattern: /^\/.*$/,
    layout: 'docs',
    load: () => import('./doc-page.tsx').then((m) => m.DocPage as Component<never>),
    props: doc,
  },
];

/** `/guide/offline/` -> `/guide/offline`; the home page stays `/`. */
function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function matchRoute(path: string): { route: Route; match: RegExpExecArray } {
  for (const route of ROUTES) {
    const match = route.pattern.exec(path);
    if (match) return { route, match };
  }
  throw new Error(`No route for ${path}`);
}

const [path, setPath] = createSignal(normalize(location.pathname));
const [hash, setHash] = createSignal(decodeURIComponent(location.hash.slice(1)));
const [active, setActive] = createSignal<{ layout: Layout; component: Component<never> }>();
const [params, setParams] = createSignal<Record<string, unknown>>({});

/** The committed page's pathname: no trailing slash, `/` for the home page. Reactive. */
export function currentPath(): string {
  return path();
}

/** The committed URL's fragment, without the `#`; empty when there is none. Reactive. */
export function currentHash(): string {
  return hash();
}

/**
 * The committed page's shell. Before the first commit it is read from the address bar, so the
 * shell never draws the wrong chrome around a page that is still loading.
 */
export function currentLayout(): Layout {
  return active()?.layout ?? matchRoute(normalize(location.pathname)).route.layout;
}

let latest = 0;

/** Loads what the URL needs, then commits it - unless a later navigation has started meanwhile. */
async function resolve(url: URL, scroll: boolean): Promise<void> {
  const token = ++latest;
  const next = normalize(url.pathname);
  const { route, match } = matchRoute(next);
  const [component, props] = await Promise.all([route.load(), route.props(match, next)]);
  if (token !== latest) return;
  const current = untrack(active);
  if (current?.component !== component || current.layout !== route.layout) {
    setActive({ layout: route.layout, component });
  }
  setParams(props);
  setPath(next);
  setHash(decodeURIComponent(url.hash.slice(1)));
  if (scroll) scrollAfterCommit(url.hash.slice(1));
}

/**
 * The anchor, once it exists, or the top. A few frames of patience, because a page can draw its
 * headings a beat after it commits (an island, an API table).
 */
function scrollAfterCommit(fragment: string): void {
  if (!fragment) {
    window.scrollTo(0, 0);
    return;
  }
  const id = decodeURIComponent(fragment);
  let frames = 0;
  const attempt = () => {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView();
    else if (++frames < 30) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}

/** Goes to a same-origin URL without reloading; anything else is an ordinary page load. */
export function navigate(href: string, options: { replace?: boolean } = {}): void {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin) {
    location.assign(url.href);
    return;
  }
  const target = url.pathname + url.search + url.hash;
  if (options.replace) history.replaceState(null, '', target);
  else history.pushState(null, '', target);
  // The same page with a new anchor scrolls to it without reloading the page.
  if (normalize(url.pathname) === untrack(path) && url.hash) {
    setHash(decodeURIComponent(url.hash.slice(1)));
    scrollAfterCommit(url.hash.slice(1));
    return;
  }
  void resolve(url, true);
}

/**
 * The committed page. The component is kept across a change of its own props - a lesson to the
 * next lesson, one document to another - so `props.slug` and `props.path` are reactive.
 */
export function RouteView(): JSX.Element {
  const component = createMemo(() => active()?.component);
  const props = new Proxy({} as Record<string, unknown>, {
    get: (_, key) => params()[key as string],
    has: (_, key) => key in params(),
    ownKeys: () => Reflect.ownKeys(params()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  return createMemo(() => {
    const page = component();
    return page ? untrack(() => createComponent(page, props as never)) : undefined;
  }) as unknown as JSX.Element;
}

/** A left click with no modifier key: one the router may take over. */
function plainClick(event: MouseEvent): boolean {
  const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  return !event.defaultPrevented && event.button === 0 && !modified;
}

/** The same-site page a plain left click on a link is heading for, or `null` to leave it be. */
function routableLink(event: MouseEvent): URL | null {
  if (!plainClick(event)) return null;
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute('download')) {
    return null;
  }
  const url = new URL(link.href);
  // A file the site serves as it is (llms.txt, a page's markdown copy) is not a route.
  if (url.origin !== location.origin || /\.[a-z0-9]+$/i.test(url.pathname)) return null;
  return url;
}

let started: Promise<void> | undefined;

/**
 * Takes over link clicks and the back button, and resolves the address bar. The promise settles
 * once the first page is ready, which is when `main.tsx` swaps the prerendered snapshot for it.
 */
export function startRouter(): Promise<void> {
  if (started) return started;
  document.addEventListener('click', (event) => {
    const url = routableLink(event);
    if (!url) return;
    event.preventDefault();
    navigate(url.href);
  });
  window.addEventListener('popstate', () => void resolve(new URL(location.href), true));
  started = resolve(new URL(location.href), false).then(() => {
    if (location.hash) scrollAfterCommit(location.hash.slice(1));
  });
  return started;
}
