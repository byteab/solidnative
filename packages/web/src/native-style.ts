/**
 * The React Native style keys CSS has no property of the same name for, written as the CSS they
 * stand for.
 *
 * Everything else in a style reaches the browser dash-cased and in units (`css-units.ts`), and
 * the browser does the rest. These were handed over the same way and dropped without a word,
 * because `padding-horizontal` and `shadow-offset` are not CSS properties and `{ width: 0,
 * height: 6 }` is not a length. Now each is resolved from the whole style it belongs to, which is
 * what two of the three kinds here need:
 *
 * - `paddingHorizontal` and its three siblings stand for two edges each, and in Yoga a single
 *   edge beats them whichever was written first. So `padding-left` is resolved from
 *   `padding-left`, falling back to `padding-horizontal`, and either key changing re-resolves it.
 * - `shadowColor`, `shadowOffset`, `shadowOpacity` and `shadowRadius` are four halves of one
 *   `box-shadow`, and the three `textShadow*` keys of one `text-shadow`. A `boxShadow` named
 *   outright in the same style wins over them.
 *
 * One order is not Yoga's: a `padding` written after `paddingHorizontal` resets both edges, since
 * the browser expands the shorthand over them, where Yoga keeps the more specific key.
 *
 * - `start`, `marginStart`, `paddingEnd` and the rest of Yoga's inline edges are the logical
 *   properties. Where one meets a physical edge the browser goes by which was written last, where
 *   Yoga always lets the logical one win.
 *
 * What is left alone: `elevation`, Android's own shadow, which has no geometry to translate.
 */
import { cssValue } from './css-units.ts';

type Style = Readonly<Record<string, unknown>>;

const EDGES = { horizontal: ['left', 'right'], vertical: ['top', 'bottom'] } as const;

/** Each shorthand-like key, to the CSS properties it feeds. Any other key feeds only itself. */
const FEEDS: Record<string, readonly string[]> = {
  'shadow-color': ['box-shadow'],
  'shadow-offset': ['box-shadow'],
  'shadow-opacity': ['box-shadow'],
  'shadow-radius': ['box-shadow'],
  'text-shadow-color': ['text-shadow'],
  'text-shadow-offset': ['text-shadow'],
  'text-shadow-radius': ['text-shadow'],
};

/** How each fed property is resolved from the whole style. */
const RESOLVE: Record<string, (style: Style) => unknown> = {
  'box-shadow': (style) => style['box-shadow'] ?? boxShadow(style),
  'text-shadow': (style) => style['text-shadow'] ?? textShadow(style),
};

/**
 * Yoga's `start` and `end` edges, which the CSS compiler writes for a logical inline edge, as the
 * logical properties they are. Dash-cased, `margin-start` and a bare `start` are not CSS.
 */
const INLINE_EDGES: Record<string, string> = {
  start: 'inset-inline-start',
  end: 'inset-inline-end',
  'margin-start': 'margin-inline-start',
  'margin-end': 'margin-inline-end',
  'padding-start': 'padding-inline-start',
  'padding-end': 'padding-inline-end',
};

for (const [key, property] of Object.entries(INLINE_EDGES)) {
  FEEDS[key] = [property];
  RESOLVE[property] = (style) => style[key];
}

for (const family of ['padding', 'margin']) {
  for (const [axis, sides] of Object.entries(EDGES)) {
    FEEDS[`${family}-${axis}`] = sides.map((side) => `${family}-${side}`);
    for (const side of sides) {
      const edge = `${family}-${side}`;
      RESOLVE[edge] = (style) => style[edge] ?? style[`${family}-${axis}`];
    }
  }
}

const length = (value: unknown): string =>
  typeof value === 'number' ? `${value}px` : String(value ?? '0px');

interface Offset {
  readonly width?: number;
  readonly height?: number;
}

/**
 * iOS's layer shadow. Its opacity defaults to zero there, so a shadow with no `shadowOpacity` is
 * not drawn on a device and is not drawn here either. The opacity scales the colour's own alpha,
 * which `color-mix` against `transparent` does for a colour in any notation.
 */
function boxShadow(style: Style): string | undefined {
  const opacity = style['shadow-opacity'];
  if (typeof opacity !== 'number' || opacity <= 0) return undefined;
  const offset = (style['shadow-offset'] ?? {}) as Offset;
  const colour = typeof style['shadow-color'] === 'string' ? style['shadow-color'] : 'black';
  const painted =
    opacity >= 1 ? colour : `color-mix(in srgb, ${colour} ${opacity * 100}%, transparent)`;
  return `${length(offset.width)} ${length(offset.height)} ${length(style['shadow-radius'])} ${painted}`;
}

/** A text shadow is drawn once it has a colour, which is what React Native waits for too. */
function textShadow(style: Style): string | undefined {
  const colour = style['text-shadow-color'];
  if (typeof colour !== 'string') return undefined;
  const offset = (style['text-shadow-offset'] ?? {}) as Offset;
  return `${length(offset.width)} ${length(offset.height)} ${length(style['text-shadow-radius'])} ${colour}`;
}

/**
 * Write what one changed key means, given the whole style it is now part of, and return the CSS
 * properties that covers so a caller replacing a whole object knows what it wrote. `key` is
 * dash-cased and `style` keyed the same way.
 */
export function writeStyleKey(
  declaration: CSSStyleDeclaration,
  key: string,
  style: Style,
  priority = '',
): readonly string[] {
  const properties = FEEDS[key] ?? [key];
  for (const property of properties) {
    const value = RESOLVE[property] ? RESOLVE[property](style) : style[property];
    if (value === undefined || value === null) declaration.removeProperty(property);
    else declaration.setProperty(property, cssValue(property, value), priority);
  }
  return properties;
}
