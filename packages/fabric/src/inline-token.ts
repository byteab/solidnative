/**
 * A custom property's value set on an element at run time, `[style.--tint]="tint()"` or
 * `style="--gap: 4px"`, as a token the cascade can read.
 *
 * A stylesheet's custom properties are converted when the app is built, where there is a CSS
 * parser (`@solidnative/metro/css/values.cjs`). A bound one only exists here, where there is not,
 * so this takes the shapes a binding actually holds and nothing more: a length in `px` or `%`, a
 * number, a colour as React Native writes one, and a word. Anything else is kept as a word, which
 * a use site that wants a length or a colour ignores, as it ignores an undefined token.
 */
import type { TokenValue } from './css.ts';
import { isNamedColor } from './transition.ts';

const PX = /^(-?\d*\.?\d+)px$/;
const PERCENT = /^-?\d*\.?\d+%$/;
const NUMBER = /^-?\d*\.?\d+$/;
/** `#fff`, `rgb()`, `rgba()`, `hsl()`, `hsla()` and `hwb()`: what React Native's `processColor` reads. */
const COLOR_FUNCTION = /^(#[\da-f]{3,8}|(rgba?|hsla?|hwb)\(.*\))$/i;
const WORD = /^-?[a-z][\w-]*$/i;
const WEIGHTS: Record<string, string> = { normal: '400', bold: '700' };

/**
 * CSS takes a bare 0 wherever it takes a length, and no other bare number. A number from 1 to 1000
 * is a weight as well, at the nearest hundred, which is every weight native draws.
 */
function fromNumber(value: number): TokenValue | undefined {
  if (!Number.isFinite(value)) return undefined;
  const weight =
    value >= 1 && value <= 1000
      ? { weight: String(Math.min(900, Math.max(100, Math.round(value / 100) * 100))) }
      : {};
  return value === 0 ? { number: 0, length: 0 } : { number: value, ...weight };
}

/**
 * A word is a keyword, `row`, and may be a colour, `red`, or a weight, `bold`, as well: every form
 * it can take, as the build-time conversion gives, and a use site reads the one it needs.
 */
function fromWord(text: string): TokenValue {
  const weight = WEIGHTS[text.toLowerCase()];
  return {
    keyword: text,
    ...(isNamedColor(text) ? { color: text } : {}),
    ...(weight ? { weight } : {}),
  };
}

export function tokenFromValue(value: unknown): TokenValue | undefined {
  if (typeof value === 'number') return fromNumber(value);
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  const px = PX.exec(text);
  if (px) return { length: Number(px[1]) };
  if (PERCENT.test(text)) return { length: text };
  if (NUMBER.test(text)) return fromNumber(Number(text));
  if (COLOR_FUNCTION.test(text)) return { color: text };
  return WORD.test(text) ? fromWord(text) : { keyword: text };
}
