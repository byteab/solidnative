/**
 * Search over the documentation, from the index Pagefind writes into `dist/pagefind` after the
 * prerender (see the build script in package.json). The dialog that uses it is `search.tsx`.
 *
 * The index is static files next to the site, so nothing here talks to a service: the first
 * search loads Pagefind's own script from the site and it fetches only the index fragments a term
 * needs. It covers the doc pages alone, because `doc-page.tsx` is the one template carrying
 * `data-pagefind-body`. A development server has no index, and says so rather than finding nothing.
 */

/** The part of Pagefind's browser API this uses. */
export interface Pagefind {
  debouncedSearch(term: string): Promise<{ results: PagefindResult[] } | null>;
}

interface PagefindResult {
  data(): Promise<{ url: string; excerpt: string; meta: { title?: string } }>;
}

export interface Hit {
  readonly url: string;
  readonly title: string;
  readonly excerpt: string;
}

/** A URL rather than a module specifier, so the bundler leaves it for the browser to load. */
const PAGEFIND = '/pagefind/pagefind.js';
export const LIMIT = 8;

let pagefind: Promise<Pagefind | null> | undefined;

/** Pagefind's script, loaded once; `null` where there is no index (a development server). */
export function loadPagefind(): Promise<Pagefind | null> {
  pagefind ??= import(/* @vite-ignore */ PAGEFIND).then(
    (module: Pagefind) => module,
    () => null,
  );
  return pagefind;
}

/** Pagefind names a page by its file's folder, `/guide/offline/`; the router's name has no slash. */
export function routeFor(url: string): string {
  return url.replace(/(.)\/(?=$|#)/, '$1');
}
