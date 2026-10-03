/**
 * `reset.css` and `RESET_CSS` say the same thing.
 *
 * The reset ships twice: as a file, for an app that would rather `@import` it and control its
 * ordering against Tailwind, and as a string, so `mount({ injectReset: true })` works for a
 * consumer whose bundler has no CSS loader. This package has no build step to generate one from
 * the other, so the two are maintained side by side.
 *
 * That is a standing invitation to drift, and it was accepted immediately: the first edit after
 * the pair was written - a base font, without which every `<text>` on a page rendered in the
 * browser's serif default - landed in the `.css` only. Nothing failed. The stylesheet an app
 * imports would have had the fix and the one `mount` injects would not, which is the same bug
 * appearing and not appearing depending on how the app was wired.
 *
 * So this compares them by declaration rather than by text, which is what lets the string copy
 * drop the comments and stay readable while still being provably the same rules.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RESET_CSS } from './reset-css.ts';

/**
 * The rules, as a comparable list: comments gone, whitespace collapsed.
 *
 * Deliberately not a CSS parser. The two files are written by the same hand in the same order, so
 * what needs catching is a declaration present in one and absent from the other, and a normalised
 * token list catches that without this test growing a dependency of its own.
 */
function declarations(css: string): string[] {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/\s+/g, ' '));
}

describe('the reset, in both of the forms it ships in', () => {
  it('carries exactly the same declarations either way', () => {
    const file = readFileSync(fileURLToPath(new URL('./reset.css', import.meta.url)), 'utf8');
    assert.deepEqual(
      declarations(RESET_CSS),
      declarations(file),
      'reset.css and RESET_CSS have drifted - reset.css is the one to edit',
    );
  });

  it('sets a font, which is the thing whose absence started this', () => {
    // Named rather than left to the general comparison above: a page with no font-family falls
    // back to the browser's serif default, which looks like the whole port is broken rather than
    // like one missing declaration.
    assert.match(RESET_CSS, /font-family:/);
    assert.match(RESET_CSS, /font-size: 14px/);
  });
});
