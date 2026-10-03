/**
 * Numbers into CSS values.
 *
 * React Native styles are unitless: `top: 116` means 116 points, and Yoga needs no more than the
 * number. CSS is not, and `top: 116` is not a length at all - the browser rejects the declaration
 * and silently keeps whatever was there before. Every numeric `[style]` binding in this library
 * was being dropped that way: a popover computed the right place and stayed pinned to the corner,
 * an accordion computed its measured height and never opened.
 *
 * It hid because the one property that *is* valid unitless is the one bound beside them. A
 * popover writes `{ top, left, opacity }` together, `opacity: 1` applied, and the card became
 * visible exactly on time in exactly the wrong place - which reads as a positioning bug rather
 * than as a units bug.
 *
 * The list is React DOM's `isUnitlessNumber`, with one deliberate removal. `line-height` is
 * unitless in CSS, where a bare number is a multiple of the font size, and is *points* in React
 * Native, where `lineHeight: 24` means 24. Keeping it here would have made every line height in
 * the library a multiplier, so it gets `px` like any other length. That is the one place these
 * two style languages use the same property name for two different things.
 */
const UNITLESS = new Set([
  'animation-iteration-count',
  'aspect-ratio',
  'border-image-outset',
  'border-image-slice',
  'border-image-width',
  'column-count',
  'columns',
  'flex',
  'flex-grow',
  'flex-shrink',
  'font-weight',
  'grid-area',
  'grid-column',
  'grid-column-end',
  'grid-column-start',
  'grid-row',
  'grid-row-end',
  'grid-row-start',
  'opacity',
  'order',
  'orphans',
  'tab-size',
  'widows',
  'z-index',
  'zoom',
  'fill-opacity',
  'flood-opacity',
  'stop-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
]);

/**
 * `116` becomes `116px`, `1` on an opacity stays `1`, and anything already a string is left alone.
 *
 * Zero is given units too. A bare `0` is legal CSS, but writing `0px` keeps one rule here rather
 * than two, and a custom property holding `0` would not be legal in every place it lands.
 */
export function cssValue(property: string, value: unknown): string {
  // A custom property's value is whatever it was set to: `3` for a column count is not `3px`.
  if (property.startsWith('--')) return String(value);
  if (property === 'transform' && Array.isArray(value)) return transformList(value);
  // `fontVariant: ['small-caps', 'tabular-nums']`, or a `transformOrigin` list. `String()` would
  // join them with commas, which neither property accepts.
  if (Array.isArray(value)) return value.map((item) => cssValue(property, item)).join(' ');
  if (typeof value === 'number' && Number.isFinite(value) && !UNITLESS.has(property)) {
    return `${value}px`;
  }
  return String(value);
}

/** Idempotent on an already-dash-cased name, which is what a compiled template binding gives. */
export const dashCase = (name: string): string =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * React Native's transform list, `[{ translateY: 10 }, { rotate: '45deg' }]`, as the CSS function
 * list it stands for. Translations and perspective are lengths and get units; angles arrive as
 * strings already; a 6-value `matrix` is CSS's `matrix()`, a 16-value one `matrix3d()`.
 */
function transformList(list: readonly unknown[]): string {
  if (list.length === 0) return 'none';
  return list
    .flatMap((entry) => Object.entries(entry as Record<string, unknown>))
    .map(([fn, arg]) => {
      if (fn === 'matrix' && Array.isArray(arg)) {
        return `${arg.length === 16 ? 'matrix3d' : 'matrix'}(${arg.join(', ')})`;
      }
      const length = fn.startsWith('translate') || fn === 'perspective';
      return `${fn}(${length && typeof arg === 'number' ? `${arg}px` : String(arg)})`;
    })
    .join(' ');
}
