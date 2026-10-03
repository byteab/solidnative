import { describe, expect, it } from 'vitest';
import { scopeSelector, sheetId } from './browser-css.ts';

describe('scopeSelector', () => {
  it('scopes every compound, before any pseudo-element, as the Vite build does', () => {
    expect(scopeSelector('.habit', 'x')).toBe('.habit[data-s-x]');
    expect(scopeSelector('.habit:active', 'x')).toBe('.habit:active[data-s-x]');
    expect(scopeSelector('.list > .row  .name', 'x')).toBe(
      '.list[data-s-x] > .row[data-s-x]  .name[data-s-x]',
    );
    expect(scopeSelector('.a, .b::before', 'x')).toBe('.a[data-s-x], .b[data-s-x]::before');
    expect(scopeSelector('.a:not(.b, .c) ~ .d', 'x')).toBe(
      '.a:not(.b, .c)[data-s-x] ~ .d[data-s-x]',
    );
    expect(scopeSelector('[title="a b"]', 'x')).toBe('[title="a b"][data-s-x]');
  });

  it('turns :host into the host attribute', () => {
    expect(scopeSelector(':host', 'x')).toBe('[data-h-x]');
    expect(scopeSelector(':host(.dark) .title', 'x')).toBe('[data-h-x].dark .title[data-s-x]');
  });
});

describe('sheetId', () => {
  it('is stable, and differs with the file or the text', () => {
    expect(sheetId('app.native.css', '.a {}')).toMatch(/^[0-9a-f]{16}$/);
    expect(sheetId('app.native.css', '.a {}')).toBe(sheetId('app.native.css', '.a {}'));
    expect(sheetId('app.native.css', '.a {}')).not.toBe(sheetId('row.native.css', '.a {}'));
    expect(sheetId('app.native.css', '.a {}')).not.toBe(sheetId('app.native.css', '.b {}'));
  });
});
