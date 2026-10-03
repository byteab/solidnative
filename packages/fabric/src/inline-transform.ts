/**
 * A CSS transform string, as the list React Native's Fabric reads.
 *
 * A class's transform is compiled to this list at build time. A bound style -
 * `[style.transform]="'rotate(' + angle + 'deg)'"` - has no build step, and Fabric drops a string
 * without a word. React Native's JavaScript would have run `processTransform` over it first; there
 * is none of that JavaScript between this engine and Fabric, so this does the same job.
 *
 * Lengths in pixels become numbers, angles and percentages stay strings, as React Native keeps
 * them. A two-argument `translate`, `scale` or `skew` is split into its axes, and a 2D `matrix()`
 * is widened to the sixteen values native wants.
 */
export type TransformEntry = Readonly<Record<string, number | string | readonly number[]>>;

const AXES: Readonly<Record<string, readonly [string, string]>> = {
  translate: ['translateX', 'translateY'],
  scale: ['scaleX', 'scaleY'],
  skew: ['skewX', 'skewY'],
};

const PX = /^-?\d*\.?\d+(px)?$/;

function argument(raw: string): number | string {
  return PX.test(raw) ? parseFloat(raw) : raw;
}

export function transformList(value: string): TransformEntry[] {
  const out: TransformEntry[] = [];
  if (value.trim() === 'none') return out;
  for (const [, name, body] of value.matchAll(/([a-zA-Z0-9]+)\(([^)]*)\)/g)) {
    const args = body!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(argument);
    const axes = AXES[name!];
    if (axes && args.length === 2) {
      out.push({ [axes[0]]: args[0]! }, { [axes[1]]: args[1]! });
    } else if (axes && name !== 'scale') {
      // `translate(4px)` and `skew(10deg)` move along the first axis only; `scale(2)` is both,
      // which React Native spells as a key of its own and falls through to below.
      out.push({ [axes[0]]: args[0]! });
    } else if (name === 'matrix' && args.length === 6) {
      const [a, b, c, d, e, f] = args as number[];
      out.push({ matrix: [a!, b!, 0, 0, c!, d!, 0, 0, 0, 0, 1, 0, e!, f!, 0, 1] });
    } else if (name === 'matrix3d') {
      out.push({ matrix: args as number[] });
    } else {
      out.push({ [name!]: args[0]! });
    }
  }
  return out;
}
