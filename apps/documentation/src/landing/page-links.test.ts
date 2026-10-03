/**
 * The site sets `<base href="/">`, so a bare `#heading` link in a page's markdown resolves against
 * the root and lands on the home page. Each one is written out with its own page's path.
 */
import { describe, expect, it } from 'vitest';
import { pageLinks, pageUrl } from '../../build/page-links.ts';

describe('a same-page link', () => {
  it("carries its page's path, so the base href does not send it home", () => {
    expect(pageLinks('<a href="#options">options</a>', '/packages/testing/api')).toBe(
      '<a href="/packages/testing/api#options">options</a>',
    );
  });

  it('leaves links to other pages and sites alone', () => {
    const html = '<a href="/guide/forms#submit">a</a> <a href="https://expo.dev/#x">b</a>';
    expect(pageLinks(html, '/packages/testing/api')).toBe(html);
  });
});

describe("a page's path", () => {
  it('is its file under content, without the extension', () => {
    expect(pageUrl('/repo/apps/documentation/src/content/packages/testing/api.md')).toBe(
      '/packages/testing/api',
    );
  });

  it('is nothing for markdown outside content, such as a lesson', () => {
    expect(pageUrl('/repo/apps/documentation/src/learn/lessons/first-screen/lesson.md')).toBe(
      undefined,
    );
  });
});
