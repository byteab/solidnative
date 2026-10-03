/**
 * Tailwind in the phone: Tailwind's own compiler, run in the page over the class names in the
 * learner's files, with `@solidnative/tailwind`'s native preset as its stylesheet - the input an
 * app's `styles.css` gives it:
 *
 *     @import "tailwindcss/theme.css";
 *     @import "tailwindcss/utilities.css";
 *     @import "@solidnative/tailwind/native.css";
 *
 * `native.css`, not `web.css`: this is a phone, so `hover:` is the pressed state, as on a device.
 *
 * One compile answers twice. The browser gets the CSS as it is, under the React Native reset in
 * a lower layer so the reset never beats a utility. A device build would put the same CSS through
 * `flattenTailwind` and the native compiler, and so does `nativeTailwind` (see `native-css.ts`),
 * which is how the learner's tests see Tailwind's styles and how the preview can say which
 * classes a phone would not build.
 *
 * Compiled from the source rather than scanned off the rendered page, so the stylesheet is in
 * place before the app mounts and a rerun never paints unstyled for a frame. Anything that looks
 * like a class name is a candidate; Tailwind ignores the ones that are not.
 */
import native from '@solidnative/tailwind/native.css?raw';
import shared from '@solidnative/tailwind/shared.css?raw';
import reset from '@solidnative/web/reset.css?raw';
import { compile } from 'tailwindcss';
import theme from 'tailwindcss/theme.css?raw';

const INPUT = [
  theme,
  '@tailwind utilities;',
  shared,
  native.replace(/^@import\s+['"]\.\/shared\.css['"];\s*$/m, ''),
].join('\n');

/**
 * Where class names are written: a `class="..."` attribute, and any quoted or backquoted string,
 * which is where a class chosen in code lives (`class={done() ? 'text-emerald-600' : '...'}`).
 * Narrower than Tailwind's own scanner, which takes every word in a file: a stylesheet saying
 * `display: grid` would otherwise make a `grid` utility, and the preview would warn about a class
 * nobody wrote.
 */
const CLASS_ATTRIBUTE = /(?<![[.\w-])class="([^"]*)"/g;
const QUOTED = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g;

export function candidatesIn(files: Readonly<Record<string, string>>): string[] {
  const words = new Set<string>();
  const add = (text: string | undefined) => {
    for (const word of text?.split(/\s+/) ?? []) {
      const bare = word.replace(/^['"]|['"]$/g, '');
      if (bare) words.add(bare);
    }
  };
  for (const source of Object.values(files)) {
    for (const [, value] of source.matchAll(CLASS_ATTRIBUTE)) add(value);
    for (const [, single, double, back] of source.matchAll(QUOTED)) add(single ?? double ?? back);
  }
  return [...words];
}

export interface TailwindOutput {
  readonly css: string;
  /**
   * Whether any class in the files is a utility. Without one there is nothing to check against
   * native, and no reason to download the native compiler for it.
   */
  readonly used: boolean;
}

let empty: Promise<string> | undefined;

/** The CSS Tailwind writes for the learner's files. A fresh compile, so old classes drop out. */
export async function tailwindCss(
  files: Readonly<Record<string, string>>,
): Promise<TailwindOutput> {
  empty ??= compile(INPUT).then((compiler) => compiler.build([]));
  const css = (await compile(INPUT)).build(candidatesIn(files));
  return { css, used: css !== (await empty) };
}

let base: HTMLStyleElement | undefined;
let utilities: HTMLStyleElement | undefined;

/** Put `css` on the page, beneath the reset in the cascade, replacing what was there. */
export function applyTailwind(css: string): void {
  if (!base || !utilities) {
    base = document.createElement('style');
    base.textContent = `@layer base {\n${reset}\n}`;
    utilities = document.createElement('style');
    document.head.append(base, utilities);
  }
  utilities.textContent = css;
}
