/**
 * The tags a page's `<head>` needs beyond what `index.html` ships as a static default: a title
 * and description specific to the page, a canonical URL, Open Graph and Twitter tags, and
 * (for a document page) `BreadcrumbList` structured data.
 *
 * Plain DOM: each tag is found by its name or property and created the first time it is needed,
 * so a page that sets them twice still has one of each.
 *
 * Called once per page from `landing/landing.tsx`, `doc-page.tsx` and the other pages rather than
 * derived here, because nothing here knows a page's title or summary on its own - that is the
 * landing page's own copy and a document's front matter, and both callers already have it in hand.
 *
 * `build/prerender.ts` reads back what this produces: it waits for a route to settle and then
 * captures `document.title` and the tags written here, so the same code that updates a tag on a
 * client navigation is what a crawler with no JavaScript ends up reading too.
 */
import type { Breadcrumb } from './navigation.ts';
import { OG_IMAGE, SITE_NAME, urlFor } from './site.ts';

export interface PageSeo {
  /** Already suffixed with the site name where that applies - callers own the exact wording. */
  readonly title: string;
  readonly description: string;
  /** Leading slash, no trailing one except for `/` itself - what `urlFor` expects. */
  readonly path: string;
  readonly type: 'website' | 'article';
  readonly breadcrumbs?: readonly Breadcrumb[];
  /** Only the home page has one today: `SoftwareSourceCode`. */
  readonly structuredData?: object;
}

const STRUCTURED_DATA_ID = 'structured-data';

/** A `<meta>` addressed by `name` or `property`, created on first use. */
function meta(key: 'name' | 'property', value: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${key}="${value}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(key, value);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function link(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function structuredData(data: object | undefined): void {
  const existing = document.getElementById(STRUCTURED_DATA_ID);
  if (!data) {
    existing?.remove();
    return;
  }
  const script = existing ?? document.createElement('script');
  script.id = STRUCTURED_DATA_ID;
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

export function applySeo(page: PageSeo): void {
  document.title = page.title;
  meta('name', 'description', page.description);
  document.head.querySelector('meta[name="robots"]')?.remove();

  const url = urlFor(page.path);
  link('canonical', url);

  meta('property', 'og:title', page.title);
  meta('property', 'og:description', page.description);
  meta('property', 'og:url', url);
  meta('property', 'og:type', page.type);
  meta('property', 'og:site_name', SITE_NAME);
  meta('property', 'og:image', urlFor(OG_IMAGE));

  meta('name', 'twitter:card', 'summary_large_image');
  meta('name', 'twitter:title', page.title);
  meta('name', 'twitter:description', page.description);
  meta('name', 'twitter:image', urlFor(OG_IMAGE));

  structuredData(
    page.structuredData ??
      (page.breadcrumbs?.length ? breadcrumbList(page.breadcrumbs) : undefined),
  );
}

/** A page `doc-page` could not resolve a document for - see its not-found branch. */
export function applyNotFound(): void {
  document.title = `Not found - ${SITE_NAME}`;
  meta('name', 'robots', 'noindex');
  structuredData(undefined);
}

function breadcrumbList(items: readonly Breadcrumb[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.title,
      ...(item.path ? { item: urlFor(item.path) } : {}),
    })),
  };
}
