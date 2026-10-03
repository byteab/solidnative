import { describe, expect, it } from 'vitest';
import { candidatesIn, tailwindCss } from './tailwind.ts';

describe('candidatesIn', () => {
  it('takes class attributes and quoted strings, and not stylesheet words', () => {
    const source = [
      '<View class="flex-1 ios:pt-4" classList={{ "bg-emerald-500": done() }}>',
      "  <Text class={done() ? 'line-through' : 'font-bold'}>x</Text>",
      '  <Text class={`text-base ${done() ? "" : ""}`}>y</Text>',
      '</View>',
    ].join('\n');
    const candidates = candidatesIn({
      'app.tsx': source,
      'app.native.css': '.row { display: grid; }',
    });
    expect(candidates).toEqual(
      expect.arrayContaining([
        'bg-emerald-500',
        'flex-1',
        'font-bold',
        'ios:pt-4',
        'line-through',
        'text-base',
      ]),
    );
    expect(candidates.includes('grid')).toBe(false);
    expect(candidates.includes("'font-bold'")).toBe(false);
  });
});

describe('tailwindCss', () => {
  it('writes the utilities the files use, with the native preset variants', async () => {
    const { css, used } = await tailwindCss({
      'app.tsx': '<View class="flex-row android:gap-2 dark:bg-black pt-safe"></View>',
    });
    expect(used).toBe(true);
    expect(css).toContain('.flex-row');
    expect(css).toContain('.platform-android .android\\:gap-2');
    expect(css).toContain('.dark .dark\\:bg-black');
    expect(css).toContain('var(--safe-area-inset-top, 0px)');
  });

  it('says when nothing in the files is a utility', async () => {
    expect((await tailwindCss({ 'app.tsx': '<Text class="title">Hi</Text>' })).used).toBe(false);
  });
});
