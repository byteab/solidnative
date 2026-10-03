/**
 * Same-page links, written out with the page's own path.
 *
 * The site sets `<base href="/">`, which a bare `#heading` resolves against, so an in-page link in
 * the markdown went to the home page instead of down the page it was on.
 */

/** `.../src/content/packages/testing/api.md` -> `/packages/testing/api`; nothing outside content. */
export function pageUrl(file: string): string | undefined {
  return /\/src\/content(\/.+)\.md$/.exec(file)?.[1];
}

export function pageLinks(html: string, url: string | undefined): string {
  return url === undefined ? html : html.replaceAll('href="#', `href="${url}#`);
}
