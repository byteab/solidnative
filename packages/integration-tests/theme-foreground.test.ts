/**
 * The colour text falls back to when it names none.
 *
 * Most text in a themed app never names a colour: labels, titles and prose inherit one, and on the
 * web they inherit it from a base layer that does `body { color: var(--foreground) }`. There is no
 * `body` here, so a theme has to set `color` on the blocks that hold its tokens, or every such
 * element falls back to the initial `color` - opaque black. In light mode that is very nearly
 * right and nobody notices; in dark mode it is black text on a near-black ground, which is what
 * this pins.
 *
 * The whole sheet is built by the real Tailwind CLI and put through the real flatten rather than
 * read off disk, because both steps are load-bearing for the fix and neither is optional:
 *
 *   - the flatten lowers `oklch()` to `rgb()` and unwraps the `@supports` fallback lightningcss
 *     emits around a `var()` holding a wide-gamut colour, which the device compiler refuses;
 *   - `substituteInRules` resolves a `var()` against the declarations of *its own rule*, which is
 *     the entire reason `color: var(--foreground)` can mean one thing inside `:root` and another
 *     inside `.dark`. Written once on `:root` it would resolve to the light value and inherit that
 *     downwards whatever the theme said.
 *
 * Compiling the theme straight from source tests a pipeline that does not exist: it has an
 * `@theme inline` block no CSS parser accepts, and it has had neither of those two passes.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StyleSheet } from '@solidnative/fabric';
import { mountSolid } from './css-solid-harness.ts';
import { themeForeground } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

/**
 * A theme in the shape an app writes one: the tokens in `:root` and `.dark`, each block setting
 * `color` from its own `--foreground`, and an `@theme inline` block exposing the token to the
 * utilities.
 *
 * `color` goes in both blocks rather than only `:root` because the two are siblings in the
 * cascade, not nested: `.dark` is a class on the app's own root view, and a `var(--foreground)`
 * written once on `:root` would resolve there, against the light token, and inherit that value
 * downwards whatever the theme said.
 */
const THEME = `
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  color: var(--foreground);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  color: var(--foreground);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}
`;

/**
 * The app's own stylesheet, built the way an app builds it.
 *
 * From this package's own directory, which has `tailwindcss` and `@solidnative/tailwind`
 * installed, because the CLI resolves imports from the entry file's own directory - the same
 * reason `preset-variants.test.ts` builds from here.
 */
function buildTheme(): string {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const entry = join(dir, '.theme-foreground-test.css');
  const outDir = mkdtempSync(join(tmpdir(), 'theme-'));
  const out = join(outDir, 'out.css');
  writeFileSync(
    entry,
    [
      `@import 'tailwindcss/theme.css';`,
      `@import 'tailwindcss/utilities.css';`,
      `@import '@solidnative/tailwind/native.css';`,
      THEME,
    ].join('\n'),
  );
  try {
    execFileSync('npx', ['@tailwindcss/cli', '-i', entry, '-o', out], { cwd: dir, stdio: 'pipe' });
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(entry, { force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
}

describe('text that names no colour', () => {
  let sheet: StyleSheet;

  before(() => {
    // `withTailwind` runs the flatten as part of the Metro transform, so what reaches `compileCss`
    // in a real build is the CLI's output already folded - which is what this hands it.
    sheet = compileCss(
      require('@solidnative/tailwind/flatten.cjs').flattenTailwind(buildTheme()),
      'global',
      // What the Metro transform passes: Tailwind's own `@theme` carries declarations native has
      // no form for (`--text-xs--line-height` and friends), and a build drops those with a warning
      // rather than failing. Throwing here would only be testing that Tailwind emits browser CSS.
      { onUnsupported: () => {} },
    );
  });

  const colourOf = (dark: boolean) => {
    const mounted = mountSolid(themeForeground(dark), { globalStyles: sheet });
    const colour = mounted.byId('plain').props['color'];
    mounted.root.dispose();
    return colour;
  };

  it('takes the light foreground by default', () => {
    // `--foreground` light is `oklch(0.145 0 0)`: near black, but the *token's* near black rather
    // than the initial value's, which is the difference between themeable and accidental.
    assert.equal(colourOf(false), 'rgb(10, 10, 10)');
  });

  it('takes the dark foreground under .dark, rather than staying black', () => {
    // The bug: no rule set `color` at all, so this was undefined and the platform painted its own
    // default - black text on a near-black background.
    assert.equal(colourOf(true), 'rgb(250, 250, 250)');
  });
});
