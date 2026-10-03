/**
 * The landing page shows a few lines of a screen's real source rather than the whole file: a
 * 239-line paywall said nothing at a glance. The lines are marked in the file itself, so the
 * excerpt stays the running code rather than a copy of it.
 */
import { describe, expect, it } from 'vitest';
import { excerpt, withoutMarkers } from '../../build/excerpt.ts';

const file = [
  '.plans {',
  '  flex: 1;',
  '}',
  '  /* excerpt: css */',
  '  .plan:active {',
  '    transform: scale(0.97);',
  '  }',
  '  /* excerpt end */',
  '.other {}',
].join('\n');

describe('an excerpt', () => {
  it('is the lines between its markers, dedented, in the language it names', () => {
    expect(excerpt(file)).toEqual({
      lang: 'css',
      text: '.plan:active {\n  transform: scale(0.97);\n}\n',
    });
  });

  it('takes a template region in HTML comments, and TypeScript in line comments', () => {
    const html =
      '  <!-- excerpt: html -->\n  <text class="ios:uppercase">Hi</text>\n  <!-- excerpt end -->';
    expect(excerpt(html)).toEqual({
      lang: 'html',
      text: '<text class="ios:uppercase">Hi</text>\n',
    });
    const ts = '// excerpt: ts\nexport const a = 1;\n// excerpt end';
    expect(excerpt(ts)).toEqual({ lang: 'ts', text: 'export const a = 1;\n' });
  });

  it('refuses a file with no region, so a missing marker fails the build rather than the page', () => {
    expect(() => excerpt('export const a = 1;')).toThrow(/excerpt/);
  });
});

describe('the whole file', () => {
  it('shows no markers', () => {
    expect(withoutMarkers(file)).not.toMatch(/excerpt/);
    expect(withoutMarkers(file)).toContain('.plan:active {');
  });
});
