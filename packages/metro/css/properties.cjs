/**
 * CSS property -> React Native style property.
 *
 * RN's style language is a subset of CSS with different names in places and no cascade, so this
 * is an allowlist, not a passthrough. An unknown property is dropped with a build warning that
 * names it: on native an unrecognised style key is simply dropped, which is invisible.
 */
const {
  CssUnsupported,
  angle,
  camel,
  color,
  keyword,
  length,
  nearestWeight,
  number,
  round,
} = require('./values.cjs');
const { backgroundImage } = require('./gradients.cjs');
const { filter, backgroundSize, backgroundRepeat, backgroundPosition } = require('./filters.cjs');
const { LOGICAL } = require('./shorthands.cjs');

const LENGTH = new Set([
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'top',
  'right',
  'bottom',
  'left',
  'inset-inline-start',
  'inset-inline-end',
  'inset-block-start',
  'inset-block-end',
  'margin-inline-start',
  'margin-inline-end',
  'margin-block-start',
  'margin-block-end',
  'padding-inline-start',
  'padding-inline-end',
  'padding-block-start',
  'padding-block-end',
  'outline-width',
  'outline-offset',
  'font-size',
  'letter-spacing',
  'line-height',
  'border-radius',
  'row-gap',
  'column-gap',
  'flex-basis',
  'border-inline-start-width',
  'border-inline-end-width',
  'border-block-start-width',
  'border-block-end-width',
]);

const COLOR = new Set([
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'text-decoration-color',
  'shadow-color',
  'tint-color',
  'outline-color',
  'border-block-start-color',
  'border-block-end-color',
  'border-inline-start-color',
  'border-inline-end-color',
]);

/**
 * CSS properties whose React Native name is not their camel-cased CSS one.
 *
 * Fabric reads the inline edges as `Start` and `End`: `borderInlineStartColor`, the camel case,
 * is a name it has no reader for, so the colour was sent and never drawn.
 */
const RN_NAME = {
  'border-inline-start-color': 'borderStartColor',
  'border-inline-end-color': 'borderEndColor',
  'border-inline-start-width': 'borderStartWidth',
  'border-inline-end-width': 'borderEndWidth',
  // The block axis is top and bottom in the only writing mode native lays out.
  'border-block-start-width': 'borderTopWidth',
  'border-block-end-width': 'borderBottomWidth',
  // RN's own spellings of these are aliases some views never read: see `LOGICAL` in
  // shorthands.cjs. The inline edges are Yoga's Start and End; the block axis is top and bottom.
  'inset-inline-start': 'start',
  'inset-inline-end': 'end',
  'inset-block-start': 'top',
  'inset-block-end': 'bottom',
  'margin-inline-start': 'marginStart',
  'margin-inline-end': 'marginEnd',
  'margin-block-start': 'marginTop',
  'margin-block-end': 'marginBottom',
  'padding-inline-start': 'paddingStart',
  'padding-inline-end': 'paddingEnd',
  'padding-block-start': 'paddingTop',
  'padding-block-end': 'paddingBottom',
};

const rnName = (property) => RN_NAME[property] ?? camel(property);

/**
 * Other spellings of a property already mapped. The logical sizes are width and height in the one
 * writing mode native has, horizontal; the `grid-` gaps are the names `gap` had before flexbox
 * borrowed it.
 */
const ALIASES = {
  'inline-size': 'width',
  'block-size': 'height',
  'min-inline-size': 'min-width',
  'max-inline-size': 'max-width',
  'min-block-size': 'min-height',
  'max-block-size': 'max-height',
  'grid-row-gap': 'row-gap',
  'grid-column-gap': 'column-gap',
  'grid-gap': 'gap',
};

/** What native calls an `object-fit`: RN's own table, from its Image component's JavaScript. */
const OBJECT_FIT = {
  contain: 'contain',
  cover: 'cover',
  fill: 'stretch',
  'scale-down': 'contain',
  none: 'none',
};

/** What native calls a `vertical-align`: RN's own table, from its Text component's JavaScript. */
const VERTICAL_ALIGN = { auto: 'auto', top: 'top', bottom: 'bottom', middle: 'center' };

/** A keyword looked up in one of RN's own renaming tables, refused if it is not in it. */
function renamed(table, value, property) {
  if (value?.type === 'length') {
    throw new CssUnsupported(`${property}: native takes a keyword here, not a length`);
  }
  const word = keyword(value, property);
  if (!(word in table)) {
    throw new CssUnsupported(
      `${property}: '${word}' has no native equivalent (${Object.keys(table).join(', ')} do)`,
    );
  }
  return table[word];
}

/**
 * Keywords a property will actually honour, where accepting any identifier would be a lie.
 *
 * Fabric parses each of these against a fixed list of strings and drops anything else without a
 * word, so an identifier passed straight through is a style that silently does nothing. `position`
 * has a hint of its own, because the three values it cannot honour are all values a web developer
 * reaches for on purpose: `fixed` compiled cleanly, committed the string to the shadow node, and
 * left the header scrolling away.
 */
const KEYWORD_VALUES = {
  position: {
    allowed: new Set(['relative', 'absolute', 'static']),
    // Named rather than generic, because "unsupported" leaves the reader to work out the fix.
    hint:
      'Yoga has no viewport to fix to and no scroll container to stick within. ' +
      'Use `position: absolute` inside the element you meant to pin to; for a header that ' +
      'should stay put, put it outside the scroll view rather than inside it.',
  },
  'text-align': {
    allowed: new Set(['auto', 'start', 'end', 'left', 'center', 'right', 'justify']),
    hint: 'Native has start, end, left, center, right and justify.',
  },
  'text-decoration-style': {
    allowed: new Set(['solid', 'double', 'dotted', 'dashed']),
    hint: 'Native draws solid, double, dotted and dashed decorations.',
  },
  // React Native's own list. Fabric drops anything else without a word, so each of these would
  // compile cleanly and do nothing on device.
  'mix-blend-mode': {
    allowed: new Set([
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'color-dodge',
      'color-burn',
      'hard-light',
      'soft-light',
      'difference',
      'exclusion',
      'hue',
      'saturation',
      'color',
      'luminosity',
      'plus-lighter',
    ]),
    hint: 'Native draws the separable and non-separable blend modes and plus-lighter.',
  },
  cursor: {
    allowed: new Set(['auto', 'pointer']),
    hint: 'Native has two cursors, auto and pointer, for an iPad with a pointer attached.',
  },
  overflow: {
    allowed: new Set(['visible', 'hidden', 'scroll']),
    hint: 'Native has visible, hidden and scroll.',
  },
};

/**
 * CSS keywords that are another one on native. `default` is the arrow a pointer draws when it is
 * not over a link, which native calls auto. `auto` overflow is a scroll container on the web, and
 * scroll is how Yoga lays one out; `clip` hides what overflows as `hidden` does.
 */
const SAME_AS = {
  cursor: { default: 'auto' },
  overflow: { auto: 'scroll', clip: 'hidden' },
};

/** The border and outline styles native draws. `none` and `hidden` are no line, not a style. */
const DRAWN_LINES = new Set(['solid', 'dotted', 'dashed']);

/** A border or outline style native can draw, or a refusal naming the ones it can. */
function drawnLine(style, context) {
  if (!DRAWN_LINES.has(style)) {
    throw new CssUnsupported(
      `${context}: native cannot draw a '${style}' line; it draws solid, dotted and dashed.`,
    );
  }
  return style;
}

/** A keyword checked against what its property honours, where that is known. */
function honoured(property, written) {
  const found = SAME_AS[property]?.[written] ?? written;
  const allowed = KEYWORD_VALUES[property];
  if (allowed && !allowed.allowed.has(found)) {
    throw new CssUnsupported(`${property}: ${found} is not supported. ${allowed.hint}`);
  }
  return found;
}

/**
 * The alignment props, which Fabric parses against Yoga's fixed list of strings, dropping anything
 * else without a word. `reads` is that list; `means` is the CSS box-alignment spellings of one of
 * them in a flex container, where `start` is `flex-start` and `normal` is how the property
 * behaves when it is left alone. lightningcss hands `baseline` over as the `first` baseline.
 */
const YOGA_ALIGN = ['auto', 'flex-start', 'center', 'flex-end', 'stretch', 'baseline'];
const POSITIONS = {
  start: 'flex-start',
  end: 'flex-end',
  'self-start': 'flex-start',
  'self-end': 'flex-end',
  first: 'baseline',
};
const CONTENT = ['space-between', 'space-around', 'space-evenly'];
const ALIGNMENT = {
  'align-items': {
    reads: new Set(YOGA_ALIGN.filter((v) => v !== 'auto')),
    means: { ...POSITIONS, normal: 'stretch' },
  },
  'align-self': { reads: new Set(YOGA_ALIGN), means: { ...POSITIONS, normal: 'stretch' } },
  // No baseline for the lines of a wrapping box, in either engine: CSS falls back to start, and
  // React Native does not take the word, so a baseline is the start it comes to.
  'align-content': {
    reads: new Set([...YOGA_ALIGN.filter((v) => v !== 'auto' && v !== 'baseline'), ...CONTENT]),
    means: { ...POSITIONS, normal: 'stretch', first: 'flex-start', baseline: 'flex-start' },
  },
  'justify-content': {
    reads: new Set(['flex-start', 'center', 'flex-end', ...CONTENT]),
    means: { start: 'flex-start', end: 'flex-end', normal: 'flex-start' },
  },
};

/**
 * A font style. Fabric reads `oblique` as a word, with no angle, and lightningcss hands one over
 * with its angle (14deg when none is written), so the keyword is the type and not what is in it.
 */
const fontStyle = (value) => (typeof value === 'string' ? value : value.type);

/**
 * The line-height a `font` shorthand sets, beside the size it sets. A multiple or a percentage of
 * a size written in points is settled here; of one in em it is deferred, as the longhand is,
 * rather than multiplied by the marker the em size is and committed as NaN. `normal` clears it,
 * because the shorthand resets every part the author left out.
 */
function fontLineHeight(lineHeight, out, context) {
  const factor =
    lineHeight.type === 'number'
      ? number(lineHeight, context)
      : lineHeight.value?.type === 'percentage'
        ? lineHeight.value.value
        : undefined;
  if (factor !== undefined && typeof out.fontSize === 'number') {
    out.lineHeight = round(factor * out.fontSize);
  } else {
    translate('line-height', lineHeight, out);
  }
}

/** An alignment keyword as the Yoga string it means, or a refusal naming the ones there are. */
function alignment(property, value) {
  const { reads, means } = ALIGNMENT[property];
  const found = keyword(value, property);
  if (value?.type === 'baseline-position' && found === 'last') {
    throw new CssUnsupported(
      `${property}: last baseline has no Yoga equivalent; write baseline, which is the first.`,
    );
  }
  const yoga = means[found] ?? found;
  if (!reads.has(yoga)) {
    throw new CssUnsupported(
      `${property}: '${found}' is not an alignment Yoga has. Use one of: ${[...reads].join(', ')}.`,
    );
  }
  return yoga;
}

const KEYWORD = new Set([
  'position',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-self',
  'align-content',
  'text-align',
  'font-style',
  'direction',
  'resize-mode',
  'pointer-events',
  // RN 0.76 onwards. All of these were previously rejected as having no native equivalent.
  'mix-blend-mode',
  'isolation',
  'box-sizing',
  'outline-style',
  'text-decoration-style',
  'backface-visibility',
  'border-curve',
  'text-align-vertical',
]);

const NUMBER = new Set([
  'opacity',
  'flex-grow',
  'flex-shrink',
  'z-index',
  'aspect-ratio',
  'elevation',
]);

/** The logical pairs, and which of lightningcss's two sides is which. See `LOGICAL`. */
const LOGICAL_SIDES = {
  'margin-inline': ['inlineStart', 'inlineEnd'],
  'margin-block': ['blockStart', 'blockEnd'],
  'padding-inline': ['inlineStart', 'inlineEnd'],
  'padding-block': ['blockStart', 'blockEnd'],
  'inset-inline': ['inlineStart', 'inlineEnd'],
  'inset-block': ['blockStart', 'blockEnd'],
};

/** RN's own list. Anything else is a typographic feature native has no way to ask for. */
const FONT_VARIANTS = new Set([
  'small-caps',
  'oldstyle-nums',
  'lining-nums',
  'tabular-nums',
  'proportional-nums',
  'common-ligatures',
  'no-common-ligatures',
  'discretionary-ligatures',
  'no-discretionary-ligatures',
  'historical-ligatures',
  'no-historical-ligatures',
  'contextual',
  'no-contextual',
  'stylistic-one',
  'stylistic-two',
  'stylistic-three',
  'stylistic-four',
  'stylistic-five',
  'stylistic-six',
  'stylistic-seven',
  'stylistic-eight',
  'stylistic-nine',
]);

function fontVariant(value, context) {
  const word = keyword(value, context);
  if (!FONT_VARIANTS.has(word)) {
    throw new CssUnsupported(
      `${context}: '${word}' is not a font variant native can ask a font for.`,
    );
  }
  return word;
}

/**
 * One axis of `transform-origin`, which CSS writes as a length, a percentage or a side.
 *
 * The keywords are the common spelling - `top left`, `center` - and each is the percentage it is
 * defined as, which is what RN takes and what makes the origin follow the box as it resizes.
 */
const ORIGIN_SIDES = { left: '0%', top: '0%', right: '100%', bottom: '100%' };
function origin(value, axis, context) {
  if (value?.type === 'center') return '50%';
  if (value?.type === 'side') {
    const base = ORIGIN_SIDES[value.side];
    if (base === undefined) throw new CssUnsupported(`${context}: '${value.side}' is not a side`);
    if (value.offset) {
      throw new CssUnsupported(
        `${context}: an offset from a side needs arithmetic at layout time, which native has ` +
          `nowhere to do. Write the percentage or the length on its own.`,
      );
    }
    return base;
  }
  return length(value, context);
}

/**
 * One corner, physical or logical. Both spellings take the same `[horizontal, vertical]` pair and
 * land in a prop RN names exactly as CSS does.
 */
const CORNER_RADIUS = /^border-((top|bottom)-(left|right)|(start|end)-(start|end))-radius$/;

/**
 * Web-only properties, kept apart from the merely unmapped ones so the two can be told apart in
 * the error message. Saying "no React Native equivalent" of a property RN supports is how the
 * allowlist drifted to half of RN's style API without anyone noticing.
 */
const NO_NATIVE_EQUIVALENT = new Set([
  'float',
  'clear',
  'content',
  'visibility',
  'box-decoration-break',
  'clip',
  'clip-path',
  'list-style',
  'list-style-type',
  'list-style-position',
  'list-style-image',
  'table-layout',
  'border-collapse',
  'border-spacing',
  'caption-side',
  'empty-cells',
  'grid',
  'grid-template',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'grid-auto-flow',
  'grid-auto-columns',
  'grid-auto-rows',
  'grid-area',
  'grid-column',
  'grid-row',
  'justify-items',
  'justify-self',
  'place-items',
  'place-self',
  'columns',
  'column-count',
  'column-width',
  'column-rule',
  'break-inside',
  'break-before',
  'will-change',
  'contain',
  'counter-reset',
  'counter-increment',
  'quotes',
  // Found in the corpus, each reported as "not mapped yet" though RN's style API has nothing for
  // it. Yoga has no `order`, and the rest are the browser's own furniture. `white-space` and
  // `text-overflow` are not here: they become the Text component's `numberOfLines` and
  // `ellipsizeMode` props, which is how native truncates (see `truncation` below).
  'order',
  'appearance',
  'text-wrap',
  'word-wrap',
  'overflow-wrap',
  'word-break',
  'line-break',
  'tab-size',
  'text-size-adjust',
  'text-underline-offset',
  'text-decoration-skip-ink',
  'print-color-adjust',
  'scroll-behavior',
  'resize',
  'accent-color',
]);

/** For each property with one, the keyword that means "none of this", as lightningcss types it. */
const RESETS = {
  'max-width': 'none',
  'max-height': 'none',
  'z-index': 'auto',
  'letter-spacing': 'normal',
};

/**
 * The display value as it was written. lightningcss reads `block` as the pair `block flow`, and
 * reporting "display: flow" named a value nobody wrote.
 */
function displayName(value, word) {
  if (value?.type !== 'pair') return word;
  const { outside, inside } = value;
  if (value.isListItem) return 'list-item';
  if (inside?.type === 'flow') return outside;
  if (inside?.type === 'flow-root') return outside === 'inline' ? 'inline-block' : 'flow-root';
  return outside === 'inline' ? `inline-${inside?.type}` : inside?.type;
}

/**
 * The display values Yoga has: `block` is read as flex above, and the rest have no layout meaning
 * there. `contents` is Yoga's own, and removes the box while keeping its children in the layout.
 */
const DISPLAY = new Set(['flex', 'none', 'contents']);

const SIDES = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' };
const CORNERS = {
  topLeft: 'BorderTopLeftRadius',
  topRight: 'BorderTopRightRadius',
  bottomLeft: 'BorderBottomLeftRadius',
  bottomRight: 'BorderBottomRightRadius',
};

/** Expand a four-sided shorthand lightningcss has already split for us. */
function sides(prefix, value, out, context) {
  for (const [side, suffix] of Object.entries(SIDES)) {
    const part = value[side];
    if (part !== undefined) out[`${prefix}${suffix}`] = length(part, `${context}-${side}`);
  }
}

/**
 * A four-sided value native holds as one. Refused when the sides disagree, because dropping three
 * of them is invisible: the same rule `overflow` follows.
 */
function uniform(value, context, name) {
  const words = Object.values(SIDES).map((side) => keyword(value[side.toLowerCase()], context));
  if (new Set(words).size !== 1) {
    throw new CssUnsupported(
      `${context}: native has one ${name} for every side, and these disagree (${words.join(' ')})`,
    );
  }
  return words[0];
}

/**
 * A corner radius. lightningcss always hands back `[horizontal, vertical]`; native has one number
 * per corner, so an elliptical corner is refused rather than silently made circular.
 */
function radius(value, context) {
  if (!Array.isArray(value)) return length(value, context);
  const [horizontal, vertical] = value.map((part) => length(part, context));
  // A radius in em is a marker for the device, not a number, so the two halves are compared by
  // what they say: two markers for the same em are two objects, and were refused as elliptical.
  const shown = (radius) => (typeof radius === 'object' ? JSON.stringify(radius) : radius);
  if (vertical !== undefined && shown(vertical) !== shown(horizontal)) {
    throw new CssUnsupported(
      `${context}: elliptical corners are not supported on native ` +
        `(${shown(horizontal)} / ${shown(vertical)})`,
    );
  }
  return horizontal;
}

/**
 * A CSS transform function list, as the array of single-key objects Fabric's
 * `parseProcessedTransform` walks. Names must match its `operation ==` chain exactly: anything
 * else makes it discard the whole transform, silently.
 */
// eslint-disable-next-line complexity -- a dispatch table: one flat case per CSS form
function transformList(value, context) {
  const out = [];
  for (const op of value) {
    switch (op.type) {
      case 'translateX':
        out.push({ translateX: length(op.value, context) });
        break;
      case 'translateY':
        out.push({ translateY: length(op.value, context) });
        break;
      case 'translate':
        out.push({ translateX: length(op.value[0], context) });
        out.push({ translateY: length(op.value[1], context) });
        break;
      case 'scale':
        out.push({ scaleX: number(op.value[0], context) });
        out.push({ scaleY: number(op.value[1], context) });
        break;
      case 'scaleX':
        out.push({ scaleX: number(op.value, context) });
        break;
      case 'scaleY':
        out.push({ scaleY: number(op.value, context) });
        break;
      case 'rotate':
        out.push({ rotate: angle(op.value, context) });
        break;
      case 'rotateX':
        out.push({ rotateX: angle(op.value, context) });
        break;
      case 'rotateY':
        out.push({ rotateY: angle(op.value, context) });
        break;
      case 'rotateZ':
        out.push({ rotateZ: angle(op.value, context) });
        break;
      case 'skewX':
        out.push({ skewX: angle(op.value, context) });
        break;
      case 'skewY':
        out.push({ skewY: angle(op.value, context) });
        break;
      case 'perspective':
        out.push({ perspective: length(op.value, context) });
        break;
      default:
        throw new CssUnsupported(`${context}: the '${op.type}()' transform is not mapped yet`);
    }
  }
  return out;
}

/**
 * A border or outline shorthand, into `<prefix>Width`, `<prefix>Style` and `<prefix>Color`.
 *
 * lightningcss fills in whatever the author left out with its initial value, so `border: none`
 * arrives as a `medium` width and a `currentColor` colour. Those parts only matter where the line
 * is drawn: CSS computes the width of a line styled `none` as 0, and a colour nobody can see is
 * not refused for being one native cannot spell.
 *
 * @returns the style, for a caller with its own rule about which styles it can express
 */
function line(value, prefix, out, context, { style: withStyle = true } = {}) {
  const style = value.style === undefined ? undefined : keyword(value.style, context);
  const set = (part, to) => {
    for (const side of lineSides(prefix)) out[`${side}${part}`] = to;
  };
  if (NO_LINE.has(style)) {
    set('Width', 0);
    // Cascades as the style does, so the engine can zero a width a later rule sets: see
    // `NO_BORDER` in css.ts.
    if (prefix === 'border') out.borderStyle = 'none';
    return style;
  }
  const width = length(value.width, context);
  if (width !== undefined) set('Width', width);
  if (withStyle && style !== undefined) out[`${prefix}Style`] = drawnLine(style, context);
  if (drawnColor(value.color, width)) set('Color', color(value.color, context));
  return style;
}

/** The styles that draw no line at all. */
const NO_LINE = new Set(['none', 'hidden']);

/** Whether a line's colour is one to write: given, and not a currentColor nobody can see. */
const drawnColor = (colour, width) =>
  colour !== undefined && !(width === 0 && colour?.type === 'currentcolor');

/**
 * The props a line shorthand's width and colour land in. `border` is every side, spelled out: an
 * unsided `borderWidth` loses to a `borderTopWidth` from any weaker rule, because native reads the
 * per-side prop first whatever order the two arrived in, so `* { border-width: 0 }` beat every
 * `.card { border: 1px solid }` after it. The style stays one prop, since native has only one.
 */
function lineSides(prefix) {
  return prefix === 'border' ? Object.values(SIDES).map((side) => `border${side}`) : [prefix];
}

/**
 * `rotate`, about the axis it names. lightningcss gives every form as a vector and an angle, and
 * native has a rotation about each of the three axes but none about an arbitrary vector, so
 * anything else is refused rather than turned about the wrong one.
 */
function rotation({ x, y, z, angle: amount }, context) {
  const axis = x === 1 && !y && !z ? 'rotateX' : y === 1 && !x && !z ? 'rotateY' : null;
  if (axis) return { [axis]: angle(amount, context) };
  if (!x && !y && z === 1) return { rotate: angle(amount, context) };
  throw new CssUnsupported(
    `${context}: native rotates about x, y or z only, not about the axis (${x}, ${y}, ${z})`,
  );
}

/**
 * The keys `translate`, `rotate` and `scale` compile to. Not the CSS names, and not anything a
 * native prop could be called, because the engine takes them out of the props and folds them
 * into `transform` before a commit. `@solidnative/fabric`'s engine reads the same three names.
 */
const INDIVIDUAL_TRANSFORMS = {
  translate: '__translate',
  rotate: '__rotate',
  scale: '__scale',
};

/**
 * A shadow list, as the maps Fabric's `parseProcessedBoxShadow` reads.
 *
 * Not a CSS string: `enableNativeCSSParsing` defaults to false, and on that path a string is
 * rejected outright. The nested colour stays an `rgba()` string here and is processed at commit
 * time, because only the device knows what a colour is.
 */
function shadowList(value, context) {
  return value
    .map((shadow) => ({
      offsetX: length(shadow.xOffset, context),
      offsetY: length(shadow.yOffset, context),
      blurRadius: length(shadow.blur, context),
      spreadDistance: length(shadow.spread, context),
      color: color(shadow.color, context),
      inset: shadow.inset ?? false,
    }))
    .filter((shadow) => !fullyTransparent(shadow.color));
}

/**
 * A shadow nobody can see, and there are usually four of them.
 *
 * `box-shadow` in Tailwind composes five slots - inset, inset ring, ring offset, ring, and the
 * shadow itself - and a utility that wanted only a drop shadow leaves the other four as
 * `0 0 #0000`. Keeping them means four extra shadow maps per node, each painting nothing.
 *
 * A hand-written transparent shadow is dropped too. It paints nothing either, and this project
 * does not transition shadows, so there is nothing it could be a starting value for.
 */
function fullyTransparent(value) {
  return typeof value === 'string' && /^rgba\(.*,\s*0\)$/.test(value);
}

/**
 * CSS timing keywords as the curve each one names. The engine evaluates a cubic bezier and knows
 * no keywords, which keeps one table here rather than a second vocabulary at runtime.
 */
const EASINGS = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

/** lightningcss keeps the unit; the engine only ever wants milliseconds. */
const milliseconds = (time) =>
  time === undefined ? 0 : time.type === 'seconds' ? Math.round(time.value * 1000) : time.value;

function easing(timingFunction, context) {
  if (timingFunction === undefined) return EASINGS.ease;
  const named = EASINGS[timingFunction.type];
  if (named) return named;
  if (timingFunction.type === 'cubic-bezier') {
    const { x1, y1, x2, y2 } = timingFunction;
    // Rounded like every other number here. lightningcss stores these as f32, so Tailwind's
    // `cubic-bezier(.4, 0, .2, 1)` arrives as 0.4000000059604645 and would ship that way in
    // every bundle, on every transition.
    return [round(x1), round(y1), round(x2), round(y2)];
  }
  throw new CssUnsupported(
    `${context}: '${timingFunction.type}' easing is not a curve, and approximating it with one ` +
      `would animate the wrong thing. Use a keyword or cubic-bezier().`,
  );
}

/**
 * `transition: opacity 200ms ease-in 50ms` becomes a spec the engine reads, keyed by the React
 * Native prop the property compiles to, because that is the name it will see change.
 *
 * `all` is kept as itself: the engine reads it as "whatever changed".
 *
 * The shorthand is held as the four lists its longhands would give, replacing any longhand
 * already read, so that declarations apply in order: a longhand after it changes one part, and a
 * shorthand after a longhand resets it. `finishTransition` builds the spec once the rule is read.
 */
function transition(list, out) {
  out[LONGHANDS] = {
    // `transition: none` is a list with no entries in lightningcss, which is no properties.
    property: list.map((entry) => entry.property ?? { property: 'all' }),
    duration: list.map((entry) => entry.duration),
    delay: list.map((entry) => entry.delay),
    'timing-function': list.map((entry) => entry.timingFunction),
  };
}

/**
 * Where the transition parts are collected until the rule is finished.
 *
 * A symbol so it cannot collide with a React Native prop name and never survives into a sheet:
 * `finishTransition` deletes it, and anything left would be visible in every bundle.
 */
const LONGHANDS = Symbol('transition-longhands');

/**
 * `transition-property`, `-duration`, `-timing-function` and `-delay`, held until the whole rule
 * has been read.
 *
 * These used to be refused, on the grounds that the shorthand says the same thing and spares this
 * the list-repeating rules. That was true right up until Tailwind, which never emits the
 * shorthand: `transition-colors` and every other `transition-*` utility is these three, so
 * refusing them refused the family. `finishTransition` implements the repeating rule, which is
 * the whole of what was being avoided and turns out to be one line.
 */
function transitionLonghand(property, value, out) {
  const parts = (out[LONGHANDS] ??= {});
  parts[property.slice('transition-'.length)] = value;
}

/** The nth entry of a list that repeats, which is how CSS matches the longhands up. */
const cycle = (list, index) => (list?.length ? list[index % list.length] : undefined);

/**
 * Combine the rule's transition parts, from the shorthand and the longhands in the order they
 * were written, into the spec the engine reads.
 *
 * Called once per rule rather than per declaration, because a list is only meaningful against
 * `transition-property`'s length and that may be declared after the durations it sizes.
 *
 * A rule with timing and no properties is kept for the rule that names them: see `finishTiming`.
 * A property list that names nothing, as `transition: none` does, is still kept, so it can stop a
 * weaker rule's transition.
 */
function finishTransition(out, context) {
  const parts = out[LONGHANDS];
  if (!parts) return;
  delete out[LONGHANDS];
  if (!parts['property']) return finishTiming(parts, out, context);

  const spec = {};
  for (const [index, entry] of parts['property'].entries()) {
    const name = entry?.property ?? 'all';
    // A custom property is not something this engine can animate, and Tailwind puts four of them
    // in `transition-colors` for its gradient slots. Listing them is dead weight in every bundle.
    if (name === 'none' || name.startsWith('--')) continue;
    const timing = {
      duration: milliseconds(cycle(parts['duration'], index)),
      delay: milliseconds(cycle(parts['delay'], index)),
      easing: easing(cycle(parts['timing-function'], index), context),
    };
    for (const key of name === 'all' ? ['all'] : propNames(name, context)) spec[key] = timing;
  }
  // Not `transition`: that is also a prop some native views take, `expo-image`'s among them.
  out['$transition'] = spec;
  cascadingTiming(parts, out, context);
}

/**
 * Each timing part a rule with a property list wrote, cascading on its own as a longhand does: a
 * stronger rule that names only the properties keeps this rule's duration, and a weaker one's is
 * replaced. A list of more than one pairs with this rule's properties alone, so it is baked into
 * the spec and replaces a weaker part without standing in for itself.
 */
function cascadingTiming(parts, out, context) {
  for (const [part, key] of Object.entries(TIMING_KEYS)) {
    const list = parts[part];
    if (!list) continue;
    if (list.length > 1) out[key] = null;
    else out[key] = part === 'timing-function' ? easing(list[0], context) : milliseconds(list[0]);
  }
}

/** The timing parts, and the key each cascades under when a rule sets it with no property list. */
const TIMING_KEYS = {
  duration: '$transitionDuration',
  'timing-function': '$transitionEasing',
  delay: '$transitionDelay',
};

/**
 * Timing with no property list: `.duration-700` beside `.transition`, which names the properties.
 *
 * On the web each longhand cascades on its own, so this is kept for the engine to lay over the
 * spec a matching rule builds, rather than dropped for having nothing to apply to.
 */
function finishTiming(parts, out, context) {
  for (const [part, key] of Object.entries(TIMING_KEYS)) {
    const list = parts[part];
    if (!list) continue;
    // Which entry goes with which property depends on the property list in some other rule.
    if (list.length > 1) {
      throw new CssUnsupported(
        `${context}: a transition-${part} list needs the transition-property it pairs with in ` +
          `the same rule. Write a single value, or the property list beside it.`,
      );
    }
    out[key] = part === 'timing-function' ? easing(list[0], context) : milliseconds(list[0]);
  }
}

/**
 * What React Native calls the property being transitioned. Compiling a probe declaration is the
 * honest way to ask: it goes through the same table as the real one, so a property that has a
 * different name in React Native, or none at all, answers for itself.
 *
 * A shorthand is every prop it compiles to, since those are the names the engine sees change:
 * `padding` is four sides, and `background` is `backgroundColor`.
 */
function propNames(property, context) {
  // A probe value of 0 is not a rotation, and would be named after the CSS spelling.
  if (Object.hasOwn(INDIVIDUAL_TRANSFORMS, property)) return [INDIVIDUAL_TRANSFORMS[property]];
  const probe = {};
  try {
    translate(property, 0, probe, context);
  } catch {
    // Not a length. A colour, say, or a property this table cannot express, which is not a
    // property that can change: then naming it after the CSS spelling is enough for the engine
    // to never match it.
  }
  const names = Object.keys(probe);
  if (names.length === 1) return names;
  const longhands = shorthandProps(property);
  return longhands.length ? longhands : [camel(property)];
}

/**
 * Values a shorthand can be compiled with to learn the props it fills. More than one, because
 * which it fills can hang on the value: `padding-inline: 1px` is left and right, and
 * `padding-inline: 1px 2px` is start and end.
 */
const SHORTHAND_PROBES = ['1px', '1px 2px', '1px solid red', 'red', '1'];

/** Every prop a shorthand compiles to, through the whole compiler; cached by property. */
const shorthandCache = new Map();
function shorthandProps(property) {
  if (shorthandCache.has(property)) return shorthandCache.get(property);
  // Required here rather than at the top: compile.cjs requires this module.
  const { compileCss } = require('./compile.cjs');
  const names = new Set();
  for (const value of SHORTHAND_PROBES) {
    try {
      for (const rule of compileCss(`a{${property}:${value}}`, 'probe').rules) {
        for (const name of Object.keys(rule.declarations)) names.add(name);
        for (const deferred of rule.deferred ?? [])
          for (const name of deferred.props) names.add(name);
      }
    } catch {
      // Not a value this property takes.
    }
  }
  const found = [...names];
  shorthandCache.set(property, found);
  return found;
}

/** Where a rule's animation parts wait for the rule to finish, as `LONGHANDS` does for transitions. */
const ANIMATION_PARTS = Symbol('animation-parts');

/**
 * `animation: fade-in 300ms ease-out 100ms 2 forwards`.
 *
 * Unlike a transition, this plays from the frames themselves rather than from whatever was on
 * screen, which is what lets an element animate in without anything about it having changed.
 *
 * Held as the lists its longhands would give, replacing any longhand already read, and built into
 * a spec by `finishAnimation`: a longhand after it changes one part, as in CSS.
 */
function animation(list, out, context) {
  const parts = {
    name: list.map((entry) => entry.name),
    duration: list.map((entry) => entry.duration),
    'timing-function': list.map((entry) => entry.timingFunction),
    delay: list.map((entry) => entry.delay),
    'iteration-count': list.map((entry) => entry.iterationCount),
    direction: list.map((entry) => entry.direction),
    'fill-mode': list.map((entry) => entry.fillMode),
    'play-state': list.map((entry) => entry.playState),
  };
  checkAnimation('name', parts['name'], context);
  if (list[0]?.timeline) parts.timeline = timelineOf(list[0].timeline, context);
  out[ANIMATION_PARTS] = parts;
}

/**
 * `animation-name`, `-duration`, `-timing-function`, `-delay`, `-iteration-count`, `-direction`,
 * `-fill-mode` and `-play-state`, one part of the shorthand each, with the shorthand's limits.
 */
function animationLonghand(property, value, out, context) {
  const part = property.slice('animation-'.length);
  checkAnimation(part, value, context);
  (out[ANIMATION_PARTS] ??= {})[part] = value;
}

/**
 * `animation-timeline`: the clock, or a scroll view's offset. `scroll()` plays the animation by
 * the nearest scroll view's offset along an axis, on the native side (see the engine's
 * `NativeScrollDriver`); `auto` is the clock; `none` plays nothing.
 */
function scrollTimeline(list, out, context) {
  if (list.length !== 1) checkAnimation('name', list, context);
  (out[ANIMATION_PARTS] ??= {}).timeline = timelineOf(list[0], context);
}

/**
 * One timeline, as the spec's `timeline`: `x` or `y` for a scroll view's offset, or `auto` or
 * `none`. Read from `animation-timeline` and from the shorthand, which lightningcss folds the
 * longhand into when it prints a sheet back out.
 */
function timelineOf(timeline, context) {
  switch (timeline?.type) {
    case 'auto':
    case 'none':
      return timeline.type;
    case 'scroll': {
      const { scroller, axis } = timeline.value;
      if (scroller !== 'nearest') {
        throw new CssUnsupported(
          `${context}: scroll(${scroller}) is not supported. A scroll-driven animation follows the ` +
            `nearest scroll view it is inside, scroll() or scroll(nearest).`,
        );
      }
      return axis === 'inline' || axis === 'x' ? 'x' : 'y';
    }
    case 'view':
      throw new CssUnsupported(
        `${context}: view() timelines are not supported. They play by where the element is in ` +
          `its scroll view, which needs its layout on the native side; scroll() plays by the ` +
          `scroll view's offset, over animation-range.`,
      );
    default:
      throw new CssUnsupported(
        `${context}: named timelines (scroll-timeline-name, '${timeline?.value ?? timeline?.type}') ` +
          `are not supported. Write scroll() on the element that animates.`,
      );
  }
}

/**
 * `animation-range` and its longhands, for a scroll timeline: where in the scroll offset the
 * animation starts and ends, in points, or as a percentage of how far the view scrolls.
 */
function scrollRange(property, list, out, context) {
  const [range] = list;
  const parts = (out[ANIMATION_PARTS] ??= {});
  if (property === 'animation-range-start') parts.rangeStart = rangeEnd(range, context);
  else if (property === 'animation-range-end') parts.rangeEnd = rangeEnd(range, context);
  else {
    parts.rangeStart = rangeEnd(range.start, context);
    parts.rangeEnd = rangeEnd(range.end, context);
  }
}

/** One end of a range: points, a percentage as the string it is, or undefined for `normal`. */
function rangeEnd(value, context) {
  if (value === 'normal' || value?.type === 'normal') return undefined;
  if (value?.name !== undefined) {
    throw new CssUnsupported(
      `${context}: the named range '${value.name}' belongs to view() timelines, which are not ` +
        `supported. A scroll() range is lengths or percentages of the scroll.`,
    );
  }
  if (value?.type === 'percentage') return `${Math.round(value.value * 10000) / 100}%`;
  const points = length(value?.value ?? value, context);
  if (typeof points !== 'number') {
    throw new CssUnsupported(
      `${context}: an animation-range is points or a percentage here, not ${JSON.stringify(points)}`,
    );
  }
  return points;
}

/** A duration or delay with a token in it, which the device settles into the spec. */
const TOKENED = Symbol('tokened');

/**
 * `animation-delay: calc(var(--i) * 60ms)`, the way a list staggers its rows, or a duration or
 * delay that is a token of time. Kept as the marker the device fills in; the spec it ends up in
 * is then settled on device too. False for any other declaration.
 */
function animationTimeWithTokens(property, parts, out, context) {
  if (property !== 'animation-delay' && property !== 'animation-duration') return false;
  const written = parts.filter(
    (part) => !(part.type === 'token' && part.value?.type === 'white-space'),
  );
  if (written.length !== 1) {
    throw new CssUnsupported(`${context}: one ${property.slice(10)} per animation, not a list`);
  }
  const { slot } = require('./token-arithmetic.cjs');
  (out[ANIMATION_PARTS] ??= {})[property.slice(10)] = [
    { [TOKENED]: slot(written[0], 'time', context) },
  ];
  return true;
}

/** A duration or delay, written or tokened. */
const timeOf = (value) => (value?.[TOKENED] !== undefined ? value[TOKENED] : milliseconds(value));

/**
 * What the player cannot do, refused at the declaration that asks for it, so only that
 * declaration is dropped and the report names it.
 */
function checkAnimation(part, list, context) {
  if (part === 'name' && list.length !== 1) {
    throw new CssUnsupported(
      `${context}: only one animation per rule is supported. Two animations on one element need ` +
        `two players and a rule for what happens when they set the same property.`,
    );
  }
}

/** Whether two compiled values are the same one: a number, a string, or a deferred marker. */
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The sides the logical border shorthands draw, as native names them: an inline side by Start or
 * End, which Yoga lays out by the direction, both inline sides by Left and Right, and the block
 * axis, vertical on native, by Top and Bottom.
 */
const BORDER_SIDES = {
  'border-inline-start': ['Start'],
  'border-inline-end': ['End'],
  // One value for both sides, so left and right, which a later `border-left` can override as it
  // would on the web, where a start or end edge outranks a left one in Yoga whatever the order.
  'border-inline': ['Left', 'Right'],
  'border-block-start': ['Top'],
  'border-block-end': ['Bottom'],
  'border-block': ['Top', 'Bottom'],
};

/** A shorthand for one side of the border, or two, each with the side's width and colour. */
function sideBorder(property, sides, value, out) {
  for (const side of sides) {
    const style = line(value, `border${side}`, out, property, { style: false });
    if (style !== undefined && !['solid', 'none', 'hidden'].includes(style)) {
      throw new CssUnsupported(
        `${property}: native has one border style for the whole box, so a '${style}' side ` +
          `cannot be drawn. Solid, native's default, is the one a single side can say.`,
      );
    }
  }
}

/**
 * Build the rule's animation from its parts. With no name there is nothing to play, as in a
 * browser; a name of `none` is kept as null, so a stronger rule can stop a weaker one's animation.
 * Every other list is read at the first entry, the one that pairs with the single name.
 */
/**
 * A keyframe's `animation-timing-function`, which eases from that keyframe to the next, as the
 * curve the engine reads; undefined when it has none. The other animation longhands mean nothing
 * inside a keyframe, and CSS ignores them there too.
 */
function frameEasing(out, context) {
  const parts = out[ANIMATION_PARTS];
  if (!parts) return undefined;
  delete out[ANIMATION_PARTS];
  const timing = parts['timing-function']?.[0];
  return timing === undefined ? undefined : easing(timing, context);
}

function finishAnimation(out, context) {
  const parts = out[ANIMATION_PARTS];
  if (!parts) return;
  delete out[ANIMATION_PARTS];
  const first = (part) => parts[part]?.[0];
  const name = first('name');
  // A play state on its own, as `.paused { animation-play-state: paused }` writes it, cascades
  // on its own too, over whatever animation a rule beside it names.
  if (!name && first('play-state')) out['$playState'] = first('play-state');
  if (!name) return;
  // Not `animation`, for the same reason as `$transition`.
  if (name.type === 'none' || parts.timeline === 'none') {
    out['$animation'] = null;
    return;
  }
  const spec = animationSpec(name, first, context);
  if (parts.timeline === 'x' || parts.timeline === 'y') {
    spec.timeline = parts.timeline;
    const range = {
      ...(parts.rangeStart === undefined ? {} : { start: parts.rangeStart }),
      ...(parts.rangeEnd === undefined ? {} : { end: parts.rangeEnd }),
    };
    if (Object.keys(range).length) spec.range = range;
  }
  out['$animation'] = spec;
}

/** One animation's spec, from the first entry of each part. */
function animationSpec(name, first, context) {
  const count = first('iteration-count');
  return {
    name: name.value ?? name,
    duration: timeOf(first('duration')),
    delay: timeOf(first('delay')),
    easing: easing(first('timing-function'), context),
    // `null`, not `Infinity`: the sheet is serialised into the bundle with `JSON.stringify`,
    // which has no way to write an infinity and turns it into null anyway. Emitting what
    // survives means the value a test sees is the value a device gets.
    iterations: count?.type === 'infinite' ? null : (count?.value ?? 1),
    fill: first('fill-mode') ?? 'none',
    // `normal` is left out, which is the default and what most animations say.
    ...(first('direction') && first('direction') !== 'normal'
      ? { direction: first('direction') }
      : {}),
    // And `running`, likewise.
    ...(first('play-state') === 'paused' ? { paused: true } : {}),
  };
}

/**
 * Truncation, which native does with a paragraph's props rather than a style: `numberOfLines`
 * cuts it to that many lines, and `ellipsizeMode` says where the ellipsis goes. CSS says the
 * same three ways, and Tailwind's `truncate` and `line-clamp-*` are made of them: `white-space:
 * nowrap` is one line, `line-clamp` is a number of them, and `text-overflow` is the ellipsis.
 */
function truncation(property, value, out, context) {
  if (property === 'text-overflow') {
    const word = keyword(value, property);
    if (!(word in ELLIPSIS)) {
      throw new CssUnsupported(
        `${context}: text-overflow: ${word} is not something native can draw; ellipsis and ` +
          `clip are.`,
      );
    }
    out.ellipsizeMode = ELLIPSIS[word];
    return;
  }
  if (property === 'white-space') {
    const word = keyword(value, property);
    if (!(word in WRAPPING)) {
      throw new CssUnsupported(
        `${context}: white-space: ${word} is not supported: native text has no switch for how ` +
          `spaces and line breaks are kept. nowrap, read as one line, and normal are.`,
      );
    }
    out.numberOfLines = WRAPPING[word];
    return;
  }
  out.numberOfLines = lineClamp(value, context);
}

/** `text-overflow`, as the `ellipsizeMode` native takes. `clip` is drawn on iOS only. */
const ELLIPSIS = { ellipsis: 'tail', clip: 'clip' };

/** `white-space`, as a number of lines: one, or no limit. */
const WRAPPING = { nowrap: 1, normal: null };

/** The words that mean no clamp. `unset` is how Tailwind's `line-clamp-none` says it. */
const NO_CLAMP = new Set(['none', 'unset', 'initial']);

function lineClamp(value, context) {
  if (NO_CLAMP.has(value)) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw new CssUnsupported(
    `${context}: line-clamp takes a whole number of lines, or none; got ${JSON.stringify(value)}`,
  );
}

/** The numeric font variants native has. `ordinal`, `slashed-zero` and the fractions it has not. */
const NUMERIC_VARIANTS = new Set([
  'lining-nums',
  'oldstyle-nums',
  'proportional-nums',
  'tabular-nums',
]);

/** `font-variant-numeric`, as the variant list RN wants. `normal` clears it. */
function numericVariants(value, context) {
  const words = Array.isArray(value) ? value : [keyword(value, context)];
  if (words.length === 1 && words[0] === 'normal') return null;
  for (const word of words) {
    if (!NUMERIC_VARIANTS.has(word)) {
      throw new CssUnsupported(
        `${context}: '${word}' is not a font variant native can ask a font for.`,
      );
    }
  }
  return words;
}

/** Set by `display: -webkit-box`, and read with the axis once the rule is complete. */
const WEBKIT_BOX = Symbol('webkit-box');
/** `box-orient`, which means something only beside `display: -webkit-box`, as on the web. */
const BOX_ORIENT = Symbol('box-orient');

/** The axis of an old flexbox. Its default is horizontal, as it is in a browser. */
const BOX_AXIS = {
  horizontal: 'row',
  'inline-axis': 'row',
  vertical: 'column',
  'block-axis': 'column',
};

/**
 * The old flexbox's axis, once a rule is complete: `box-orient` is read only where the rule also
 * made an old flexbox, because a browser ignores it anywhere else. Tailwind's `line-clamp-none`
 * writes `-webkit-box-orient: horizontal` beside `display: block`, and a row there would lay a
 * view's children out side by side.
 */
function finishBox(out, context) {
  const box = out[WEBKIT_BOX];
  const orient = out[BOX_ORIENT];
  delete out[WEBKIT_BOX];
  delete out[BOX_ORIENT];
  if (!box) return;
  if (orient !== undefined && !(orient in BOX_AXIS)) {
    throw new CssUnsupported(`${context}: box-orient: ${orient} is not an axis`);
  }
  out.flexDirection = BOX_AXIS[orient ?? 'horizontal'];
}

// eslint-disable-next-line complexity -- a dispatch table: one flat case per CSS form
function translate(property, value, out, context = property) {
  // Vendor prefixes and custom properties are handled by the caller.
  if (ALIASES[property]) return translate(ALIASES[property], value, out, context);
  switch (property) {
    case 'white-space':
    case 'text-overflow':
    case 'line-clamp':
    case '-webkit-line-clamp':
      truncation(property, value, out, context);
      return;
    case 'box-orient':
      out[BOX_ORIENT] = keyword(value, property);
      return;
    case 'font-variant-numeric':
      out.fontVariant = numericVariants(value, property);
      return;
    case 'object-fit':
      out.resizeMode = renamed(OBJECT_FIT, value, property);
      return;
    case 'vertical-align':
      out.textAlignVertical = renamed(VERTICAL_ALIGN, value, property);
      return;
    case 'user-select':
      // RN's own reading: every value but `none` leaves the text selectable.
      out.selectable = keyword(value, property) !== 'none';
      return;
    case 'border-inline-width': {
      // One width for both is left and right, as `margin-inline` is: see `LOGICAL` in
      // shorthands.cjs.
      const [start, end] = [length(value.start, property), length(value.end, property)];
      if (sameValue(start, end)) out.borderLeftWidth = out.borderRightWidth = start;
      else [out.borderStartWidth, out.borderEndWidth] = [start, end];
      return;
    }
    case 'border-block-width':
      out.borderTopWidth = length(value.start, property);
      out.borderBottomWidth = length(value.end, property);
      return;
    case 'transition':
      return transition(value, out);
    case 'transition-property':
    case 'transition-duration':
    case 'transition-timing-function':
    case 'transition-delay':
      return transitionLonghand(property, value, out);
    case 'animation':
      return animation(value, out, context);
    case 'animation-name':
    case 'animation-duration':
    case 'animation-timing-function':
    case 'animation-delay':
    case 'animation-iteration-count':
    case 'animation-direction':
    case 'animation-fill-mode':
    case 'animation-play-state':
      return animationLonghand(property, value, out, context);
    case 'animation-timeline':
      return scrollTimeline(value, out, context);
    case 'animation-range':
    case 'animation-range-start':
    case 'animation-range-end':
      return scrollRange(property, value, out, context);
    case 'padding':
      return sides('padding', value, out, property);
    case 'margin':
      return sides('margin', value, out, property);
    case 'inset':
      for (const [side, suffix] of Object.entries(SIDES)) {
        if (value[side] !== undefined) out[suffix.toLowerCase()] = length(value[side], property);
      }
      return;
    case 'border-width':
      for (const [side, suffix] of Object.entries(SIDES)) {
        if (value[side] !== undefined) out[`border${suffix}Width`] = length(value[side], property);
      }
      return;
    case 'border-color':
      for (const [side, suffix] of Object.entries(SIDES)) {
        if (value[side] !== undefined) out[`border${suffix}Color`] = color(value[side], property);
      }
      return;
    case 'border-radius':
      for (const [corner, rnName] of Object.entries(CORNERS)) {
        if (value[corner] !== undefined) {
          out[rnName.charAt(0).toLowerCase() + rnName.slice(1)] = radius(value[corner], property);
        }
      }
      return;
    case 'gap':
      // Both axes, always, as CSS defines the shorthand. Collapsed to RN's own `gap` when they
      // agreed, it lost to a `column-gap` from any weaker rule, which native reads first.
      out.rowGap = length(value.row, property);
      out.columnGap = length(value.column, property);
      return;
    case 'font-family':
      // A list on the web, one family on native: the first is the one the author wanted most.
      out.fontFamily = value[0];
      return;
    case 'border-style': {
      const style = uniform(value, property, 'border-style');
      // CSS computes the width of a line styled none as 0, as the shorthand already reads it.
      if (NO_LINE.has(style)) {
        for (const side of lineSides('border')) out[`${side}Width`] = 0;
        // Kept as a style too, so a width a later rule sets is zeroed as well: see css.ts.
        out.borderStyle = 'none';
      } else out.borderStyle = drawnLine(style, property);
      return;
    }
    case 'pointer-events': {
      // The rest of CSS's values are SVG ones, which a browser reads as auto on any other element:
      // Bulma's is-clickable is pointer-events: all. Fabric drops a value it does not know.
      const found = keyword(value, property);
      out.pointerEvents = ['none', 'box-none', 'box-only'].includes(found) ? found : 'auto';
      return;
    }
    case 'outline-style': {
      const style = keyword(value, property);
      if (NO_LINE.has(style)) out.outlineWidth = 0;
      else out.outlineStyle = drawnLine(style, property);
      return;
    }
    case 'aspect-ratio':
      if (value.auto || !value.ratio) {
        throw new CssUnsupported(
          `${property}: native has no 'auto'; leave the property out to get the same effect`,
        );
      }
      out.aspectRatio = round(value.ratio[0] / value.ratio[1]);
      return;
    case 'flex':
      out.flexGrow = round(value.grow);
      out.flexShrink = round(value.shrink);
      if (value.basis !== undefined) out.flexBasis = length(value.basis, property);
      return;
    case 'display': {
      const word = value?.inside?.type ?? keyword(value, property);
      // The old flexbox, which is what `line-clamp` is written with. A flex box, laid out along
      // the axis `box-orient` names; see `finishBox`.
      if (word === 'box' && value.inside.vendorPrefix?.includes('webkit')) {
        out.display = 'flex';
        out[WEBKIT_BOX] = true;
        return;
      }
      // A native view stacks its children in a column, which is what a block does with its own.
      // Reading block as flex is what lets `.d-none` then `.d-md-block` show an element again.
      if (displayName(value, word) === 'block') {
        out.display = 'flex';
        return;
      }
      if (!DISPLAY.has(word)) {
        throw new CssUnsupported(
          `display: ${displayName(value, word)} does not exist on native; only flex, block (read as flex), contents and none do`,
        );
      }
      out.display = word;
      return;
    }
    case 'background-image':
      // `none` is no image, which native reads from an empty list.
      out.experimental_backgroundImage =
        Array.isArray(value) && value.every((layer) => layer?.type === 'none')
          ? []
          : backgroundImage(value, property);
      return;
    case 'background-size':
      out.experimental_backgroundSize = backgroundSize(value, property);
      return;
    case 'background-repeat':
      out.experimental_backgroundRepeat = backgroundRepeat(value, property);
      return;
    case 'background-position':
      out.experimental_backgroundPosition = backgroundPosition(value, property);
      return;
    case 'filter':
      // `none` is no filters, which native reads from an empty list.
      out.filter = value?.type === 'none' ? [] : filter(value, property);
      return;
    case 'background': {
      // A list of layers, not one object. The colour is the only part native has, and CSS only
      // lets the final layer carry one. `image: none` and the initial position, repeat, size,
      // attachment, origin and clip are no-ops, so they pass silently; a real image is routed to
      // the `background-image` message rather than dropped.
      const layers = Array.isArray(value) ? value : [value];
      // The shorthand's image is not routed to `background-image`: a shorthand also resets the
      // colour, the position and the rest, and honouring only half of it is the kind of quiet
      // half-application this compiler exists to prevent. The longhand says it exactly.
      for (const layer of layers) {
        if (layer.image && layer.image.type !== 'none') {
          throw new CssUnsupported(
            `${property}: background images are not part of this shorthand here. Write ` +
              `background-image, which takes linear-gradient() and radial-gradient().`,
          );
        }
      }
      const last = layers[layers.length - 1];
      if (last?.color !== undefined) out.backgroundColor = color(last.color, property);
      return;
    }
    case 'border':
      // The shorthand is uniform by definition, so the unsided RN props say it in three keys
      // rather than nine. A per-side longhand still wins: Yoga reads borderLeftWidth over
      // borderWidth, exactly as CSS does.
      return line(value, 'border', out, property);
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left':
      return sideBorder(property, [SIDES[property.slice('border-'.length)]], value, out);
    case 'border-inline-start':
    case 'border-inline-end':
    case 'border-block-start':
    case 'border-block-end':
    case 'border-inline':
    case 'border-block':
      return sideBorder(property, BORDER_SIDES[property], value, out);
    case 'outline':
      return line(value, 'outline', out, property);
    case 'font':
      if (value.size !== undefined) out.fontSize = length(value.size, property);
      if (value.family?.length) out.fontFamily = value.family[0];
      if (value.style !== undefined) {
        const style = fontStyle(value.style);
        if (style !== 'normal') out.fontStyle = style;
      }
      if (value.weight !== undefined) translate('font-weight', value.weight, out);
      if (value.lineHeight !== undefined) fontLineHeight(value.lineHeight, out, property);
      return;
    case 'overflow': {
      // Native has one overflow, not one per axis, so axes that disagree cannot be honoured and
      // quietly picking one would be exactly the silent failure this compiler exists to prevent.
      const { x, y } = value;
      if (x !== y) {
        throw new CssUnsupported(
          `${property}: native has one overflow for both axes, so '${x} ${y}' cannot be applied`,
        );
      }
      out.overflow = honoured(property, keyword(x, property));
      return;
    }
    case 'text-decoration':
      if (value.line !== undefined) translate('text-decoration-line', value.line, out);
      if (value.style !== undefined) {
        out.textDecorationStyle = honoured('text-decoration-style', keyword(value.style, property));
      }
      // currentColor, written or left out, is native's own default for a decoration: the text's
      // colour. `null` clears the prop back to it, so the shorthand resets an earlier colour just
      // as it does on the web.
      if (value.color !== undefined) {
        out.textDecorationColor =
          value.color?.type === 'currentcolor' ? null : color(value.color, property);
      }
      return;
    case 'text-decoration-line': {
      // RN spells a combination as one space-separated string, e.g. 'underline line-through'.
      const lines = Array.isArray(value) ? value : [keyword(value, property)];
      if (lines.includes('overline') || lines.includes('blink')) {
        throw new CssUnsupported(
          `${property}: native draws underline and line-through, and no ${lines.includes('blink') ? 'blink' : 'overline'}.`,
        );
      }
      out.textDecorationLine = lines.length ? lines.join(' ') : 'none';
      return;
    }
    case 'flex-flow':
      if (value.direction !== undefined) out.flexDirection = keyword(value.direction, property);
      if (value.wrap !== undefined) out.flexWrap = keyword(value.wrap, property);
      return;
    case 'transform':
      out.transform = transformList(value, property);
      return;
    // CSS's individual transform properties, which are what Tailwind v4 writes: `translate-x-4`
    // is `translate: 1rem 0`, not `transform: translateX(1rem)`. They are properties of their own,
    // so each compiles to a key of its own and cascades on its own: `.rotate-45.translate-x-4`
    // keeps both. Native has only the list, so the engine builds it at commit time, in the spec's
    // order (translate, rotate, scale, then `transform`); see `INDIVIDUAL_TRANSFORMS`.
    //
    // `none` is null rather than nothing, so that it still overrides a weaker rule's value.
    case 'translate':
      out[INDIVIDUAL_TRANSFORMS.translate] =
        value === 'none'
          ? null
          : [{ translateX: length(value.x, property) }, { translateY: length(value.y, property) }];
      return;
    case 'rotate':
      out[INDIVIDUAL_TRANSFORMS.rotate] = value === 'none' ? null : [rotation(value, property)];
      return;
    case 'scale':
      out[INDIVIDUAL_TRANSFORMS.scale] =
        value === 'none'
          ? null
          : [{ scaleX: number(value.x, property) }, { scaleY: number(value.y, property) }];
      return;
    case 'transform-origin':
      // Exactly three entries: Fabric discards an origin of any other length, without a word.
      out.transformOrigin = [origin(value.x, 'x', property), origin(value.y, 'y', property), 0];
      return;
    case 'text-transform':
      // lightningcss reads this as a record, because CSS has three independent transforms in one
      // property. Native has only the case, and the other two are Japanese text features it does
      // not offer at all.
      if (value.fullWidth || value.fullSizeKana) {
        throw new CssUnsupported(
          `${property}: native transforms the case only; full-width and full-size-kana have no ` +
            `equivalent.`,
        );
      }
      out.textTransform = value.case ?? 'none';
      return;
    case 'font-style':
      out.fontStyle = fontStyle(value);
      return;
    case 'font-variant':
      // RN takes a list, because several variants can apply at once. CSS has no shorthand this
      // simple, so lightningcss hands the word over unparsed and it is checked here.
      out.fontVariant = [fontVariant(value, property)];
      return;
    case 'border-block-color':
    case 'border-inline-color': {
      // One CSS property, two edges, and RN has a single prop for the pair. Edges that disagree
      // cannot be honoured, and picking one silently is the failure this compiler exists to stop.
      const start = color(value.start, property);
      const end = color(value.end, property);
      // The inline edges are two props in Fabric, `borderStartColor` and `borderEndColor`, and
      // there is no `borderInlineColor` for the pair. The block edges do have a pair prop.
      if (property === 'border-inline-color') {
        if (sameValue(start, end)) out.borderLeftColor = out.borderRightColor = start;
        else [out.borderStartColor, out.borderEndColor] = [start, end];
        return;
      }
      if (start !== end) {
        throw new CssUnsupported(
          `${property}: native has one colour for both edges, and these differ. Use the ` +
            `per-edge longhands.`,
        );
      }
      out[camel(property)] = start;
      return;
    }
    case 'box-shadow':
      out.boxShadow = shadowList(value, property);
      return;
    case 'text-shadow': {
      if (value.length > 1) {
        throw new CssUnsupported(
          `${property}: native has room for only one text shadow, not ${value.length}`,
        );
      }
      const [shadow] = value;
      if (!shadow) return;
      out.textShadowOffset = {
        width: length(shadow.xOffset, property),
        height: length(shadow.yOffset, property),
      };
      out.textShadowRadius = length(shadow.blur, property);
      out.textShadowColor = color(shadow.color, property);
      return;
    }
    case 'cursor':
      out.cursor = honoured(property, value.keyword ?? keyword(value, property));
      return;
    case 'font-weight':
      // Relative to the weight inherited, which native has no way to ask for. Passed through, it
      // is a weight native does not know, and the text is drawn at the one it already had.
      if (value?.type === 'bolder' || value?.type === 'lighter') {
        throw new CssUnsupported(
          `${property}: '${value.type}' is relative to the inherited weight, and native takes an ` +
            `absolute one. Write the weight: bold, or a number from 100 to 900.`,
        );
      }
      // A weight outside 1 to 1000 is invalid, and a browser drops the declaration.
      if (
        typeof value?.value?.value === 'number' &&
        !(value.value.value >= 1 && value.value.value <= 1000)
      ) {
        throw new CssUnsupported(
          `${property}: ${value.value.value} is not a weight; weights run from 1 to 1000`,
        );
      }
      out.fontWeight =
        typeof value?.value?.value === 'number'
          ? nearestWeight(value.value.value)
          : String(value?.value?.type === 'bold' ? 700 : keyword(value, property));
      return;
    default:
      break;
  }

  if (property === 'line-height' && value?.type === 'normal') {
    // The CSS for "whatever the font says", and the reason it is worth supporting: line-height is
    // inherited, so a `leading-none` on a label reaches a text field inside it that meant to have
    // none of its own. Native spells "the font's own" as the absence of the prop, and `null` is
    // how a declaration says to clear one - which beats what the parent handed down.
    out.lineHeight = null;
    return;
  }
  if (property in RESETS && RESETS[property] === value?.type) {
    // The keyword that switches the property off, which is how a later rule undoes an earlier
    // one. Native spells that as the absence of the prop, and `null` is how a declaration clears
    // one, beating whatever a weaker rule or an ancestor set.
    out[camel(property)] = null;
    return;
  }
  if (property === 'line-height' && value?.value?.type === 'percentage') {
    // A percentage is of the element's own font size, as em is. Fabric reads a number only, and
    // dropped the '150%' string this used to send.
    out.lineHeight = { __defer: { unit: 'em', factor: round(value.value.value) } };
    return;
  }
  if (property === 'line-height' && value?.type === 'number') {
    // A unitless line-height is a multiple of the font size, and native wants points. The font
    // size is not known until the cascade has run - it may be inherited, or set by a class the
    // node does not wear yet - so it is deferred exactly as `em` is, which means the same thing.
    out.lineHeight = { __defer: { unit: 'em', factor: round(value.value) } };
    return;
  }
  if (LENGTH.has(property)) {
    const settled = length(value, property);
    // A font size in percent is a share of the inherited one, which is what an em is: native's
    // fontSize takes points, so it is worked out where the inherited size is known.
    if (property === 'font-size' && typeof settled === 'string' && settled.endsWith('%')) {
      out.fontSize = { __defer: { unit: 'em', factor: round(parseFloat(settled) / 100) } };
      return;
    }
    out[rnName(property)] = settled;
    return;
  }
  if (COLOR.has(property)) {
    out[rnName(property)] = color(value, property);
    return;
  }
  if (property in ALIGNMENT) {
    out[camel(property)] = alignment(property, value);
    return;
  }
  if (KEYWORD.has(property)) {
    out[camel(property)] = honoured(property, keyword(value, property));
    return;
  }
  if (NUMBER.has(property)) {
    const found = number(value, property);
    // CSS clamps an opacity into 0 to 1 at computed-value time; `opacity-[3]` is opaque.
    out[camel(property)] = property === 'opacity' ? Math.min(1, Math.max(0, found)) : found;
    return;
  }

  // Side-specific length and colour longhands, e.g. padding-top, border-left-width.
  if (/^(padding|margin)-(top|right|bottom|left)$/.test(property)) {
    out[camel(property)] = length(value, property);
    return;
  }
  if (/^border-(top|right|bottom|left)-width$/.test(property)) {
    out[camel(property)] = length(value, property);
    return;
  }
  if (CORNER_RADIUS.test(property)) {
    out[camel(property)] = radius(value, property);
    return;
  }

  const logical = LOGICAL_SIDES[property];
  if (logical) {
    const [startKey, endKey] = logical;
    const start = value[startKey] === undefined ? undefined : length(value[startKey], property);
    const end = value[endKey] === undefined ? undefined : length(value[endKey], property);
    const [startName, endName] = start === end ? LOGICAL[property].same : LOGICAL[property].split;
    if (start !== undefined) out[startName] = start;
    if (end !== undefined) out[endName] = end;
    return;
  }

  throw unsupported(property, context);
}

/** What to write instead of a property native has no equivalent for, where there is something. */
const INSTEAD = {
  visibility: 'Use opacity: 0 to hide a box and keep its space, or display: none to remove it.',
  order: 'Yoga lays children out in the order they are written: change the order in the template.',
  float: 'Lay the row out with flexbox: flex-direction: row on the parent.',
  clear: 'Lay the row out with flexbox: flex-direction: row on the parent.',
};

/**
 * Two different failures, which used to share one message.
 *
 * Saying "no React Native equivalent" of `transform` or `box-shadow`, which RN supports perfectly
 * well, is how the allowlist drifted to half of RN's style API with nobody noticing: the message
 * read like a closed question.
 */
function unsupported(property, context) {
  if (/^-(webkit|moz|ms|o)-/.test(property)) {
    return new CssUnsupported(
      `${context}: '${property}' is vendor-prefixed, for one browser engine. Native reads the ` +
        `standard property, which a stylesheet that writes this usually has beside it.`,
    );
  }
  if (property === 'overflow-x' || property === 'overflow-y') {
    return new CssUnsupported(
      `${context}: '${property}': native has one overflow for both axes. Write 'overflow'.`,
    );
  }
  if (property.startsWith('animation-')) {
    return new CssUnsupported(
      `${context}: '${property}' is not supported. The player runs one animation on the clock, ` +
        `from the parts 'animation' and its longhands name, and has nothing this could change.`,
    );
  }
  if (NO_NATIVE_EQUIVALENT.has(property)) {
    const instead = INSTEAD[property];
    return new CssUnsupported(
      `${context}: '${property}' has no React Native equivalent: no style prop of a native view ` +
        `does what it does.${instead ? ` ${instead}` : ''}`,
    );
  }
  return new CssUnsupported(
    `${context}: '${property}' is not mapped yet. React Native may well support it; nothing here translates ` +
      `it. Check RN's style types, then add it to css/properties.cjs.`,
  );
}

/**
 * What sort of value a property takes, so a `var()` can be converted at its use site.
 *
 * Only longhands answer. A shorthand expands into several RN props, and which one a substituted
 * value would land in cannot be known without parsing the substituted text, which there is no
 * parser on device to do.
 */
const SIDE_SHORTHANDS = {
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  inset: ['top', 'right', 'bottom', 'left'],
  'border-width': ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
  // One value on both sides of an axis, as a written one compiles: left and right, so a later
  // `border-left` still overrides it, and top and bottom.
  'border-inline-width': ['borderLeftWidth', 'borderRightWidth'],
  'border-block-width': ['borderTopWidth', 'borderBottomWidth'],
  'border-radius': [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomLeftRadius',
    'borderBottomRightRadius',
  ],
};

/**
 * The React Native properties a `var()` in this CSS property must be written to.
 *
 * A four-sided shorthand is unambiguous when the value is a single length, which a token always
 * is, so `padding: var(--gap)` sets all four sides rather than being refused.
 */
function propsFor(property) {
  if (ALIASES[property]) return propsFor(ALIASES[property]);
  return SIDE_SHORTHANDS[property] ?? SPELLED_OUT[property] ?? [rnName(property)];
}

/**
 * Shorthands native also has a single prop for, written as their longhands anyway: the single
 * prop loses to a longhand from any weaker rule. See `lineSides`.
 */
const SPELLED_OUT = {
  gap: ['rowGap', 'columnGap'],
  'border-color': ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'],
  'border-inline-color': ['borderLeftColor', 'borderRightColor'],
  'border-block-color': ['borderTopColor', 'borderBottomColor'],
};

/** Properties whose kind is not the set they are in, or that are in none. */
const KINDS = {
  // Reads as a shorthand in CSS but is one property on native, and a token is single-valued by
  // construction, so there is nothing ambiguous to guess at.
  gap: 'length',
  // A list on the web and one name on native, so a token holding a stack is read as its first.
  'font-family': 'family',
  // A length, or a bare number that multiplies the font size: the token knows which it is.
  'line-height': 'lineHeight',
  // Two sides of one axis, and a token holds one colour for both.
  'border-inline-color': 'color',
  'border-block-color': 'color',
  // A shorthand in CSS, but one that only ever lands in the one native prop.
  'box-shadow': 'shadow',
  'font-weight': 'weight',
};

function kindOf(property) {
  if (ALIASES[property]) return kindOf(ALIASES[property]);
  if (KINDS[property]) return KINDS[property];
  if (SIDE_SHORTHANDS[property]) return 'length';
  if (
    LENGTH.has(property) ||
    /^(padding|margin)-(top|right|bottom|left)$/.test(property) ||
    /^border-(top|right|bottom|left)-width$/.test(property) ||
    CORNER_RADIUS.test(property)
  ) {
    return 'length';
  }
  if (COLOR.has(property)) return 'color';
  if (KEYWORD.has(property)) return 'keyword';
  if (NUMBER.has(property)) return 'number';
  return null;
}

module.exports = {
  FONT_VARIANTS,
  animationTimeWithTokens,
  translate,
  finishTransition,
  finishAnimation,
  frameEasing,
  finishBox,
  unsupported,
  kindOf,
  propsFor,
  camel,
  ALIASES,
};
