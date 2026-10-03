/**
 * A relative colour with a token in it, worked out on device: `oklch(from var(--brand) l c h /
 * 0.2)`. The compiler settles a relative colour of literals itself; one with a `var()` in it waits
 * for the token.
 *
 * The origin is converted into the function's space, each channel keyword is the number it is
 * there, on CSS Color 5's scale for it (`r g b` 0 to 255, hsl and hwb's `s l w b` 0 to 100), and
 * the channels written make the new colour, brought back into sRGB as a mix is.
 */
import { into, outOf, type MixSpace, type Vector } from './color-mix.ts';
import { parseColor } from './transition.ts';

/** A channel: a number, a keyword, or arithmetic on two channels. */
export type Channel = number | string | readonly [op: '+' | '-' | '*' | '/', Channel, Channel];

/** What a keyword's number is, per unit of the space's own coordinate. */
const SCALES: Record<MixSpace, Vector> = {
  srgb: [255, 255, 255],
  hsl: [1, 100, 100],
  hwb: [1, 100, 100],
  lab: [1, 1, 1],
  lch: [1, 1, 1],
  oklab: [1, 1, 1],
  oklch: [1, 1, 1],
};

const KEYWORDS: Record<MixSpace, readonly [string, string, string]> = {
  srgb: ['r', 'g', 'b'],
  hsl: ['h', 's', 'l'],
  hwb: ['h', 'w', 'b'],
  lab: ['l', 'a', 'b'],
  lch: ['l', 'c', 'h'],
  oklab: ['l', 'a', 'b'],
  oklch: ['l', 'c', 'h'],
};

/**
 * The colour the channels make from `origin`, as the `rgb()` or `rgba()` native reads. Undefined
 * when the origin is not a colour this can read, such as a platform colour.
 */
export function relativeColour(
  space: MixSpace,
  origin: string,
  channels: readonly [Channel, Channel, Channel],
  alpha?: Channel,
): string | undefined {
  const parsed = parseColor(origin);
  if (!parsed) return undefined;
  const [r, g, b, originAlpha] = parsed;
  const coords = into(space, [r / 255, g / 255, b / 255]);
  const scale = SCALES[space];
  const values: Record<string, number> = { alpha: originAlpha };
  KEYWORDS[space].forEach((keyword, i) => {
    // A missing component is zero in relative syntax: a grey has no hue.
    values[keyword] = Number.isFinite(coords[i]) ? coords[i]! * scale[i]! : 0;
  });
  const made = channels.map((channel, i) => evaluate(channel, values) / scale[i]!) as Vector;
  const opacity = Math.min(
    1,
    Math.max(0, alpha === undefined ? originAlpha : evaluate(alpha, values)),
  );
  const [red, green, blue] = outOf(space, made).map((c) => Math.round(c * 255));
  const rounded = Math.round(opacity * 1000) / 1000;
  return rounded >= 1
    ? `rgb(${red}, ${green}, ${blue})`
    : `rgba(${red}, ${green}, ${blue}, ${rounded})`;
}

function evaluate(channel: Channel, values: Readonly<Record<string, number>>): number {
  if (typeof channel === 'number') return channel;
  if (typeof channel === 'string') return values[channel] ?? 0;
  const [op, a, b] = channel;
  const left = evaluate(a, values);
  const right = evaluate(b, values);
  if (op === '+') return left + right;
  if (op === '-') return left - right;
  if (op === '*') return left * right;
  return left / right;
}
